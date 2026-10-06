package app.dailyflow.wear

import androidx.concurrent.futures.SuspendToFutureAdapter
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DimensionBuilders.dp
import androidx.wear.protolayout.DimensionBuilders.expand
import androidx.wear.protolayout.DimensionBuilders.sp
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.ListenableFuture

private const val RES = "1"

/** Tile (spec §83): NOW · WORK · until 11:00 / NEXT · MUSIC · 11:00. Tap opens the app. */
class NowTileService : TileService() {
    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> =
        SuspendToFutureAdapter.launchFuture {
            val snap = Api(this@NowTileService).snapshot()
            TileBuilders.Tile.Builder()
                .setResourcesVersion(RES)
                .setFreshnessIntervalMillis(10 * 60 * 1000L)
                .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout(snap)))
                .build()
        }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> =
        SuspendToFutureAdapter.launchFuture { ResourceBuilders.Resources.Builder().setVersion(RES).build() }

    private fun text(value: String, size: Float, color: Int, bold: Boolean = false) =
        LayoutElementBuilders.Text.Builder()
            .setText(value)
            .setMaxLines(1)
            .setFontStyle(
                LayoutElementBuilders.FontStyle.Builder()
                    .setSize(sp(size))
                    .setColor(argb(color))
                    .setWeight(if (bold) LayoutElementBuilders.FONT_WEIGHT_BOLD else LayoutElementBuilders.FONT_WEIGHT_NORMAL)
                    .build(),
            )
            .build()

    private fun spacer(h: Float) = LayoutElementBuilders.Spacer.Builder().setHeight(dp(h)).build()

    private fun layout(s: Snapshot?): LayoutElementBuilders.LayoutElement {
        val muted = 0xFF717176.toInt()
        val text1 = 0xFFF3F3F4.toInt()
        val text2 = 0xFFA1A1A6.toInt()
        val col = LayoutElementBuilders.Column.Builder().setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
        if (s == null) {
            col.addContent(text("DailyFlow", 14f, text1, true)).addContent(text("Open the app to pair", 12f, text2))
        } else {
            val title = s.runningTitle ?: s.now?.title ?: "Nothing planned"
            val sub = when {
                s.focusTitle != null && s.focusLeftSec != null -> "focus · ${maxOf(0, s.focusLeftSec / 60)} min"
                s.runningLine != null -> s.runningLine
                s.runningSince != null -> "since ${s.runningSince}"
                s.now != null -> "until ${s.now.endLabel}"
                else -> ""
            }
            col.addContent(text("NOW", 11f, muted))
                .addContent(text(title.uppercase(), 18f, s.runningColor ?: s.now?.color ?: text1, true))
                .addContent(text(sub, 13f, text2))
                .addContent(spacer(10f))
            s.next?.let { n -> col.addContent(text("NEXT", 11f, muted)).addContent(text("${n.title.uppercase()} · ${n.startLabel}", 14f, text1)) }
        }
        val open = ActionBuilders.LaunchAction.Builder()
            .setAndroidActivity(ActionBuilders.AndroidActivity.Builder().setPackageName(packageName).setClassName(MainActivity::class.java.name).build())
            .build()
        return LayoutElementBuilders.Box.Builder()
            .setWidth(expand()).setHeight(expand())
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(ModifiersBuilders.Clickable.Builder().setId("open").setOnClick(open).build()).build())
            .addContent(col.build())
            .build()
    }
}
