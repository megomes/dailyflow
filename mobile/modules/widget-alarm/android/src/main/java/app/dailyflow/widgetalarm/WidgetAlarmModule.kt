package app.dailyflow.widgetalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Keeps the home-screen widgets fresh without opening the app (note #25). After each redraw the JS
 * side asks for the next one at the moment the day changes (block ends, next starts) or within a
 * few minutes; an AlarmManager alarm (allowed in Doze) then broadcasts APPWIDGET_UPDATE to every
 * DailyFlow widget, which runs the headless widget handler again.
 */
class WidgetAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WidgetAlarm")
    Function("schedule") { atMs: Double ->
      val ctx = appContext.reactContext ?: return@Function false
      WidgetAlarm.schedule(ctx, atMs.toLong())
      true
    }
    Function("refreshNow") {
      val ctx = appContext.reactContext ?: return@Function false
      WidgetAlarm.broadcast(ctx)
      true
    }
  }
}

object WidgetAlarm {
  private const val ACTION = "app.dailyflow.WIDGET_REFRESH"

  fun schedule(ctx: Context, atMs: Long) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(ctx, WidgetAlarmReceiver::class.java).setAction(ACTION)
    val pi = PendingIntent.getBroadcast(ctx, 4242, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, maxOf(atMs, System.currentTimeMillis() + 30_000), pi)
  }

  fun broadcast(ctx: Context) {
    val mgr = AppWidgetManager.getInstance(ctx)
    for (info in mgr.getInstalledProvidersForPackage(ctx.packageName, null)) {
      val ids = mgr.getAppWidgetIds(info.provider)
      if (ids.isEmpty()) continue
      ctx.sendBroadcast(
        Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
          .setComponent(info.provider)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      )
    }
  }
}

class WidgetAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    WidgetAlarm.broadcast(ctx)
  }
}
