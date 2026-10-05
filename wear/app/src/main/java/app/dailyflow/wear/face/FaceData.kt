package app.dailyflow.wear.face

import android.content.Context
import app.dailyflow.wear.Api
import app.dailyflow.wear.Snapshot
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * The watch face's view of the day: the last snapshot, cached on disk so the face draws instantly
 * and offline. Now/next are derived on the watch every frame from the timeline, so they stay right
 * between refreshes; only "what is running" can be a few minutes old.
 */
object FaceData {
    @Volatile var snapshot: Snapshot? = null
        private set
    @Volatile var fetchedAt: Long = 0
        private set
    private val lock = Mutex()
    private const val KEY = "face.snapshot"

    fun load(context: Context) {
        if (snapshot != null) return
        val prefs = context.getSharedPreferences("dailyflow", Context.MODE_PRIVATE)
        prefs.getString(KEY, null)?.let { snapshot = Api(context).parseJson(it) }
    }

    /** Fetches a fresh snapshot unless one is younger than [maxAgeMs]. Returns true when it changed. */
    suspend fun refresh(context: Context, maxAgeMs: Long = 0): Boolean = lock.withLock {
        if (System.currentTimeMillis() - fetchedAt < maxAgeMs) return false
        val api = Api(context)
        val raw = api.snapshotRaw() ?: return false
        val parsed = api.parseJson(raw) ?: return false
        context.getSharedPreferences("dailyflow", Context.MODE_PRIVATE).edit().putString(KEY, raw).apply()
        snapshot = parsed
        fetchedAt = System.currentTimeMillis()
        true
    }
}
