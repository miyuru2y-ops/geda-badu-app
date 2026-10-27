package lk.gedabaduapp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.TimeZone;

/** බෙහෙත් වෙලාවට alarm — හැම වෙලාවකටම දවසට වරක් (ලංකාවේ වෙලාවට). */
public class DoseScheduler {
    static final String ACTION = "lk.gedabaduapp.DOSE";
    static final int BASE = 100, MAX = 40;

    static void scheduleAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        SharedPreferences p = ctx.getSharedPreferences(AlertScheduler.PREFS, Context.MODE_PRIVATE);
        for (int i = 0; i < MAX; i++) am.cancel(pi(ctx, i, null));   // පරණ ඒවා අයින්
        try {
            JSONArray arr = new JSONArray(p.getString("doses", "[]"));
            for (int i = 0; i < arr.length() && i < MAX; i++) schedule(ctx, am, i, arr.getJSONObject(i));
        } catch (Exception ignored) { }
    }

    static void schedule(Context ctx, AlarmManager am, int idx, JSONObject d) {
        String t = d.optString("time", "");
        if (!t.matches("\\d\\d:\\d\\d")) return;
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("Asia/Colombo"));
        c.set(Calendar.HOUR_OF_DAY, Integer.parseInt(t.substring(0, 2)));
        c.set(Calendar.MINUTE, Integer.parseInt(t.substring(3, 5)));
        c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis()) c.add(Calendar.DAY_OF_MONTH, 1);
        // විනාඩි 5ක window එකක් — exact alarm permission ඕන නැහැ
        am.setWindow(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), 5 * 60 * 1000L, pi(ctx, idx, d));
    }

    static PendingIntent pi(Context ctx, int idx, JSONObject d) {
        Intent i = new Intent(ctx, AlertReceiver.class).setAction(ACTION).putExtra("idx", idx);
        if (d != null) i.putExtra("dose", d.toString());
        return PendingIntent.getBroadcast(ctx, BASE + idx, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
