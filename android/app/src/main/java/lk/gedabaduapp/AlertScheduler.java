package lk.gedabaduapp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import java.util.Calendar;
import java.util.TimeZone;

/** දවසට දෙපාරක් (උදේ 8, හවස 6 — ලංකාවේ වෙලාවට) server එකෙන් alerts බලන්න alarm එක. */
public class AlertScheduler {
    static final String PREFS = "geda";

    static void schedule(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(ctx, AlertReceiver.class).setAction(AlertReceiver.ACTION_CHECK);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Asia/Colombo"));
        int h = c.get(Calendar.HOUR_OF_DAY);
        int next = h < 8 ? 8 : (h < 18 ? 18 : 8 + 24);
        c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        c.add(Calendar.HOUR_OF_DAY, next);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), AlarmManager.INTERVAL_HALF_DAY, pi);
    }
}
