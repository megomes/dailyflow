package app.dailyflow.wear.face

import android.content.Context
import app.dailyflow.wear.Api
import app.dailyflow.wear.Snapshot
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * The watch's view of the day: the last snapshot, cached on disk so complications answer
 * instantly (and offline); a fresh copy is fetched in the background.
 */
object FaceData {
    @Volatile var snapshot: Snapshot? = null
        private set
    @Volatile var fetchedAt: Long = 0
        private set
    private var raw: String? = null
    private val lock = Mutex()
    private const val KEY = "face.snapshot"
    private const val AT = "face.fetchedAt"

    fun load(context: Context) {
        if (snapshot != null) return
        val prefs = context.getSharedPreferences("dailyflow", Context.MODE_PRIVATE)
        prefs.getString(KEY, null)?.let { raw = it; snapshot = Api(context).parseJson(it) }
        fetchedAt = prefs.getLong(AT, 0)
    }

    val ageMs: Long get() = System.currentTimeMillis() - fetchedAt

    /** Fetches a fresh snapshot unless one is younger than [maxAgeMs]. Returns true only when the data changed. */
    suspend fun refresh(context: Context, maxAgeMs: Long = 0): Boolean = lock.withLock {
        load(context)
        if (ageMs < maxAgeMs) return false
        val api = Api(context)
        val text = api.snapshotRaw() ?: return false
        val parsed = api.parseJson(text) ?: return false
        fetchedAt = System.currentTimeMillis()
        // generatedAt/clock change every call; compare what the watch shows.
        val changed = snapshot?.let { it.timeline != parsed.timeline || it.runningTitle != parsed.runningTitle || it.day != parsed.day } ?: true
        context.getSharedPreferences("dailyflow", Context.MODE_PRIVATE).edit().putString(KEY, text).putLong(AT, fetchedAt).apply()
        raw = text
        snapshot = parsed
        // Every fresh day re-arms the block-change alarm.
        app.dailyflow.wear.notify.Transitions.schedule(context.applicationContext)
        app.dailyflow.wear.notify.Transitions.dismissIfStarted(context.applicationContext, parsed)
        changed
    }
}
