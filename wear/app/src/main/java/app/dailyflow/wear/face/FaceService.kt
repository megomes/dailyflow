package app.dailyflow.wear.face

import android.content.ComponentName
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.RectF
import android.view.SurfaceHolder
import androidx.wear.watchface.CanvasComplication
import androidx.wear.watchface.CanvasComplicationFactory
import androidx.wear.watchface.ComplicationSlot
import androidx.wear.watchface.ComplicationSlotsManager
import androidx.wear.watchface.RenderParameters
import androidx.wear.watchface.TapEvent
import androidx.wear.watchface.TapType
import androidx.wear.watchface.WatchFace
import androidx.wear.watchface.WatchFaceService
import androidx.wear.watchface.WatchFaceType
import androidx.wear.watchface.WatchState
import androidx.wear.watchface.complications.ComplicationSlotBounds
import androidx.wear.watchface.complications.DefaultComplicationDataSourcePolicy
import androidx.wear.watchface.complications.SystemDataSources
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.NoDataComplicationData
import androidx.wear.watchface.style.CurrentUserStyleRepository
import app.dailyflow.wear.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.ZonedDateTime
import kotlin.math.hypot

/** The DailyFlow watch face service: four arc complications, the day in the middle, slide-to-confirm controls. */
class FaceService : WatchFaceService() {
    companion object {
        const val SLOT_TL = 1; const val SLOT_TR = 2; const val SLOT_BL = 3; const val SLOT_BR = 4
        const val LEFT_X = 100f; const val RIGHT_X = 380f; const val SIDE_Y = 215f; const val SIDE_R = 57f
        private const val SAMSUNG_WEATHER = "com.samsung.android.watch.weather"
        private const val SAMSUNG_HEALTH = "com.samsung.android.wear.shealth"
        private val TYPES = listOf(ComplicationType.RANGED_VALUE, ComplicationType.GOAL_PROGRESS, ComplicationType.SHORT_TEXT)
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    /** The face draws the arcs itself from the data; this only keeps the latest data per slot. */
    private class Holder(private val invalidate: () -> Unit) : CanvasComplication {
        private var data: ComplicationData = NoDataComplicationData()
        override fun render(canvas: Canvas, bounds: Rect, zonedDateTime: ZonedDateTime, renderParameters: RenderParameters, slotId: Int) {}
        override fun drawHighlight(canvas: Canvas, bounds: Rect, boundsType: Int, zonedDateTime: ZonedDateTime, color: Int) {}
        override fun getData(): ComplicationData = data
        override fun loadData(complicationData: ComplicationData, loadDrawablesAsynchronous: Boolean) { data = complicationData; invalidate() }
    }

    override fun createComplicationSlotsManager(currentUserStyleRepository: CurrentUserStyleRepository): ComplicationSlotsManager {
        val factory = CanvasComplicationFactory { _, listener -> Holder { listener.onInvalidate() } }
        fun slot(id: Int, rect: RectF, primary: ComponentName, type: ComplicationType, fallback: Int, fallbackType: ComplicationType) =
            ComplicationSlot.createRoundRectComplicationSlotBuilder(id, factory, TYPES, DefaultComplicationDataSourcePolicy(primary, type, fallback, fallbackType), ComplicationSlotBounds(rect)).build()
        // Same sources as the original face: chance of rain, UV, battery, steps (system ones if Samsung's do not share).
        return ComplicationSlotsManager(listOf(
            slot(SLOT_TL, RectF(0.02f, 0.03f, 0.34f, 0.40f), ComponentName(SAMSUNG_WEATHER, "$SAMSUNG_WEATHER.complication.PrecipitationComplicationService"), ComplicationType.RANGED_VALUE, SystemDataSources.DATA_SOURCE_DATE, ComplicationType.SHORT_TEXT),
            slot(SLOT_TR, RectF(0.66f, 0.03f, 0.98f, 0.40f), ComponentName(SAMSUNG_WEATHER, "$SAMSUNG_WEATHER.complication.UvIndexComplicationService"), ComplicationType.RANGED_VALUE, SystemDataSources.DATA_SOURCE_SUNRISE_SUNSET, ComplicationType.SHORT_TEXT),
            slot(SLOT_BL, RectF(0.02f, 0.60f, 0.34f, 0.97f), ComponentName("com.google.android.clockwork.sysui", "com.google.android.clockwork.sysui.experiences.complications.providers.BatteryProviderService"), ComplicationType.RANGED_VALUE, SystemDataSources.DATA_SOURCE_WATCH_BATTERY, ComplicationType.RANGED_VALUE),
            slot(SLOT_BR, RectF(0.66f, 0.60f, 0.98f, 0.97f), ComponentName(SAMSUNG_HEALTH, "$SAMSUNG_HEALTH.complications.steps.StepsComplicationProviderService"), ComplicationType.RANGED_VALUE, SystemDataSources.DATA_SOURCE_STEP_COUNT, ComplicationType.SHORT_TEXT),
        ), currentUserStyleRepository)
    }

    override suspend fun createWatchFace(
        surfaceHolder: SurfaceHolder,
        watchState: WatchState,
        complicationSlotsManager: ComplicationSlotsManager,
        currentUserStyleRepository: CurrentUserStyleRepository,
    ): WatchFace {
        val renderer = FaceRenderer(this, surfaceHolder, watchState, complicationSlotsManager, currentUserStyleRepository)
        // Fresh data when the face becomes visible (at most once a minute) and every 5 minutes while it is.
        scope.launch { watchState.isVisible.collect { if (it == true) { FaceData.refresh(applicationContext, 60_000); renderer.invalidate() } } }
        scope.launch {
            while (true) {
                delay(5 * 60_000L)
                if (watchState.isVisible.value == true && FaceData.refresh(applicationContext)) renderer.invalidate()
            }
        }
        return WatchFace(WatchFaceType.DIGITAL, renderer).setTapListener(object : WatchFace.TapListener {
            override fun onTapEvent(tapType: Int, tapEvent: TapEvent, complicationSlot: ComplicationSlot?) {
                if (tapType != TapType.UP || complicationSlot != null) return
                val k = 480f / renderer.screenBounds.width()
                val x = tapEvent.xPos * k; val y = tapEvent.yPos * k
                val snap = FaceData.snapshot
                val target = when {
                    hypot(x - LEFT_X, y - SIDE_Y) <= SIDE_R + 8 -> if (snap?.runningTitle != null) "stop" else "start"
                    hypot(x - RIGHT_X, y - SIDE_Y) <= SIDE_R + 8 -> "next"
                    hypot(x - 240f, y - 215f) <= 75f || (y in 60f..150f && x in 100f..380f) -> "open"
                    else -> null
                } ?: return
                val intent = if (target == "open") Intent(this@FaceService, MainActivity::class.java)
                else Intent(this@FaceService, ConfirmActivity::class.java).putExtra(ConfirmActivity.ACTION, target)
                startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
        })
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
