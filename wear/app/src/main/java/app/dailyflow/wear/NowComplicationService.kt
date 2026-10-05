package app.dailyflow.wear

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService

/** Complication (spec §83): SHORT “Maker · 42m”, LONG “Next 11:00 Music”, RANGED progress through the block. */
class NowComplicationService : SuspendingComplicationDataSourceService() {

    private fun plain(s: String) = PlainComplicationText.Builder(s).build()

    private fun tap(): PendingIntent = PendingIntent.getActivity(
        this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val s = Api(this).snapshot()
        val title = s?.runningTitle ?: s?.now?.title ?: "DailyFlow"
        val desc = plain("Now: $title")
        return when (request.complicationType) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(plain(if (s?.now != null) "${s.remainingMin}m" else "—"), desc)
                .setTitle(plain(title.take(8))).setTapAction(tap()).build()
            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(
                plain(s?.next?.let { "Next ${it.startLabel} ${it.title}" } ?: "Nothing else today"), desc,
            ).setTitle(plain(if (s?.now != null) "$title · ${s.remainingMin}m" else title)).setTapAction(tap()).build()
            ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder((s?.progress ?: 0f).coerceIn(0f, 1f), 0f, 1f, desc)
                .setText(plain(if (s?.now != null) "${s.remainingMin}m" else "—")).setTitle(plain(title.take(8))).setTapAction(tap()).build()
            else -> null
        }
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        val desc = plain("Now: Maker")
        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(plain("42m"), desc).setTitle(plain("Maker")).build()
            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(plain("Next 11:00 Music"), desc).setTitle(plain("Maker · 42m")).build()
            ComplicationType.RANGED_VALUE -> RangedValueComplicationData.Builder(0.6f, 0f, 1f, desc).setText(plain("42m")).build()
            else -> null
        }
    }
}
