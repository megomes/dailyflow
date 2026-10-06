package app.dailyflow.wear.move

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
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.dailyflow.wear.R
import app.dailyflow.wear.face.FaceData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime
import kotlin.coroutines.resume

/**
 * Move breaks (note #19): while something is running and you have barely walked for a while
 * (hyperfocus), the watch nudges you to stand up; a break screen counts your steps; breaks are
 * logged per block so the day shows how much you moved in each.
 */
object Move {
    const val CHANNEL = "move"
    private const val ID = 4301
    private const val PREFS = "dailyflow.move"
    /** Sitting this long with something running… */
    const val SIT_MIN = 45
    /** …with fewer steps than this in that window → nudge. */
    const val FEW_STEPS = 100
    private const val GAP_MIN = 40
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val VIBRATION = longArrayOf(0, 60, 80, 60, 80, 60, 80, 320)

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun ensureChannel(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) != null) return
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Move breaks", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "A nudge to stand up after a long stretch without moving"
            enableVibration(true); vibrationPattern = VIBRATION
        })
    }

    private fun pending(context: Context, action: String): PendingIntent =
        PendingIntent.getBroadcast(context, action.hashCode(), Intent(context, MoveReceiver::class.java).setAction(action), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    /** Checks every ~15 minutes (inexact: cheap on the battery). */
    fun schedule(context: Context) {
        context.getSystemService(AlarmManager::class.java).setInexactRepeating(
            AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 60_000, AlarmManager.INTERVAL_FIFTEEN_MINUTES, pending(context, MoveReceiver.CHECK))
    }

    // ── Steps ──
    /** Cumulative steps since boot (the step counter sensor delivers its current value on registration). */
    suspend fun readSteps(context: Context): Long? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) return null
        val sm = context.getSystemService(SensorManager::class.java)
        val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return null
        return withTimeoutOrNull(8_000) {
            suspendCancellableCoroutine { cont ->
                val l = object : SensorEventListener {
                    override fun onSensorChanged(e: SensorEvent) { sm.unregisterListener(this); if (cont.isActive) cont.resume(e.values[0].toLong()) }
                    override fun onAccuracyChanged(s: Sensor?, a: Int) {}
                }
                sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_NORMAL)
                cont.invokeOnCancellation { sm.unregisterListener(l) }
            }
        }
    }

    /** Samples (time, cumulative steps) of the last 3 hours. */
    private fun samples(context: Context): MutableList<Pair<Long, Long>> {
        val a = JSONArray(prefs(context).getString("samples", "[]"))
        return (0 until a.length()).map { a.getJSONArray(it).let { p -> p.getLong(0) to p.getLong(1) } }.toMutableList()
    }

    private fun saveSamples(context: Context, list: List<Pair<Long, Long>>) {
        val cut = System.currentTimeMillis() - 3 * 3_600_000L
        prefs(context).edit().putString("samples", JSONArray(list.filter { it.first >= cut }.map { JSONArray(listOf(it.first, it.second)) }).toString()).apply()
    }

    /** Steps walked in the last [minutes] (handles the counter resetting at reboot). */
    private fun stepsSince(list: List<Pair<Long, Long>>, nowSteps: Long, minutes: Int): Long? {
        val t = System.currentTimeMillis() - minutes * 60_000L
        val base = list.lastOrNull { it.first <= t } ?: return null
        return if (nowSteps >= base.second) nowSteps - base.second else nowSteps
    }

    // ── The check ──
    suspend fun check(context: Context) {
        val steps = readSteps(context) ?: return
        val list = samples(context).apply { add(System.currentTimeMillis() to steps) }
        saveSamples(context, list)
        val hour = LocalTime.now().hour
        if (hour < 7 || hour >= 22) return
        FaceData.load(context)
        withTimeoutOrNull(5_000) { FaceData.refresh(context, 10 * 60_000) }
        val s = FaceData.snapshot ?: return
        val running = s.runningTitle ?: return
        val since = s.runningSince?.split(":")?.let { (it[0].toInt() * 60 + it[1].toInt()) } ?: return
        val runningFor = ((s.minuteAt(System.currentTimeMillis()).toInt() % 1440) - since + 1440) % 1440
        if (runningFor < SIT_MIN) return
        val walked = stepsSince(list, steps, SIT_MIN) ?: return
        if (walked >= FEW_STEPS) return
        val last = prefs(context).getLong("lastNudge", 0)
        if (System.currentTimeMillis() - last < GAP_MIN * 60_000L) return
        nudge(context, running, runningFor, walked)
    }

    private val LINES = listOf(
        "Time to move! 🚶", "Stretch break? 🙆", "Your chair misses you less than your legs do 🦵",
        "Quick lap? 🏃", "Water + a walk? 💧", "Unfreeze! 🧊➡️🚶",
    )

    /** The stretching figure on a green gradient: the same character as the break screen. */
    private fun figureIcon(): Bitmap {
        val bmp = Bitmap.createBitmap(160, 160, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.shader = LinearGradient(0f, 0f, 160f, 160f, Color.parseColor("#0C3B26"), Color.parseColor("#19B66A"), Shader.TileMode.CLAMP)
        c.drawCircle(80f, 80f, 80f, p)
        p.shader = null
        p.color = Color.parseColor("#73E3AA"); p.strokeWidth = 9f; p.strokeCap = Paint.Cap.ROUND
        c.drawCircle(80f, 38f, 13f, p)
        c.drawLine(80f, 56f, 80f, 102f, p)
        c.drawLine(80f, 66f, 52f, 40f, p); c.drawLine(80f, 66f, 108f, 40f, p)
        c.drawLine(80f, 102f, 62f, 140f, p); c.drawLine(80f, 102f, 98f, 140f, p)
        p.color = Color.WHITE; p.alpha = 150
        for ((x, y) in listOf(34f to 30f, 128f to 28f, 26f to 70f, 136f to 74f)) c.drawCircle(x, y, 4f, p)
        return bmp
    }

    fun nudge(context: Context, block: String, minutes: Int, steps: Long) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        ensureChannel(context)
        prefs(context).edit().putLong("lastNudge", System.currentTimeMillis()).putString("nudgeBlock", block).apply()
        val title = LINES[(System.currentTimeMillis() / 60_000 % LINES.size).toInt()]
        val text = "$block · ${minutes}m sitting · $steps steps"
        val open = PendingIntent.getActivity(context, 7, Intent(context, MoveActivity::class.java).putExtra(MoveActivity.BLOCK, block)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_move).setColor(0xFF19B66A.toInt()).setLargeIcon(figureIcon())
            .setFullScreenIntent(open, true)
            .setContentTitle(title).setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText("$text\nTwo minutes on your feet resets the clock."))
            .setCategory(NotificationCompat.CATEGORY_REMINDER).setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVibrate(VIBRATION).setAutoCancel(true).setTimeoutAfter(20 * 60_000L)
            .setContentIntent(open)
            .addAction(R.drawable.ic_move, "Let's move", open)
            .addAction(R.drawable.ic_now, "In 10 min", pending(context, MoveReceiver.SNOOZE))
            .addAction(R.drawable.ic_stop, "Skip", pending(context, MoveReceiver.SKIP))
        NotificationManagerCompat.from(context).notify(ID, n.build())
    }

    fun cancel(context: Context) = NotificationManagerCompat.from(context).cancel(ID)

    // ── Log per block ──
    fun logBreak(context: Context, block: String?, steps: Long, seconds: Int) {
        val day = LocalDate.now().toString()
        val log = JSONArray(prefs(context).getString("log", "[]")).let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
            .filter { it.optString("day") >= LocalDate.now().minusDays(14).toString() } +
            JSONObject().put("day", day).put("ts", System.currentTimeMillis()).put("block", block ?: "").put("steps", steps).put("sec", seconds)
        prefs(context).edit().putString("log", JSONArray(log).toString()).apply()
    }

    data class Today(val breaks: Int, val steps: Long, val byBlock: Map<String, Int>)

    fun today(context: Context): Today {
        val day = LocalDate.now().toString()
        val a = JSONArray(prefs(context).getString("log", "[]"))
        val items = (0 until a.length()).map { a.getJSONObject(it) }.filter { it.optString("day") == day }
        return Today(items.size, items.sumOf { it.optLong("steps") }, items.groupingBy { it.optString("block").ifEmpty { "—" } }.eachCount())
    }

    fun handle(context: Context, action: String, done: () -> Unit) {
        val app = context.applicationContext
        scope.launch {
            try {
                when (action) {
                    MoveReceiver.CHECK -> check(app)
                    MoveReceiver.SNOOZE -> {
                        cancel(app)
                        // Let the next check fire in ~10 min instead of waiting the 40-minute gap.
                        prefs(app).edit().putLong("lastNudge", System.currentTimeMillis() - (GAP_MIN - 10) * 60_000L).apply()
                        app.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 10 * 60_000L,
                            PendingIntent.getBroadcast(app, 99, Intent(app, MoveReceiver::class.java).setAction(MoveReceiver.CHECK), PendingIntent.FLAG_IMMUTABLE))
                    }
                    MoveReceiver.SKIP -> cancel(app)
                    Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> schedule(app)
                }
            } finally { done() }
        }
    }
}

class MoveReceiver : BroadcastReceiver() {
    companion object {
        const val CHECK = "app.dailyflow.wear.MOVE_CHECK"
        const val SNOOZE = "app.dailyflow.wear.MOVE_SNOOZE"
        const val SKIP = "app.dailyflow.wear.MOVE_SKIP"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        Move.handle(context, intent.action ?: return pending.finish()) { pending.finish() }
    }
}
