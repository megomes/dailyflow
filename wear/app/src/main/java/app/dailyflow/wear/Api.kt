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
data class Block(val title: String, val color: Int, val startLabel: String, val endLabel: String, val start: Int, val end: Int)
data class Snapshot(
    val clock: String,
    val minute: Int,
    val now: Block?, val remainingMin: Int, val progress: Float,
    val next: Block?, val inMin: Int,
    val runningTitle: String?, val runningSince: String?, val runningColor: Int?,
    val focusTitle: String?, val focusLeftSec: Int?,
    val timeline: List<Block>,
    val nextTasks: List<String>,
)

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

    suspend fun snapshot(): Snapshot? = withContext(Dispatchers.IO) {
        if (!creds.paired) return@withContext null
        runCatching {
            val (status, text) = request("/api/snapshot?tz=" + URLEncoder.encode(tz, "UTF-8"))
            if (status != 200) null else parse(JSONObject(text))
        }.getOrNull()
    }

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
            focusTitle = focus?.optString("title"), focusLeftSec = focus?.let { if (it.isNull("leftSec")) null else it.optInt("leftSec") },
            timeline = (0 until (tl?.length() ?: 0)).mapNotNull { block(tl!!.optJSONObject(it)) },
            nextTasks = (0 until (nt?.length() ?: 0)).map { nt!!.optString(it) },
        )
    }

    companion object {
        fun color(hex: String?): Int = runCatching { android.graphics.Color.parseColor(hex) }.getOrDefault(0xFF248CF2.toInt())
    }
}
