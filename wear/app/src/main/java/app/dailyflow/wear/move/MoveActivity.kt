package app.dailyflow.wear.move

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * The move break: a little figure stretching, a 2-minute ring, the steps you take counted live,
 * and a small celebration at the end. Logged per block (Move.logBreak).
 */
class MoveActivity : ComponentActivity() {
    companion object { const val BLOCK = "block"; const val SECONDS = 120 }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Move.cancel(this)
        val block = intent.getStringExtra(BLOCK)
        setContent { MoveBreak(block) { steps, sec -> Move.logBreak(this, block, steps, sec); finish() } }
    }
}

private val Green = Color(0xFF19B66A)
private val Mint = Color(0xFF73E3AA)

@Composable
private fun MoveBreak(block: String?, onDone: (steps: Long, seconds: Int) -> Unit) {
    val context = LocalContext.current
    val haptics = LocalHapticFeedback.current
    var elapsed by remember { mutableIntStateOf(0) }
    var steps by remember { mutableLongStateOf(0) }
    var finished by remember { mutableStateOf(false) }

    // Live steps during the break (the counter's first value is the baseline).
    DisposableEffect(Unit) {
        val sm = context.getSystemService(SensorManager::class.java)
        val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        var base = -1L
        val l = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) { val v = e.values[0].toLong(); if (base < 0) base = v; steps = v - base }
            override fun onAccuracyChanged(s: Sensor?, a: Int) {}
        }
        if (sensor != null) sm.registerListener(l, sensor, SensorManager.SENSOR_DELAY_UI)
        onDispose { sm.unregisterListener(l) }
    }
    LaunchedEffect(Unit) {
        while (elapsed < MoveActivity.SECONDS) { delay(1000); elapsed++ }
        finished = true
        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
    }

    val t = rememberInfiniteTransition(label = "move")
    val swing by t.animateFloat(-1f, 1f, infiniteRepeatable(tween(650, easing = LinearEasing), RepeatMode.Reverse), label = "swing")
    val pulse by t.animateFloat(0f, 1f, infiniteRepeatable(tween(1600, easing = LinearEasing)), label = "pulse")
    val confetti = remember { List(26) { Triple(Random.nextFloat() * 360f, 0.55f + Random.nextFloat() * 0.45f, Random.nextInt(4)) } }
    val colors = listOf(Mint, Color(0xFF60AEFF), Color(0xFFE5BA43), Color(0xFFDC3D92))

    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF041A10), Color(0xFF0C3B26)))), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val c = Offset(size.width / 2, size.height / 2)
            val r = size.minDimension / 2 - 10f
            // 2-minute ring.
            drawArc(Color(0x3319B66A), -90f, 360f, false, topLeft = Offset(c.x - r, c.y - r), size = Size(2 * r, 2 * r), style = Stroke(10f))
            drawArc(Green, -90f, 360f * elapsed / MoveActivity.SECONDS, false, topLeft = Offset(c.x - r, c.y - r), size = Size(2 * r, 2 * r), style = Stroke(10f, cap = StrokeCap.Round))
            // Breathing halo.
            drawCircle(Green.copy(alpha = 0.18f * (1 - pulse)), radius = 60f + 70f * pulse, center = Offset(c.x, c.y - 40f))
            // The stretching figure (arms swing up and down, a little bounce).
            val bob = if (finished) 0f else 6f * swing
            val head = Offset(c.x, c.y - 92f + bob)
            val neck = Offset(c.x, c.y - 70f + bob)
            val hip = Offset(c.x, c.y - 20f + bob)
            val stroke = 9f
            drawCircle(Mint, 15f, head)
            drawLine(Mint, neck, hip, stroke, StrokeCap.Round)
            val armA = if (finished) -2.4f else -0.4f - 1.7f * (swing + 1) / 2
            // Arms sweep from out to the side up to overhead; legs stay planted.
            for (side in listOf(-1f, 1f)) {
                drawLine(Mint, Offset(neck.x, neck.y + 6f), Offset(neck.x + side * 30f * cos(armA), neck.y + 6f - 30f * sin(-armA)), stroke, StrokeCap.Round)
                drawLine(Mint, hip, Offset(hip.x + side * 18f, hip.y + 40f - bob), stroke, StrokeCap.Round)
            }
            // Celebration.
            if (finished) confetti.forEachIndexed { i, (a, d, k) ->
                val p = Offset(c.x + cos(Math.toRadians(a.toDouble())).toFloat() * r * d * (0.6f + 0.4f * pulse), c.y + sin(Math.toRadians(a.toDouble())).toFloat() * r * d * (0.6f + 0.4f * pulse))
                drawRect(colors[(k + i) % colors.size], topLeft = p, size = Size(9f, 5f))
            }
        }
        Column(Modifier.padding(top = 120.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (!finished) {
                val left = MoveActivity.SECONDS - elapsed
                Text("%d:%02d".format(left / 60, left % 60), color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text(if (steps > 0) "+$steps steps" else "Stand up & walk", color = Mint, fontSize = 14.sp)
                Text("Done", color = Color(0xFFB5E9CC), fontSize = 13.sp,
                    modifier = Modifier.padding(top = 6.dp).background(Color(0x3319B66A), RoundedCornerShape(50)).clickable { onDone(steps, elapsed) }.padding(horizontal = 16.dp, vertical = 6.dp))
            } else {
                Text("Nice! 🎉", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                Text("+$steps steps${block?.let { " · back to $it" } ?: ""}", color = Mint, fontSize = 13.sp)
                Box(Modifier.padding(top = 6.dp).size(width = 92.dp, height = 34.dp).background(Green, RoundedCornerShape(50)).clickable { onDone(steps, elapsed) }, contentAlignment = Alignment.Center) {
                    Text("Back", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
