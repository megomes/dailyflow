package app.dailyflow.wear.notify

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.dailyflow.wear.Api
import app.dailyflow.wear.Block
import app.dailyflow.wear.MainActivity
import app.dailyflow.wear.R
import app.dailyflow.wear.Snapshot
import app.dailyflow.wear.complications.Sources
import app.dailyflow.wear.face.FaceData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * The block-change nudge on the watch: at every block boundary an exact alarm fires and a
 * notification says what ended, what starts (time and to-dos) and lets you switch in one tap.
 */
object Transitions {
    const val CHANNEL = "transitions"
    private const val ID = 4201
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val VIBRATION = longArrayOf(0, 90, 120, 90, 120, 260)

    fun ensureChannel(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) != null) return
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Block changes", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "When a block ends and the next one starts"
            enableVibration(true)
            vibrationPattern = VIBRATION
        })
    }

    private fun pending(context: Context, action: String, extra: Int = 0): PendingIntent =
        PendingIntent.getBroadcast(context, action.hashCode() + extra, Intent(context, TransitionReceiver::class.java).setAction(action),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    /** Arms one exact alarm at the next block boundary (a couple of seconds after, so the new block is "now"). */
    fun schedule(context: Context) {
        val s = FaceData.snapshot ?: return
        val m = s.minuteAt(System.currentTimeMillis())
        val next = s.timeline.flatMap { listOf(it.start, it.end) }.filter { it > m }.minOrNull() ?: return
        val at = s.instantOf(next.toFloat()).toEpochMilli() + 2_000
        val am = context.getSystemService(AlarmManager::class.java)
        runCatching { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context, TransitionReceiver.FIRE)) }
            .onFailure { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context, TransitionReceiver.FIRE)) }
    }

    /** “+10 min”: the same nudge again later. */
    fun snooze(context: Context, minutes: Int = 10) {
        context.getSystemService(AlarmManager::class.java)
            .setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + minutes * 60_000L, pending(context, TransitionReceiver.SNOOZED))
    }

    /** What changed at minute [b]: the block that ended there and the one on now (or the next one, after a gap). */
    private data class Change(val ended: Block?, val starts: Block?, val after: Block?)

    private fun changeAt(s: Snapshot, m: Float): Change {
        val starts = s.nowAt(m)
        val ended = s.timeline.lastOrNull { it.end <= m && it.end > m - 3 && it != starts }
        return Change(ended, starts, if (starts == null) s.nextAt(m) else null)
    }

    // A few lines so it never feels like the same alarm twice in a row.
    private fun headline(c: Change, seed: Int): String {
        val a = c.ended?.title; val b = c.starts?.title
        val pool = when {
            a != null && b != null -> listOf("Swap time! ⏰", "$a is a wrap 🎬", "On to $b 🚀", "Next stop: $b 🚉", "$b o'clock 🕰️", "Plot twist: $b 🎭")
            b != null -> listOf("$b starts now ✨", "Showtime: $b 🎬", "You're up: $b 🚀")
            a != null && c.after != null -> listOf("$a is a wrap 🎬", "Breather ☕", "Free until ${c.after.startLabel} 🌿")
            a != null -> listOf("That's the day 🌙", "$a is a wrap. Day done 🌙")
            else -> listOf("DailyFlow")
        }
        return pool[Math.floorMod(seed, pool.size)]
    }

    /** The “swap” art: the ending block's color handing over to the next one. */
    private fun swapIcon(from: Int?, to: Int): Bitmap {
        val bmp = Bitmap.createBitmap(128, 128, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        c.drawColor(Color.parseColor("#0B1835"))
        if (from != null) { p.color = from; p.alpha = 150; c.drawCircle(42f, 64f, 26f, p) }
        p.color = to; p.alpha = 255; c.drawCircle(if (from != null) 82f else 64f, 64f, 32f, p)
        p.color = Color.WHITE
        val arrow = Path().apply { moveTo(74f, 52f); lineTo(92f, 64f); lineTo(74f, 76f); close() }
        if (from != null) c.drawPath(arrow, p)
        return bmp
    }

    /** Preview: the nudge the next block change will show, right now. */
    fun preview(context: Context) {
        val s = FaceData.snapshot ?: return
        val m = s.minuteAt(System.currentTimeMillis())
        // The next boundary today; at night (nothing left) show the end of the last block (“that's the day”).
        val next = s.timeline.flatMap { listOf(it.start, it.end) }.filter { it > m }.minOrNull() ?: s.timeline.maxOfOrNull { it.end } ?: return
        // A brand-new post (not an update of an unseen one), so it pops up and buzzes like the real one.
        NotificationManagerCompat.from(context).cancel(ID)
        show(context, s, reminder = false, atMinute = next + 0.05f, force = true)
    }

    fun show(context: Context, s: Snapshot, reminder: Boolean, atMinute: Float? = null, force: Boolean = false) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val m = atMinute ?: s.minuteAt(System.currentTimeMillis())
        val c = changeAt(s, m)
        if (c.ended == null && c.starts == null) return
        // Already doing the new block (started it early): nothing to nudge.
        if (!force && !reminder && c.starts != null && s.runningTitle == c.starts.title) return
        ensureChannel(context)
        val running = s.runningTitle
        val title = if (reminder) "Still on ${running ?: c.ended?.title ?: "it"}? ⏳" else headline(c, (s.day + m.toInt()).hashCode())
        val todos = c.starts?.let { b -> s.todos.filter { it.blockStart == b.startLabel && it.blockTitle == b.title } } ?: emptyList()
        val short = when {
            c.starts != null -> "${c.starts.title} · ${c.starts.startLabel}–${c.starts.endLabel}"
            c.after != null -> "Free until ${c.after.startLabel} · then ${c.after.title}"
            else -> "Nothing else planned today"
        }
        val body = buildString {
            if (c.starts != null) append("▶ ${c.starts.title}  ${c.starts.startLabel}–${c.starts.endLabel}\n")
            else if (c.after != null) append("☕ Free until ${c.after.startLabel}, then ${c.after.title}\n")
            if (c.ended != null) append("✓ ${c.ended.title}  ${c.ended.startLabel}–${c.ended.endLabel}\n")
            if (running != null && running != c.starts?.title) append("● Still running: $running\n")
            if (todos.isNotEmpty()) {
                append("\nTo-dos\n")
                todos.take(4).forEach { append("${if (it.high) "!" else "○"} ${it.title}${it.estimate?.let { e -> " · ${e}m" } ?: ""}\n") }
                if (todos.size > 4) append("+${todos.size - 4} more\n")
            }
        }.trim()
        val accent = c.starts?.color ?: c.after?.color ?: c.ended?.color ?: Color.parseColor("#60AEFF")
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_now)
            .setLargeIcon(swapIcon(c.ended?.color, accent))
            .setColor(accent)
            .setContentTitle(title)
            .setContentText(short)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body).setBigContentTitle(title))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVibrate(VIBRATION)
            .setAutoCancel(true)
            .setTimeoutAfter(30 * 60_000L)
            .setContentIntent(PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE))
        if (c.starts != null && running != c.starts.title) n.addAction(R.drawable.ic_play, "Start ${c.starts.title}", pending(context, TransitionReceiver.START))
        if (running != null) n.addAction(R.drawable.ic_stop, "Stop", pending(context, TransitionReceiver.STOP))
        n.addAction(R.drawable.ic_now, "+10 min", pending(context, TransitionReceiver.SNOOZE))
        NotificationManagerCompat.from(context).notify(ID, n.build())
        context.getSharedPreferences("dailyflow", Context.MODE_PRIVATE).edit().putString("nudge.block", c.starts?.title).apply()
    }

    /** The block-change nudge goes away once that block is started anywhere (phone, web, here). */
    fun dismissIfStarted(context: Context, s: Snapshot) {
        val prefs = context.getSharedPreferences("dailyflow", Context.MODE_PRIVATE)
        val block = prefs.getString("nudge.block", null) ?: return
        if (s.runningTitle == block) { NotificationManagerCompat.from(context).cancel(ID); prefs.edit().remove("nudge.block").apply() }
    }

    /** After an action from the notification: say it worked, then get out of the way. */
    fun confirm(context: Context, text: String, color: Int?) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val n = NotificationCompat.Builder(context, CHANNEL).setSmallIcon(R.drawable.ic_now).setContentTitle(text)
            .setColor(color ?: Color.parseColor("#60AEFF")).setSilent(true).setTimeoutAfter(4_000).setAutoCancel(true).build()
        NotificationManagerCompat.from(context).notify(ID, n)
    }

    fun handle(context: Context, action: String, done: () -> Unit) {
        val app = context.applicationContext
        scope.launch {
            try {
                FaceData.load(app)
                when (action) {
                    TransitionReceiver.FIRE, TransitionReceiver.SNOOZED -> {
                        withTimeoutOrNull(6_000) { FaceData.refresh(app) }
                        FaceData.snapshot?.let { show(app, it, reminder = action == TransitionReceiver.SNOOZED) }
                        Sources.refreshAll(app)
                        schedule(app)
                    }
                    TransitionReceiver.START, TransitionReceiver.STOP -> {
                        val color = FaceData.snapshot?.let { s -> s.nowAt(s.minuteAt(System.currentTimeMillis()))?.color }
                        val msg = Api(app).quick(if (action == TransitionReceiver.START) "start" else "stop")
                        confirm(app, "$msg ✓", color)
                        FaceData.refresh(app)
                        Sources.refreshAll(app)
                        delay(300)
                    }
                    TransitionReceiver.SNOOZE -> {
                        NotificationManagerCompat.from(app).cancel(ID)
                        snooze(app)
                    }
                    Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> schedule(app)
                }
            } finally { done() }
        }
    }
}

class TransitionReceiver : BroadcastReceiver() {
    companion object {
        const val FIRE = "app.dailyflow.wear.TRANSITION"
        const val SNOOZED = "app.dailyflow.wear.TRANSITION_SNOOZED"
        const val START = "app.dailyflow.wear.TRANSITION_START"
        const val STOP = "app.dailyflow.wear.TRANSITION_STOP"
        const val SNOOZE = "app.dailyflow.wear.TRANSITION_SNOOZE"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        Transitions.handle(context, intent.action ?: return pending.finish()) { pending.finish() }
    }
}
