package app.dailyflow.wear.complications

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.MonochromaticImage
import androidx.wear.watchface.complications.data.MonochromaticImageComplicationData
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.TimeInterval
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import androidx.wear.watchface.complications.datasource.ComplicationDataTimeline
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.SuspendingTimelineComplicationDataSourceService
import androidx.wear.watchface.complications.datasource.TimelineEntry
import app.dailyflow.wear.MainActivity
import app.dailyflow.wear.R
import app.dailyflow.wear.Snapshot
import app.dailyflow.wear.face.ConfirmActivity
import app.dailyflow.wear.face.FaceData
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Data for the DailyFlow watch face (Watch Face Format draws; these only provide the day):
 * NEXT and NOW as timelines (they switch exactly at block boundaries without waking us up),
 * and the two buttons, whose taps open the slide-to-confirm screen.
 */
private fun text(s: String) = PlainComplicationText.Builder(s).build()

private fun open(context: Context): PendingIntent =
    PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)

private fun confirm(context: Context, action: String): PendingIntent =
    PendingIntent.getActivity(context, action.hashCode(), Intent(context, ConfirmActivity::class.java).putExtra(ConfirmActivity.ACTION, action)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

private suspend fun snapshot(context: Context): Snapshot? {
    FaceData.load(context)
    FaceData.refresh(context.applicationContext, maxAgeMs = 60_000)
    return FaceData.snapshot
}

/** Instant of a logical-day minute (block minutes count from the logical day's midnight). */
private fun Snapshot.instantOf(min: Float): Instant =
    runCatching { LocalDate.parse(day).atStartOfDay(ZoneId.systemDefault()).toInstant().plusSeconds((min * 60).toLong()) }
        .getOrElse { Instant.ofEpochMilli(generatedAt + ((min - minute) * 60_000).toLong()) }

/** Moments after now where now/next change: every block start and end until the end of the day. */
private fun Snapshot.breakpoints(m: Float): List<Float> =
    timeline.flatMap { listOf(it.start.toFloat(), it.end.toFloat()) }.filter { it > m }.distinct().sorted()

/** Splits the rest of the day into intervals with their data; the current one is the default. */
private fun Snapshot.timeline(m: Float, at: (Float) -> ComplicationData): ComplicationDataTimeline {
    val points = breakpoints(m)
    val entries = points.mapIndexed { i, start ->
        val end = points.getOrNull(i + 1) ?: (start + 24 * 60)
        TimelineEntry(TimeInterval(instantOf(start), instantOf(end)), at(start + 0.5f))
    }
    return ComplicationDataTimeline(at(m), entries)
}

private fun hhmm(min: Int): String { val v = ((min % 1440) + 1440) % 1440; return "%02d:%02d".format(v / 60, v % 60) }

/** NEXT: title "NEXT  11:00", text "Guitar or Piano". */
class NextSource : SuspendingTimelineComplicationDataSourceService() {
    private fun data(s: Snapshot?, m: Float, type: ComplicationType): ComplicationData {
        val next = s?.nextAt(m)
        val title = when { s == null -> "DAILYFLOW"; next == null -> "LATER"; else -> "NEXT  ${next.startLabel}" }
        val body = when { s == null -> "Open to pair"; next == null -> "Nothing else today"; else -> next.title }
        return if (type == ComplicationType.SHORT_TEXT) ShortTextComplicationData.Builder(text(next?.startLabel ?: "—"), text(body)).setTitle(text(body)).setTapAction(open(this)).build()
        else LongTextComplicationData.Builder(text(body), text("$title $body")).setTitle(text(title)).setTapAction(open(this)).build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationDataTimeline? {
        val s = snapshot(this) ?: return ComplicationDataTimeline(data(null, 0f, request.complicationType), emptyList())
        val m = s.minuteAt(System.currentTimeMillis())
        return s.timeline(m) { data(s, it, request.complicationType) }
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData =
        if (type == ComplicationType.SHORT_TEXT) ShortTextComplicationData.Builder(text("11:00"), text("Next")).build()
        else LongTextComplicationData.Builder(text("Guitar or Piano"), text("Next")).setTitle(text("NEXT  11:00")).build()
}

/**
 * NOW: text = what is on (or running, when it differs from the plan), title = "until 11:00".
 * Ranged min/max are the block's start/end as minutes of the day, so the face moves the ring itself.
 */
class NowSource : SuspendingTimelineComplicationDataSourceService() {
    private fun data(s: Snapshot?, m: Float, type: ComplicationType, live: Boolean): ComplicationData {
        val now = s?.nowAt(m)
        val next = s?.nextAt(m)
        val running = if (live) s?.runningTitle else null
        val off = running != null && now != null && running != now.title
        val body = when { s == null -> "DailyFlow"; running != null -> running; now != null -> now.title; else -> "Free" }
        val title = when {
            s == null -> "pair the watch"
            off -> "plan: ${now!!.title}"
            now != null -> "until ${now.endLabel}"
            next != null -> "until ${next.startLabel}"
            else -> ""
        }
        if (type == ComplicationType.SHORT_TEXT) return ShortTextComplicationData.Builder(text(body), text(body)).setTitle(text(title)).setTapAction(open(this)).build()
        val min = now?.let { ((it.start % 1440) + 1440) % 1440 }?.toFloat() ?: 0f
        val max = now?.let { min + (it.end - it.start) } ?: 0f
        return RangedValueComplicationData.Builder(min, min, max.coerceAtLeast(min), text("$body $title"))
            .setText(text(body)).setTitle(text(title)).setTapAction(open(this)).build()
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationDataTimeline? {
        val s = snapshot(this) ?: return ComplicationDataTimeline(data(null, 0f, request.complicationType, false), emptyList())
        val m = s.minuteAt(System.currentTimeMillis())
        val t = s.timeline(m) { data(s, it, request.complicationType, live = false) }
        // The current interval also knows what is running; later ones follow the plan.
        return ComplicationDataTimeline(data(s, m, request.complicationType, live = true), t.timelineEntries)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData =
        RangedValueComplicationData.Builder(600f, 600f, 660f, text("Work")).setText(text("Work")).setTitle(text("until 11:00")).build()
}

/** Left button: ▶ start the block on now, or ■ stop what is running. */
class ControlSource : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData {
        val running = snapshot(this)?.runningTitle != null
        val action = if (running) "stop" else "start"
        return button(this, request.complicationType, if (running) R.drawable.ic_stop else R.drawable.ic_play, if (running) "Stop" else "Start", confirm(this, action))
    }
    override fun getPreviewData(type: ComplicationType): ComplicationData = button(this, type, R.drawable.ic_play, "Start", null)
}

/** Right button: start the next block now. */
class SkipSource : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData =
        button(this, request.complicationType, R.drawable.ic_skip, "Next", confirm(this, "next"))
    override fun getPreviewData(type: ComplicationType): ComplicationData = button(this, type, R.drawable.ic_skip, "Next", null)
}

private fun button(context: Context, type: ComplicationType, icon: Int, label: String, tap: PendingIntent?): ComplicationData {
    val image = MonochromaticImage.Builder(Icon.createWithResource(context, icon)).build()
    return when (type) {
        ComplicationType.MONOCHROMATIC_IMAGE -> MonochromaticImageComplicationData.Builder(image, text(label)).setTapAction(tap).build()
        ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(text(label), text(label)).setMonochromaticImage(image).setTapAction(tap).build()
        else -> NoDataComplicationData()
    }
}

/** Ask the system to refresh every DailyFlow complication (after an action or pairing). */
object Sources {
    fun refreshAll(context: Context) {
        for (cls in listOf(NowSource::class.java, NextSource::class.java, ControlSource::class.java, SkipSource::class.java)) {
            ComplicationDataSourceUpdateRequester.create(context, ComponentName(context, cls)).requestUpdateAll()
        }
    }
}
