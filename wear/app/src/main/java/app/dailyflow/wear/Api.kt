package app.dailyflow.wear

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.TimeZone

/** The bits of /api/snapshot the watch shows (same JSON as the phone widgets). */
/** A to-do planned for today; [blockStart] ("14:30") ties it to its block. */
data class Todo(val title: String, val high: Boolean, val estimate: Int?, val blockStart: String?, val blockTitle: String?)

data class Block(val title: String, val color: Int, val startLabel: String, val endLabel: String, val start: Int, val end: Int)
data class Snapshot(
    val clock: String,
    val minute: Int,
    val now: Block?, val remainingMin: Int, val progress: Float,
    val next: Block?, val inMin: Int,
    val runningTitle: String?, val runningSince: String?, val runningColor: Int?,
    /** “14m · 8m left” / “+3m over” / “Paused · 14m so far”: the same line on every surface (note #34). */
    val runningLine: String? = null, val runningPaused: Boolean = false,
    /** Asleep right now (an open night): the Next slot offers the sun, not the moon (note #37). */
    val sleeping: Boolean = false,
    val focusTitle: String?, val focusLeftSec: Int?,
    val timeline: List<Block>,
    val nextTasks: List<String>,
    val todos: List<Todo> = emptyList(),
    /** When the server built it (ms), to move the logical minute forward on the watch. */
    val generatedAt: Long = System.currentTimeMillis(),
    /** Logical day (YYYY-MM-DD); block minutes are relative to its midnight. */
    val day: String = "",
) {
    /** Logical minute right now, from the server minute plus the time since it was generated. */
    fun minuteAt(nowMs: Long): Float = minute + (nowMs - generatedAt) / 60000f
    fun nowAt(m: Float): Block? = timeline.lastOrNull { it.start <= m && m < it.end }
    fun nextAt(m: Float): Block? { val cur = nowAt(m); return timeline.firstOrNull { it.start > m && it != cur } }
    /** Instant of a logical-day minute (block minutes count from the logical day's midnight). */
    fun instantOf(min: Float): java.time.Instant =
        runCatching { java.time.LocalDate.parse(day).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().plusSeconds((min * 60).toLong()) }
            .getOrElse { java.time.Instant.ofEpochMilli(generatedAt + ((min - minute) * 60_000).toLong()) }
    fun upcomingAt(m: Float, n: Int): List<Block> { val cur = nowAt(m); return timeline.filter { it.start > m && it != cur }.take(n) }
}

/** Device credential from pairing (spec §78): no login on the watch. */
class Credentials(context: Context) {
    private val prefs = context.getSharedPreferences("dailyflow", Context.MODE_PRIVATE)
    var host: String
        get() = prefs.getString("host", DEFAULT_HOST) ?: DEFAULT_HOST
        set(v) = prefs.edit().putString("host", v.trimEnd('/')).apply()
    var token: String?
        get() = prefs.getString("token", null)
        set(v) = prefs.edit().putString("token", v).apply()
    val paired get() = token != null
    fun clear() = prefs.edit().remove("token").apply()
    companion object { const val DEFAULT_HOST = "https://dailyflow-megomes.vercel.app" }
}

class Api(context: Context) {
    val creds = Credentials(context.applicationContext)
    private val tz: String get() = TimeZone.getDefault().id

