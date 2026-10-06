package app.dailyflow.wear

import android.content.Context
import androidx.wear.tiles.TileService
import app.dailyflow.wear.complications.Sources
import app.dailyflow.wear.face.FaceData
import app.dailyflow.wear.notify.Transitions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Live sync on the watch: the server sends an FCM data message whenever another device changes
 * something (Now, play/pause, a new block…). We fetch the snapshot right away and redraw the
 * complications and the tile, and re-plan the block-change nudges — no waiting for the 5-minute
 * complication refresh.
 */
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        Push.register(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        if (message.data["type"] != "sync") return
        val app = applicationContext
        // FCM gives us a few seconds here; the snapshot is one small request.
        runBlocking { withTimeoutOrNull(9_000) { FaceData.refresh(app) } }
        Push.redraw(app)
    }
}

object Push {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private const val KEY = "push.token"

    /** After pairing and on every app start: hand the FCM token to the server (once per token). */
    fun ensureRegistered(context: Context) {
        val app = context.applicationContext
        if (!Api.paired(app)) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> register(app, token) }
    }

    fun register(context: Context, token: String) {
        val app = context.applicationContext
        val prefs = app.getSharedPreferences("dailyflow", Context.MODE_PRIVATE)
        if (!Api.paired(app) || prefs.getString(KEY, null) == token) return
        scope.launch { if (Api(app).registerPush(token)) prefs.edit().putString(KEY, token).apply() }
    }

    fun redraw(context: Context) {
        Sources.refreshAll(context)
        TileService.getUpdater(context).requestUpdate(NowTileService::class.java)
        runCatching { Transitions.schedule(context) }
    }
}
