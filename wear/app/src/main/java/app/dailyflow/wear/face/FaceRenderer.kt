package app.dailyflow.wear.face

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.Icon
import android.text.TextUtils
import android.text.format.DateFormat
import android.view.SurfaceHolder
import androidx.wear.watchface.ComplicationSlotsManager
import androidx.wear.watchface.DrawMode
import androidx.wear.watchface.Renderer
import androidx.wear.watchface.WatchState
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.GoalProgressComplicationData
import androidx.wear.watchface.complications.data.RangedValueComplicationData
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.style.CurrentUserStyleRepository
import app.dailyflow.wear.Block
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * DailyFlow face, drawn after Samsung's "Circle Info Board": the four outer arcs (complications),
 * the big time with outlined seconds and the date stay as they are; the inner complications become
 * the day — NEXT on top, NOW in the middle circle, start/stop and "start next" on the sides.
 * Coordinates are in a 480×480 design space, scaled to the screen.
 */
class FaceRenderer(
    private val context: Context,
    surfaceHolder: SurfaceHolder,
    watchState: WatchState,
    private val slots: ComplicationSlotsManager,
    styles: CurrentUserStyleRepository,
) : Renderer.CanvasRenderer2<FaceRenderer.Assets>(surfaceHolder, styles, watchState, androidx.wear.watchface.CanvasType.HARDWARE, 1000L, false) {

    class Assets : SharedAssets { override fun onDestroy() {} }
    override suspend fun createSharedAssets() = Assets()

    // ── Palette sampled from the original (interactive / always-on) ──
    private object P {
        const val LIGHT = 0xFFB5D4F6.toInt();   const val LIGHT_AOD = 0xFF91AAC5.toInt()
        const val BLUE = 0xFF60AEFF.toInt();    const val BLUE_AOD = 0xFF4D8BCC.toInt()
        const val TIME = 0xFF5AA8F5.toInt()
        const val TRACK_LIGHT = 0xFF26384C.toInt(); const val TRACK_BLUE = 0xFF143463.toInt()
        const val CIRCLE = 0xFF0B1835.toInt();  const val CIRCLE_AOD = 0xFF09132A.toInt()
        const val RING = 0xFFA9C7E6.toInt();    const val RING_AOD = 0xFF879FB8.toInt()
        const val LABEL = 0xFFCBCCCE.toInt();   const val LABEL_AOD = 0xFFA0A0A0.toInt()
        const val WHITE = Color.WHITE;          const val WHITE_AOD = 0xFFCCCCCC.toInt()
    }

    private val bold: Typeface = Typeface.create(Typeface.DEFAULT, 700, false)
    private val semibold: Typeface = Typeface.create(Typeface.DEFAULT, 600, false)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = bold }
    private val bg = Paint()
    private val oval = RectF()
    private val path = Path()
    private val icons = HashMap<String, Drawable?>()

    /** One outer arc: icon at [icon]°, the arc from [from]° sweeping [sweep]°, value text at [label]°. */
    private data class Arc(val slot: Int, val icon: Float, val from: Float, val sweep: Float, val label: Float, val ticks: Boolean, val light: Boolean)
    private val arcs = listOf(
        Arc(FaceService.SLOT_TL, 189f, 198f, 52f, 259f, ticks = false, light = true),   // chance of rain
        Arc(FaceService.SLOT_TR, 281f, 290f, 48f, 347f, ticks = true, light = true),    // UV index
        Arc(FaceService.SLOT_BL, 99f, 108f, 52f, 169f, ticks = true, light = false),    // battery
        Arc(FaceService.SLOT_BR, 10f, 19f, 52f, 80f, ticks = false, light = false),     // steps
    )

    init { FaceData.load(context) }

    override fun render(canvas: Canvas, bounds: Rect, zonedDateTime: ZonedDateTime, sharedAssets: Assets) {
        val aod = renderParameters.drawMode == DrawMode.AMBIENT
        val s = bounds.width() / 480f
        canvas.save()
        canvas.translate(bounds.left.toFloat(), bounds.top.toFloat())
        canvas.scale(s, s)
        background(canvas, aod)
        for (a in arcs) arc(canvas, a, aod, zonedDateTime)
        day(canvas, aod)
        time(canvas, zonedDateTime, aod)
        canvas.restore()
    }

    override fun renderHighlightLayer(canvas: Canvas, bounds: Rect, zonedDateTime: ZonedDateTime, sharedAssets: Assets) {
        canvas.drawColor(renderParameters.highlightLayer!!.backgroundTint)
    }

    // ── Background: near black, a blue glow rising from the bottom rim (black in always-on) ──
    private fun background(c: Canvas, aod: Boolean) {
        c.drawColor(if (aod) Color.BLACK else 0xFF02060D.toInt())
        if (aod) return
        bg.shader = RadialGradient(240f, 640f, 520f, intArrayOf(0xFF1A4A86.toInt(), 0xFF0E2850.toInt(), 0x0002060D), floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
        c.drawCircle(240f, 240f, 240f, bg)
        bg.shader = RadialGradient(240f, 240f, 240f, intArrayOf(0x00000000, 0x00000000, 0x6612305C), floatArrayOf(0f, 0.86f, 1f), Shader.TileMode.CLAMP)
        c.drawCircle(240f, 240f, 240f, bg)
    }

    // ── Outer arcs (complications), as in the original ──
    private fun pt(angle: Float, r: Float): Pair<Float, Float> {
        val rad = Math.toRadians(angle.toDouble())
        return (240 + r * cos(rad)).toFloat() to (240 + r * sin(rad)).toFloat()
    }

    private fun valueOf(d: ComplicationData?, at: ZonedDateTime): Triple<Float?, String?, Icon?> {
        val res = context.resources
        val now = at.toInstant()
        return when (d) {
            is RangedValueComplicationData -> Triple(
                if (d.max > d.min) ((d.value - d.min) / (d.max - d.min)).coerceIn(0f, 1f) else null,
                (d.text ?: d.title)?.getTextAt(res, now)?.toString(), d.monochromaticImage?.image,
            )
            is GoalProgressComplicationData -> Triple(
                if (d.targetValue > 0) (d.value / d.targetValue).coerceIn(0f, 1f) else null,
                (d.text ?: d.title)?.getTextAt(res, now)?.toString(), d.monochromaticImage?.image,
            )
            is ShortTextComplicationData -> Triple(null, d.text.getTextAt(res, now).toString(), d.monochromaticImage?.image)
            else -> Triple(null, null, null)
        }
    }

    private fun arc(c: Canvas, a: Arc, aod: Boolean, at: ZonedDateTime) {
        val data = slots.complicationSlots[a.slot]?.complicationData?.value
        val (fraction, label, icon) = valueOf(data, at)
        val on = if (a.light) (if (aod) P.LIGHT_AOD else P.LIGHT) else (if (aod) P.BLUE_AOD else P.BLUE)
        val track = if (aod) 0xFF0A131B.toInt() else if (a.light) P.TRACK_LIGHT else P.TRACK_BLUE
        val r = 214f
        oval.set(240 - r, 240 - r, 240 + r, 240 + r)
        stroke.strokeWidth = 15f
        val f = fraction ?: 0f
        if (a.ticks) {
            val n = 10
            val step = a.sweep / n
            for (i in 0 until n) {
                stroke.color = if ((i + 0.5f) / n <= f) on else track
                c.drawArc(oval, a.from + i * step + 0.9f, step - 3.2f, false, stroke)
            }
        } else {
            stroke.color = track
            c.drawArc(oval, a.from, a.sweep, false, stroke)
            if (f > 0f) {
                stroke.color = on
                c.drawArc(oval, a.from, (a.sweep * f).coerceAtLeast(0.5f), false, stroke)
            }
        }
        // Icon at the start of the arc, value at the end, both following the circle.
        icon?.let { drawIcon(c, a.slot, it, pt(a.icon, r), on) }
        if (label != null) {
            val (x, y) = pt(a.label, r)
            var rot = a.label + 90f
            if (rot > 90f && rot < 270f) rot -= 180f
            text.textSize = 25f; text.typeface = semibold; text.color = on
            c.save(); c.rotate(rot, x, y)
            c.drawText(label, x, y + 9f, text)
            c.restore()
        }
    }

    private fun drawIcon(c: Canvas, slot: Int, icon: Icon, at: Pair<Float, Float>, color: Int) {
        val key = "$slot:${icon.type}:${runCatching { icon.resId }.getOrNull()}:${runCatching { icon.resPackage }.getOrNull()}"
        val d = icons.getOrPut(key) { runCatching { icon.loadDrawable(context)?.mutate() }.getOrNull() } ?: return
        val half = 13
        d.setBounds((at.first - half).toInt(), (at.second - half).toInt(), (at.first + half).toInt(), (at.second + half).toInt())
        d.setTint(color)
        d.draw(c)
    }

    // ── The day: NEXT on top, NOW in the middle, controls on the sides ──
    private fun day(c: Canvas, aod: Boolean) {
        val snap = FaceData.snapshot
        val m = snap?.minuteAt(System.currentTimeMillis()) ?: 0f
        val now = snap?.nowAt(m)
        val upcoming = snap?.upcomingAt(m, 2) ?: emptyList()
        val next = upcoming.firstOrNull()
        val running = snap?.runningTitle
        val labelColor = if (aod) P.LABEL_AOD else P.LABEL
        val white = if (aod) P.WHITE_AOD else P.WHITE
        val blue = if (aod) P.BLUE_AOD else P.BLUE

        // NEXT: a curved label where the forecast was, then the block, then what follows it.
        text.typeface = bold
        if (snap == null) {
            text.textSize = 22f; text.color = labelColor
            c.drawText("Open DailyFlow to pair", 240f, 118f, text)
        } else if (next != null) {
            path.reset(); oval.set(240f - 172f, 240f - 172f, 240f + 172f, 240f + 172f)
            path.addArc(oval, 225f, 90f)
            text.textSize = 21f; text.color = labelColor; text.typeface = bold
            c.drawTextOnPath("NEXT  ${next.startLabel}", path, 0f, 0f, text)
            fill.color = if (aod) dim(next.color) else next.color
            text.textSize = 25f; text.color = white
            val title = ellipsize(next.title, 250f)
            val tw = text.measureText(title)
            c.drawCircle(240f - tw / 2 - 12f, 107f, 5.5f, fill)
            c.drawText(title, 240f + 6f, 116f, text)
            upcoming.getOrNull(1)?.let {
                text.textSize = 17f; text.typeface = semibold; text.color = if (aod) P.LABEL_AOD else 0xFF8FA3BA.toInt()
                c.drawText(ellipsize("then ${it.startLabel} ${it.title}", 220f), 240f, 139f, text)
            }
        } else {
            text.textSize = 21f; text.color = labelColor
            c.drawText(if (now != null) "Last block of the day" else "Nothing else today", 240f, 118f, text)
        }

        // NOW: the middle circle, with a ring for how far into the block we are.
        val cx = 240f; val cy = 215f; val r = 71f
        fill.color = if (aod) P.CIRCLE_AOD else P.CIRCLE
        c.drawCircle(cx, cy, r, fill)
        val accent = if (now != null) now.color else blue
        if (now != null) {
            val p = ((m - now.start) / (now.end - now.start)).coerceIn(0f, 1f)
            oval.set(cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3)
            stroke.strokeWidth = 5f
            stroke.color = if (aod) 0xFF14223A.toInt() else 0xFF1B2D4C.toInt()
            c.drawArc(oval, 0f, 360f, false, stroke)
            stroke.color = if (aod) dim(accent) else accent
            c.drawArc(oval, -90f, 360f * p, false, stroke)
        }
        val off = running != null && now != null && running != now.title
        val tag = when { running == null && now != null -> "NOT STARTED"; off -> "DOING"; else -> "NOW" }
        val title = running ?: now?.title ?: "Free"
        val sub = when {
            off -> "plan: ${now!!.title}"
            now != null -> "until ${now.endLabel}"
            next != null -> "until ${next.startLabel}"
            else -> ""
        }
        text.textSize = 14f; text.typeface = bold; text.color = if (aod) dim(accent) else lighten(accent)
        c.drawText(tag, cx, cy - 34f, text)
        text.color = white; text.typeface = bold
        val lines = wrap(title, 118f, 21f, 2)
        val lineH = text.textSize + 2f
        var y = cy + 6f - (lines.size - 1) * lineH / 2
        for (l in lines) { c.drawText(l, cx, y, text); y += lineH }
        text.textSize = 15f; text.typeface = semibold; text.color = blue
        c.drawText(ellipsize(sub, 120f), cx, cy + 45f, text)

        // Controls (outlined circles like the original side complications). Tapping asks to confirm by sliding.
        val ring = if (aod) P.RING_AOD else P.RING
        stroke.strokeWidth = 3f; stroke.color = ring
        c.drawCircle(FaceService.LEFT_X, FaceService.SIDE_Y, FaceService.SIDE_R, stroke)
        c.drawCircle(FaceService.RIGHT_X, FaceService.SIDE_Y, FaceService.SIDE_R, stroke)
        if (aod) return
        fill.color = 0xFFDDE8F5.toInt()
        if (running != null) c.drawRoundRect(RectF(FaceService.LEFT_X - 17, FaceService.SIDE_Y - 17, FaceService.LEFT_X + 17, FaceService.SIDE_Y + 17), 6f, 6f, fill)
        else triangle(c, FaceService.LEFT_X + 3, FaceService.SIDE_Y, 22f)
        triangle(c, FaceService.RIGHT_X - 9, FaceService.SIDE_Y, 18f)
        triangle(c, FaceService.RIGHT_X + 7, FaceService.SIDE_Y, 18f)
        c.drawRoundRect(RectF(FaceService.RIGHT_X + 17, FaceService.SIDE_Y - 17, FaceService.RIGHT_X + 22, FaceService.SIDE_Y + 17), 2f, 2f, fill)
    }

    private fun triangle(c: Canvas, x: Float, y: Float, size: Float) {
        path.reset()
        path.moveTo(x - size * 0.55f, y - size * 0.8f)
        path.lineTo(x + size * 0.75f, y)
        path.lineTo(x - size * 0.55f, y + size * 0.8f)
        path.close()
        c.drawPath(path, fill)
    }

    // ── Time and date: big digits, seconds outlined (interactive only), weekday in blue and day in white ──
    private val secFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.LEFT }
    private val secStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.LEFT; style = Paint.Style.STROKE; strokeWidth = 2.6f }

    private fun time(c: Canvas, t: ZonedDateTime, aod: Boolean) {
        val h24 = DateFormat.is24HourFormat(context)
        val hh = if (h24) "%02d".format(t.hour) else "%d".format(((t.hour + 11) % 12) + 1)
        val hm = "$hh:%02d".format(t.minute)
        val size = 104f
        val baseline = 377f
        text.typeface = bold; text.textSize = size
        if (aod) {
            text.color = P.BLUE_AOD
            c.drawText(hm, 240f, baseline, text)
        } else {
            val ss = "%02d".format(t.second)
            text.textAlign = Paint.Align.LEFT
            val wMain = text.measureText("$hm:")
            val wSec = text.measureText("00")
            var x = 240f - (wMain + wSec) / 2
            text.color = P.TIME
            c.drawText("$hm:", x, baseline, text)
            x += wMain
            secFill.typeface = bold; secFill.textSize = size; secFill.color = 0x3360AEFF
            secStroke.typeface = bold; secStroke.textSize = size; secStroke.color = P.BLUE
            c.drawText(ss, x, baseline, secFill)
            c.drawText(ss, x, baseline, secStroke)
            text.textAlign = Paint.Align.CENTER
        }
        val wd = DateTimeFormatter.ofPattern("EEE", Locale.getDefault()).format(t).uppercase(Locale.getDefault())
        val dd = "%02d".format(t.dayOfMonth)
        text.textSize = 34f; text.textAlign = Paint.Align.LEFT
        val w1 = text.measureText("$wd "); val w2 = text.measureText(dd)
        val x0 = 240f - (w1 + w2) / 2
        text.color = if (aod) P.BLUE_AOD else P.BLUE
        c.drawText("$wd ", x0, 428f, text)
        text.color = if (aod) P.WHITE_AOD else P.WHITE
        c.drawText(dd, x0 + w1, 428f, text)
        text.textAlign = Paint.Align.CENTER
    }

    // ── Helpers ──
    private fun ellipsize(s: String, width: Float): String =
        TextUtils.ellipsize(s, android.text.TextPaint(text), width, TextUtils.TruncateAt.END).toString()

    /** Up to [max] lines within [width], shrinking from [size] down to 16 before ellipsizing the last line. */
    private fun wrap(s: String, width: Float, size: Float, max: Int): List<String> {
        var sz = size
        while (true) {
            text.textSize = sz
            val words = s.split(' ')
            val lines = mutableListOf<String>()
            var cur = ""
            for (w in words) {
                val cand = if (cur.isEmpty()) w else "$cur $w"
                if (text.measureText(cand) <= width || cur.isEmpty()) cur = cand else { lines += cur; cur = w }
            }
            if (cur.isNotEmpty()) lines += cur
            if ((lines.size <= max && lines.all { text.measureText(it) <= width }) || sz <= 16f) {
                val out = lines.take(max).toMutableList()
                if (lines.size > max || text.measureText(out.last()) > width) out[out.size - 1] = ellipsize(lines.drop(max - 1).joinToString(" "), width)
                return out
            }
            sz -= 1.5f
        }
    }

    private fun dim(color: Int): Int = Color.rgb((Color.red(color) * 0.6f).toInt(), (Color.green(color) * 0.6f).toInt(), (Color.blue(color) * 0.6f).toInt())
    private fun lighten(color: Int): Int = Color.rgb(
        min(255, Color.red(color) + (255 - Color.red(color)) * 2 / 5), min(255, Color.green(color) + (255 - Color.green(color)) * 2 / 5), min(255, Color.blue(color) + (255 - Color.blue(color)) * 2 / 5),
    )

    @Suppress("unused") private fun blockColor(b: Block?) = b?.color ?: P.BLUE
}