    private fun request(path: String, method: String = "GET", body: JSONObject? = null, auth: Boolean = true): Pair<Int, String> {
        val conn = URL(creds.host + path).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.setRequestProperty("content-type", "application/json")
        if (auth) creds.token?.let { conn.setRequestProperty("authorization", "Bearer $it") }
        if (body != null) {
            conn.doOutput = true
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        val code = conn.responseCode
        val text = (if (code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        conn.disconnect()
        return code to text
    }

    /** Trades the code shown on the web (Settings › Device) for a device token. */
    suspend fun pair(host: String, code: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            creds.host = host
            val (status, text) = request("/api/devices/claim", "POST", JSONObject().put("code", code).put("label", "Wear OS").put("kind", "wear"), auth = false)
            if (status != 200) error(if (status == 401) "Wrong or expired code" else "Pairing failed ($status)")
            creds.token = JSONObject(text).getString("token")
        }
    }

    /** FCM token → server, so changes made elsewhere reach the watch in seconds. */
    suspend fun registerPush(token: String): Boolean = withContext(Dispatchers.IO) {
        runCatching { request("/api/push/register", "POST", JSONObject().put("token", token).put("platform", "wear")).first == 200 }.getOrDefault(false)
    }

    suspend fun snapshot(): Snapshot? = snapshotRaw()?.let { parseJson(it) }

    /** The raw JSON (the watch face caches it to draw without the network). */
    suspend fun snapshotRaw(): String? = withContext(Dispatchers.IO) {
        if (!creds.paired) return@withContext null
        runCatching {
            val (status, text) = request("/api/snapshot?tz=" + URLEncoder.encode(tz, "UTF-8"))
            if (status != 200) null else text
        }.getOrNull()
    }

    fun parseJson(text: String): Snapshot? = runCatching { parse(JSONObject(text)) }.getOrNull()

    /** Start the current block or stop the running activity (POST /api/quick). */
    suspend fun quick(action: String): String = withContext(Dispatchers.IO) {
        runCatching {
            val (status, text) = request("/api/quick", "POST", JSONObject().put("action", action).put("tz", tz))
            if (status == 200) JSONObject(text).optString("message") else "Failed ($status)"
        }.getOrElse { "Offline" }
    }

    private fun block(o: JSONObject?): Block? = o?.let {
        Block(it.optString("title"), color(it.optString("color")), it.optString("startLabel"), it.optString("endLabel"), it.optInt("start"), it.optInt("end"))
    }

    private fun parse(j: JSONObject): Snapshot {
        val now = j.optJSONObject("now")
        val next = j.optJSONObject("next")
        val running = j.optJSONObject("running")
        val focus = j.optJSONObject("focus")
        val tl = j.optJSONArray("timeline")
        val nt = j.optJSONObject("tasks")?.optJSONArray("next")
        return Snapshot(
            clock = j.optString("clock"), minute = j.optInt("minute"),
            now = block(now), remainingMin = now?.optInt("remainingMin") ?: 0, progress = now?.optDouble("progress")?.toFloat() ?: 0f,
            next = block(next), inMin = next?.optInt("inMin") ?: 0,
            runningTitle = running?.optString("title"), runningSince = running?.optString("sinceLabel"), runningColor = running?.let { color(it.optString("color")) },
            runningLine = running?.optString("line")?.takeIf { it.isNotEmpty() }, runningPaused = running?.optBoolean("paused") ?: false,
            sleeping = !j.isNull("sleeping") && j.has("sleeping"),
            focusTitle = focus?.optString("title"), focusLeftSec = focus?.let { if (it.isNull("leftSec")) null else it.optInt("leftSec") },
            timeline = (0 until (tl?.length() ?: 0)).mapNotNull { block(tl!!.optJSONObject(it)) },
            nextTasks = (0 until (nt?.length() ?: 0)).map { nt!!.optString(it) },
            day = j.optString("day"),
            todos = j.optJSONArray("todos")?.let { a -> (0 until a.length()).map { i -> a.getJSONObject(i).let { t ->
                Todo(t.optString("title"), t.optBoolean("high"), if (t.isNull("estimate")) null else t.optInt("estimate"), if (t.isNull("blockStart")) null else t.optString("blockStart"), if (t.isNull("blockTitle")) null else t.optString("blockTitle"))
            } } } ?: emptyList(),
            generatedAt = runCatching { java.time.Instant.parse(j.optString("generatedAt")).toEpochMilli() }.getOrDefault(System.currentTimeMillis()),
        )
    }

    companion object {
        fun paired(context: Context) = Credentials(context.applicationContext).paired
        fun color(hex: String?): Int = runCatching { android.graphics.Color.parseColor(hex) }.getOrDefault(0xFF248CF2.toInt())
    }
}
