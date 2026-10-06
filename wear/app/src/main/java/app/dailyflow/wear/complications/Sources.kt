package app.dailyflow.wear.complications

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.wear.protolayout.expression.DynamicBuilders.DynamicFloat
import androidx.wear.protolayout.expression.DynamicBuilders.DynamicInstant
import androidx.wear.protolayout.expression.DynamicBuilders.DynamicInt32
import androidx.wear.protolayout.expression.DynamicBuilders.DynamicString
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationText
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.DynamicComplicationText
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.MonochromaticImage
import androidx.wear.watchface.complications.data.MonochromaticImageComplicationData
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.SmallImage
import androidx.wear.watchface.complications.data.SmallImageComplicationData
import androidx.wear.watchface.complications.data.SmallImageType
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.wear.watchface.complications.datasource.ComplicationDataTimeline
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.SuspendingTimelineComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.TimeInterval
import androidx.wear.watchface.complications.datasource.TimelineEntry
import app.dailyflow.wear.Api
import app.dailyflow.wear.Block
import app.dailyflow.wear.MainActivity
import app.dailyflow.wear.R
import app.dailyflow.wear.Snapshot
import app.dailyflow.wear.face.ConfirmActivity
import app.dailyflow.wear.face.FaceData
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * DailyFlow complications: plug the day into any watch face (Customize › a slot › DailyFlow).
 * The watch face draws them; these provide the data.
 *  - Now: what is on, a live countdown to its end and a ring that moves by itself.
 *  - Next: the next block and when it starts.
 *  - Start / stop and Start next: buttons; a tap opens the slide-to-confirm screen.
 * Now and Next are timelines: the whole rest of the day is handed over at once, so they switch
 * exactly at block boundaries without waking the app.
 */
private fun text(s: String) = PlainComplicationText.Builder(s).build()

/**
 * “37m” / “1h05”: compact time left for arcs (they fit ~4 characters, like “21%”).
 * A dynamic string, so the watch recomputes it every minute on its own.
 */
private fun compactCountdownTo(end: Instant, suffix: String = ""): ComplicationText {
    val left = DynamicInstant.platformTimeWithSecondsPrecision().durationUntil(DynamicInstant.withSecondsPrecision(end))
    // Rounded up, like a countdown should be (at 0:30 left it still says 1m).
    val mins = left.toIntSeconds().plus(59).div(60)
    val twoDigits = DynamicInt32.IntFormatter.Builder().setMinIntegerDigits(2).build()
    val dynamic = DynamicString.onCondition(mins.lt(60))
        .use(mins.format().concat(DynamicString.constant("m")))
        .elseUse(mins.div(60).format().concat(DynamicString.constant("h")).concat(mins.rem(60).format(twoDigits)))
        .concat(DynamicString.constant(suffix))
    val m = ((end.toEpochMilli() - System.currentTimeMillis() + 59_999) / 60_000).coerceAtLeast(0)
    return DynamicComplicationText(dynamic, (if (m < 60) "${m}m" else "${m / 60}h%02d".format(m % 60)) + suffix)
}

private fun icon(context: Context, res: Int) = MonochromaticImage.Builder(Icon.createWithResource(context, res)).build()

private fun open(context: Context): PendingIntent =
    PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)

