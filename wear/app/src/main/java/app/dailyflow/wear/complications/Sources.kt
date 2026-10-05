package app.dailyflow.wear.complications

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.wear.protolayout.expression.DynamicBuilders.DynamicFloat
import androidx.wear.protolayout.expression.DynamicBuilders.DynamicInstant
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationText
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.CountDownTimeReference
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
import androidx.wear.watchface.complications.data.TimeDifferenceComplicationText
import androidx.wear.watchface.complications.data.TimeDifferenceStyle
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
import java.util.concurrent.TimeUnit
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

private fun countdownTo(end: Instant): ComplicationText =
    TimeDifferenceComplicationText.Builder(TimeDifferenceStyle.SHORT_SINGLE_UNIT, CountDownTimeReference(end))
        .setMinimumTimeUnit(TimeUnit.MINUTES).build()

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

/** Instant of a logical-day minute (block minutes count from the logical day's midnight). */
private fun Snapshot.instantOf(min: Float): Instant =
    runCatching { LocalDate.parse(day).atStartOfDay(ZoneId.systemDefault()).toInstant().plusSeconds((min * 60).toLong()) }
        .getOrElse { Instant.ofEpochMilli(generatedAt + ((min - minute) * 60_000).toLong()) }

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
        if (until == null) return simple(type, "—", name)
        val endsAt = s.instantOf((if (now != null) now.end else until.start).toFloat())
        val count = countdownTo(endsAt)
        val desc = text("$name until ${if (now != null) now.endLabel else until.startLabel}")
        return when (type) {
            ComplicationType.RANGED_VALUE -> {
                // Free time: an empty ring, the countdown to the next block.
                if (now == null) return RangedValueComplicationData.Builder(0f, 0f, 1f, desc).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
                val start = s.instantOf(now.start.toFloat())
                val total = (endsAt.epochSecond - start.epochSecond).coerceAtLeast(60).toFloat()
                val elapsedNow = ((System.currentTimeMillis() / 1000 - start.epochSecond).toFloat()).coerceIn(0f, total)
                // Seconds into the block, computed by the watch every frame: the ring moves without updates.
                val remaining = DynamicInstant.platformTimeWithSecondsPrecision().durationUntil(DynamicInstant.withSecondsPrecision(endsAt)).toIntSeconds().asFloat()
                // No text: on arcs it gets cut ("Make…"); the ring and the Now glyph say enough, the name lives in the inner slot.
                RangedValueComplicationData.Builder(DynamicFloat.constant(total).minus(remaining), elapsedNow, 0f, total, desc)
                    .setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
            }
            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text("$name · until ${if (now != null) now.endLabel else until.startLabel}"), desc)
                .setTitle(text(if (now != null) "NOW" else "FREE")).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
            else -> ShortTextComplicationData.Builder(count, desc).setTitle(text(name)).setMonochromaticImage(icon(this, R.drawable.ic_now)).setTapAction(open(this)).build()
        }
    }

    private fun simple(type: ComplicationType, short: String, title: String): ComplicationData = when (type) {
        ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text(title), text(title)).setTapAction(open(this)).build()
        ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(0f, 0f, 1f, text(title)).setText(text(short)).setTitle(text(title)).setTapAction(open(this)).build()
        else -> ShortTextComplicationData.Builder(text(short), text(title)).setTitle(text(title)).setTapAction(open(this)).build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationDataTimeline? {
        val s = snapshot(this) ?: return ComplicationDataTimeline(data(null, 0f, request.complicationType, false), emptyList())
        val m = s.minuteAt(System.currentTimeMillis())
        // Now also knows what is running; later intervals follow the plan.
        return s.timeline(m, data(s, m, request.complicationType, live = true)) { data(s, it, request.complicationType, live = false) }
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData = when (type) {
        ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(18f, 0f, 60f, text("Work")).setMonochromaticImage(icon(this, R.drawable.ic_now)).build()
        ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(text("Work · until 11:00"), text("Now")).setTitle(text("NOW")).build()
        else -> ShortTextComplicationData.Builder(text("42m"), text("Work")).setTitle(text("Work")).build()
    }
}

/** NEXT — SHORT_TEXT “11:00 / Guitar”, LONG_TEXT “Guitar or Piano” titled “NEXT · 11:00”. */
class NextSource : SuspendingTimelineComplicationDataSourceService() {
    private fun data(s: Snapshot?, m: Float, type: ComplicationType): ComplicationData {
        if (s == null && Api.paired(this)) return loading(type)
        val next = s?.nextAt(m)
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
        return s.timeline(m, data(s, m, request.complicationType)) { data(s, it, request.complicationType) }
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
