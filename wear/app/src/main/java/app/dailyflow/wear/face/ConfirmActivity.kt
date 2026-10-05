package app.dailyflow.wear.face

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import app.dailyflow.wear.Api
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Asked from the watch face before acting: slide the knob to the end to confirm.
 * A tap or a short drag does nothing, so a brush of the wrist cannot start or stop anything.
 */
class ConfirmActivity : ComponentActivity() {
    companion object { const val ACTION = "action" }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val action = intent.getStringExtra(ACTION) ?: return finish()
        FaceData.load(this)
        val snap = FaceData.snapshot
        val m = snap?.minuteAt(System.currentTimeMillis()) ?: 0f
        val now = snap?.nowAt(m)
        val next = snap?.nextAt(m)
        val (verb, title, sub, color) = when (action) {
            "stop" -> Quad("Stop", snap?.runningTitle ?: "activity", snap?.runningSince?.let { "since $it" } ?: "", snap?.runningColor ?: 0xFF60AEFF.toInt())
            "next" -> Quad("Start now", next?.title ?: "next block", next?.let { "planned for ${it.startLabel}" } ?: "nothing next today", next?.color ?: 0xFF60AEFF.toInt())
            else -> Quad("Start", now?.title ?: "current block", now?.let { "until ${it.endLabel}" } ?: "nothing planned now", now?.color ?: 0xFF60AEFF.toInt())
        }
        val possible = when (action) { "stop" -> snap?.runningTitle != null; "next" -> next != null; else -> now != null }
        setContent { Confirm(verb, title, sub, Color(color), possible, onConfirm = { run(action) }, onCancel = { finish() }) }
    }

    private suspend fun run(action: String): String {
        val msg = Api(this).quick(action)
        FaceData.refresh(applicationContext)
        app.dailyflow.wear.complications.Sources.refreshAll(applicationContext)
        return msg
    }

    private data class Quad(val a: String, val b: String, val c: String, val d: Int)
}

private val Navy = Color(0xFF0B1835)
private val Blue = Color(0xFF60AEFF)
private val Light = Color(0xFFB5D4F6)

@Composable
private fun Confirm(verb: String, title: String, sub: String, accent: Color, possible: Boolean, onConfirm: suspend () -> String, onCancel: () -> Unit) {
    var result by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current
    Box(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF02060D), Color(0xFF0E2850)))),
        contentAlignment = Alignment.Center,
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 26.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(verb.uppercase(), color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            Text(title, color = Color.White, fontSize = 21.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
            if (sub.isNotEmpty()) Text(sub, color = Blue, fontSize = 13.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(16.dp))
            when {
                result != null -> Text(result!!, color = Light, fontSize = 15.sp, textAlign = TextAlign.Center)
                !possible -> Text("Nothing to do here", color = Light, fontSize = 14.sp)
                else -> SlideToConfirm(accent) {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    scope.launch {
                        result = if (verb == "Stop") "Stopping…" else "Starting…"
                        result = runCatching { onConfirm() }.getOrElse { "Could not reach DailyFlow" }
                        delay(900)
                        onCancel()
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            if (result == null) Text("Back to cancel", color = Color(0xFF8FA3BA), fontSize = 11.sp)
        }
    }
}

/** A track with a knob: drag it all the way right to confirm; letting go earlier springs it back. */
@Composable
private fun SlideToConfirm(accent: Color, onDone: () -> Unit) {
    val knob = 46.dp
    BoxWithConstraints(Modifier.fillMaxWidth().height(knob + 8.dp).background(Navy, RoundedCornerShape(50)).padding(4.dp)) {
        val density = LocalDensity.current
        val max = with(density) { (maxWidth - knob).toPx() }
        // The knob position is plain state updated synchronously while dragging, so the decision on
        // release reads the real position (async updates used to race and leave it stuck at the end).
        var pos by remember { mutableFloatStateOf(0f) }
        val back = remember { Animatable(0f) }
        var done by remember { mutableStateOf(false) }
        Text("slide  ›››", color = Light.copy(alpha = 0.55f + 0.45f * (pos / max.coerceAtLeast(1f))), fontSize = 13.sp,
            modifier = Modifier.align(Alignment.Center).padding(start = 36.dp))
        Box(
            Modifier
                .offset { IntOffset(pos.roundToInt(), 0) }
                .size(knob)
                .background(accent, CircleShape)
                .draggable(
                    orientation = Orientation.Horizontal,
                    enabled = !done,
                    state = rememberDraggableState { d -> pos = (pos + d).coerceIn(0f, max) },
                    onDragStarted = { back.stop() },
                    onDragStopped = {
                        if (pos >= max * 0.85f) { done = true; pos = max; onDone() }
                        else { back.snapTo(pos); back.animateTo(0f) { pos = value } }
                    },
                ),
            contentAlignment = Alignment.Center,
        ) { Text("›", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold) }
    }
}