private fun confirm(context: Context, action: String): PendingIntent =
    PendingIntent.getActivity(context, action.hashCode(), Intent(context, ConfirmActivity::class.java).putExtra(ConfirmActivity.ACTION, action)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

private val background = CoroutineScope(SupervisorJob() + Dispatchers.IO)

/**
 * Cache first: answer right away with the last snapshot and refresh in the background (the
 * complications are redrawn only if something changed). Only the very first time do we wait a little.
 */
private suspend fun snapshot(context: Context): Snapshot? {
    val app = context.applicationContext
    FaceData.load(app)
    val cached = FaceData.snapshot
    if (cached != null) {
        if (FaceData.ageMs > 60_000) background.launch { if (FaceData.refresh(app, 60_000)) Sources.refreshAll(app) }
        return cached
    }
    if (withTimeoutOrNull(3_000) { FaceData.refresh(app) } == null) background.launch { if (FaceData.refresh(app)) Sources.refreshAll(app) }
    return FaceData.snapshot
}

/** Before the first data arrives: the watch face draws this as its loading placeholder. */
private fun loading(type: ComplicationType): ComplicationData = NoDataComplicationData(
    when (type) {
        ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(RangedValueComplicationData.PLACEHOLDER, 0f, 100f, ComplicationText.EMPTY)
            .setMonochromaticImage(MonochromaticImage.PLACEHOLDER).build()
        ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(ComplicationText.PLACEHOLDER, ComplicationText.EMPTY).setTitle(ComplicationText.PLACEHOLDER).build()
        ComplicationType.MONOCHROMATIC_IMAGE -> MonochromaticImageComplicationData.Builder(MonochromaticImage.PLACEHOLDER, ComplicationText.EMPTY).build()
        ComplicationType.SMALL_IMAGE -> SmallImageComplicationData.Builder(SmallImage.PLACEHOLDER, ComplicationText.EMPTY).build()
        else -> ShortTextComplicationData.Builder(ComplicationText.PLACEHOLDER, ComplicationText.EMPTY).setTitle(ComplicationText.PLACEHOLDER).build()
    },
)

/** The rest of the day as intervals (split at every block start and end), each with its data; the current one is the default. */
private fun Snapshot.timeline(m: Float, current: ComplicationData, at: (Float) -> ComplicationData): ComplicationDataTimeline {
    val points = timeline.flatMap { listOf(it.start.toFloat(), it.end.toFloat()) }.filter { it > m }.distinct().sorted()
    val entries = points.mapIndexed { i, start ->
        val end = points.getOrNull(i + 1) ?: (start + 24 * 60)
        TimelineEntry(TimeInterval(instantOf(start), instantOf(end)), at(start + 0.5f))
    }
    return ComplicationDataTimeline(current, entries)
}

/** NOW — SHORT_TEXT “42m / Work”, RANGED_VALUE ring + the same, LONG_TEXT “Work · until 11:00”. */
class NowSource : SuspendingTimelineComplicationDataSourceService() {
    private fun data(s: Snapshot?, m: Float, type: ComplicationType, live: Boolean): ComplicationData {
        if (s == null) return if (Api.paired(this)) loading(type) else simple(type, "Pair", "DailyFlow")
        val now = s.nowAt(m)
        val next = s.nextAt(m)
        val running = if (live) s.runningTitle else null
        val name = running ?: now?.title ?: "Free"
        val until: Block? = now ?: next
        // Running with nothing planned right now: the time that is beyond the plan, “+36m” (note #36).
        if (live && running != null && now == null) {
            val since = s.runningSince?.split(":")?.let { (it[0].toInt() * 60 + it[1].toInt()) }
            val elapsed = if (since != null) ((m.toInt() % 1440) - since + 1440) % 1440 else 0
            val lastEnd = s.timeline.filter { it.end <= m }.maxOfOrNull { it.end }
            val over = if (lastEnd != null) minOf(elapsed, (m - lastEnd).toInt()) else elapsed
            val e = "+" + (if (over < 60) "${over}m" else "${over / 60}h%02d".format(over % 60))
            val d = text("$running: $e beyond the plan")
            return when (type) {
                ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(0f, 0f, 1f, d).setText(text(e)).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
                ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text("● $running · $e"), d).setTitle(text("BEYOND PLAN")).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
                else -> ShortTextComplicationData.Builder(text(e), d).setTitle(text("● $running")).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
            }
        }
        if (until == null) {
            // Nothing planned, but something is running: show how long, not a dash.
            val since = s.runningSince?.split(":")?.let { (it[0].toInt() * 60 + it[1].toInt()) }
            if (running != null && since != null) {
                val el = ((m.toInt() % 1440) - since + 1440) % 1440
                val e = if (el < 60) "${el}m" else "${el / 60}h%02d".format(el % 60)
                return when (type) {
                    ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(0f, 0f, 1f, text("$running · $e")).setText(text(e)).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
                    ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text("● $running · $e"), text("$running for $e")).setTitle(text("NOW")).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
                    else -> ShortTextComplicationData.Builder(text(e), text("$running for $e")).setTitle(text("● $running")).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
                }
            }
            return simple(type, "—", name)
        }
        val endsAt = s.instantOf((if (now != null) now.end else until.start).toFloat())
        // State is only known for the current interval (live); later timeline entries just count down.
        val isRunning = live && s.runningTitle != null
        val knownIdle = live && s.runningTitle == null && now != null
        // Note #45: still on a block that already ended while the next one is due. The countdown would be the next
        // block's, so show how far past the first one's end you are (“+10m”) and which one is waiting.
        val sinceMin = s.runningSince?.split(":")?.let { it[0].toInt() * 60 + it[1].toInt() }
        val overran = if (isRunning && now != null && now.title != running) s.timeline.lastOrNull { it.title == running && it.end <= m && (sinceMin == null || sinceMin <= it.end) } else null
        val over = overran?.let { (m - it.end).toInt() }?.takeIf { it > 0 }
        val overText = over?.let { "+" + (if (it < 60) "${it}m" else "${it / 60}h%02d".format(it % 60)) }
        val desc = if (overText != null) text("$name $overText past its end, ${now!!.title} is waiting") else text("$name until ${if (now != null) now.endLabel else until.startLabel}")
        if (overText != null && type != ComplicationType.RANGED_VALUE) return when (type) {
            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text("● $name $overText, then ${now!!.title}"), desc)
                .setTitle(text("BEYOND PLAN")).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
            else -> ShortTextComplicationData.Builder(text(overText), desc)
                .setTitle(text("● $name")).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
        }
        return when (type) {
            ComplicationType.RANGED_VALUE -> {
                // Free time: an empty ring, the countdown to the next block.
                if (now == null) return RangedValueComplicationData.Builder(0f, 0f, 1f, desc).setText(compactCountdownTo(endsAt)).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
                val start = s.instantOf(now.start.toFloat())
                val total = (endsAt.epochSecond - start.epochSecond).coerceAtLeast(60).toFloat()
                val elapsedNow = ((System.currentTimeMillis() / 1000 - start.epochSecond).toFloat()).coerceIn(0f, total)
                // Seconds into the block, computed by the watch every frame: the ring moves without updates.
                val remaining = DynamicInstant.platformTimeWithSecondsPrecision().durationUntil(DynamicInstant.withSecondsPrecision(endsAt)).toIntSeconds().asFloat()
                // Only the time left (short, fits where “21%” goes); the block's name gets cut on arcs and lives in the inner slot.
                RangedValueComplicationData.Builder(DynamicFloat.constant(total).minus(remaining), elapsedNow, 0f, total, desc)
                    .setText(if (overText != null) text(overText) else compactCountdownTo(endsAt)).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
            }
            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text(if (isRunning && s.runningLine != null) "● $name · ${s.runningLine}" else "${if (isRunning) "● " else ""}$name · until ${if (now != null) now.endLabel else until.startLabel}"), desc)
                .setTitle(text(when { knownIdle -> "NOT STARTED"; now != null -> "NOW"; else -> "FREE" })).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
            // Running: “● Maker / 34m left”. Planned but nothing running: “Maker / not started”.
            else -> ShortTextComplicationData.Builder(if (knownIdle) text("not started") else compactCountdownTo(endsAt, " left"), desc)
                .setTitle(text(if (isRunning) "● $name" else name)).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
        }
    }

    private fun simple(type: ComplicationType, short: String, title: String): ComplicationData = when (type) {
        ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text(title), text(title)).setTapAction(open(this)).build()
        // No title on the ring: it would be drawn as curved text and get cut (note #36).
        ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(0f, 0f, 1f, text(title)).setText(text(short)).setTapAction(open(this)).build()
        else -> ShortTextComplicationData.Builder(text(short), text(title)).setTitle(text(title)).setTapAction(open(this)).build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationDataTimeline? {
        val s = snapshot(this) ?: return ComplicationDataTimeline(data(null, 0f, request.complicationType, false), emptyList())
        val m = s.minuteAt(System.currentTimeMillis())
        // Now also knows what is running; later intervals follow the plan.
        return s.timeline(m, data(s, m, request.complicationType, live = true)) { data(s, it, request.complicationType, live = false) }
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData = when (type) {
        ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(18f, 0f, 60f, text("Work")).setText(text("42m")).setMonochromaticImage(icon(this, R.drawable.ic_now)).build()
        ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text("Work · until 11:00"), text("Now")).setTitle(text("NOW")).build()
        else -> ShortTextComplicationData.Builder(text("−42min"), text("Work")).setTitle(text("Work")).build()
    }
}

/** NEXT — SHORT_TEXT “11:00 / Guitar”, LONG_TEXT “Guitar or Piano” titled “NEXT · 11:00”. */
class NextSource : SuspendingTimelineComplicationDataSourceService() {
    private fun data(s: Snapshot?, m: Float, type: ComplicationType, live: Boolean = false): ComplicationData {
        if (s == null && Api.paired(this)) return loading(type)
        val next = s?.nextAt(m)
        // Nothing next (or asleep): the Next slot becomes the bed — a moon to log going to sleep, a sun to log waking up (note #37).
        if (s != null && (s.sleeping || next == null)) {
            val asleep = s.sleeping
            val res = if (asleep) R.drawable.ic_sun else R.drawable.ic_moon
            val label = if (asleep) "Wake" else "Sleep"
            val desc = text(if (asleep) "Log that you woke up" else "Log that you went to sleep")
            val tap = confirm(this, if (asleep) "wake" else "sleep")
            return if (type == ComplicationType.LONG_TEXT)
                LongTextComplicationData.Builder(text(if (asleep) "I'm awake" else "Going to sleep"), desc).setTitle(text("NEXT · ${if (asleep) "☀" else "🌙"}")).setMonochromaticImage(icon(this, res)).setTapAction(tap).build()
            else ShortTextComplicationData.Builder(text(if (asleep) "☀️" else "🌙"), desc).setTitle(text(label)).setMonochromaticImage(icon(this, res)).setTapAction(tap).build()
        }
        // Note #45: still on a block that ended while the next one is due — the Next slot shows the one that is waiting and how late it is.
        val waiting = s?.nowAt(m)
        val running = if (live) s?.runningTitle else null
        val sinceMin = s?.runningSince?.split(":")?.let { it[0].toInt() * 60 + it[1].toInt() }
        if (s != null && waiting != null && running != null && waiting.title != running &&
            s.timeline.any { it.title == running && it.end <= m && (sinceMin == null || sinceMin <= it.end) }) {
            val late = (m - waiting.start).toInt().coerceAtLeast(0)
            val lateText = if (late < 60) "${late}m late" else "${late / 60}h%02d late".format(late % 60)
            val d = text("${waiting.title} is waiting, $lateText")
            return if (type == ComplicationType.LONG_TEXT)
                LongTextComplicationData.Builder(text(waiting.title), d).setTitle(text("NEXT · $lateText")).setMonochromaticImage(icon(this, R.drawable.ic_next)).setTapAction(open(this)).build()
            else ShortTextComplicationData.Builder(text(lateText), d).setTitle(text(waiting.title)).setMonochromaticImage(icon(this, R.drawable.ic_next)).setTapAction(open(this)).build()
        }
        val name = when { s == null -> "Pair"; next == null -> "Done"; else -> next.title }
        val time = next?.startLabel ?: "—"
        val desc = text(if (next != null) "Next $name at $time" else "Nothing else today")
        return if (type == ComplicationType.LONG_TEXT)
            LongTextComplicationData.Builder(text(if (next != null) name else "Nothing else today"), desc).setTitle(text(if (next != null) "NEXT · $time" else "NEXT"))
                .setMonochromaticImage(icon(this, R.drawable.ic_next)).setTapAction(open(this)).build()
        else ShortTextComplicationData.Builder(text(time), desc).setTitle(text(name)).setMonochromaticImage(icon(this, R.drawable.ic_next)).setTapAction(open(this)).build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationDataTimeline? {
        val s = snapshot(this) ?: return ComplicationDataTimeline(data(null, 0f, request.complicationType), emptyList())
        val m = s.minuteAt(System.currentTimeMillis())
        return s.timeline(m, data(s, m, request.complicationType, true)) { data(s, it, request.complicationType) }
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData =
        if (type == ComplicationType.LONG_TEXT) LongTextComplicationData.Builder(text("Guitar or Piano"), text("Next")).setTitle(text("NEXT · 11:00")).build()
        else ShortTextComplicationData.Builder(text("11:00"), text("Next")).setTitle(text("Guitar")).build()
}

/** Start / stop: ▶ starts the block on now, ■ stops what is running. */
class ControlSource : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData {
        val snap = snapshot(this) ?: return if (Api.paired(this)) loading(request.complicationType) else button(this, request.complicationType, R.drawable.ic_play, "Pair", null)
        val running = snap.runningTitle != null
        return button(this, request.complicationType, if (running) R.drawable.ic_stop else R.drawable.ic_play, if (running) "Stop" else "Start", confirm(this, if (running) "stop" else "start"))
    }
    override fun getPreviewData(type: ComplicationType): ComplicationData = button(this, type, R.drawable.ic_play, "Start", null)
}

/** Start next: begin the next block now. */
class SkipSource : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData =
        button(this, request.complicationType, R.drawable.ic_skip, "Next", confirm(this, "next"))
    override fun getPreviewData(type: ComplicationType): ComplicationData = button(this, type, R.drawable.ic_skip, "Next", null)
}

private fun button(context: Context, type: ComplicationType, res: Int, label: String, tap: PendingIntent?): ComplicationData = when (type) {
    ComplicationType.MONOCHROMATIC_IMAGE -> MonochromaticImageComplicationData.Builder(icon(context, res), text(label)).setTapAction(tap).build()
    ComplicationType.SMALL_IMAGE -> SmallImageComplicationData.Builder(SmallImage.Builder(Icon.createWithResource(context, res), SmallImageType.ICON).build(), text(label)).setTapAction(tap).build()
    ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(text(label), text(label)).setMonochromaticImage(icon(context, res)).setTapAction(tap).build()
    else -> NoDataComplicationData()
}

/** Ask the system to refresh every DailyFlow complication (after an action on the watch or pairing). */
object Sources {
    fun refreshAll(context: Context) {
        for (cls in listOf(NowSource::class.java, NextSource::class.java, ControlSource::class.java, SkipSource::class.java)) {
            ComplicationDataSourceUpdateRequester.create(context, ComponentName(context, cls)).requestUpdateAll()
        }
    }
}
