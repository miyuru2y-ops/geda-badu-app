package lk.gedabaduapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Alarm එක ආවාම server එකේ /api/alerts බලලා notification එකක් පෙන්නනවා. Restart කළාම alarm එක ආයේ දානවා. */
public class AlertReceiver extends BroadcastReceiver {
    static final String ACTION_CHECK = "lk.gedabaduapp.CHECK_ALERTS";
    static final String CHANNEL = "geda_alerts";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) {
            AlertScheduler.schedule(ctx);
            DoseScheduler.scheduleAll(ctx);
            return;
        }
        if (DoseScheduler.ACTION.equals(a)) {
            // 💊 බෙහෙත් වෙලාව
            try {
                org.json.JSONObject d = new org.json.JSONObject(intent.getStringExtra("dose"));
                String who = d.optString("who", ""), unit = d.optString("unit", "");
                double q = d.optDouble("qty", 1);
                String qty = q == Math.floor(q) ? String.valueOf((long) q) : String.valueOf(q);
                show(ctx, 100 + intent.getIntExtra("idx", 0), "💊 බෙහෙත් වෙලාව — " + d.optString("time"),
                    (who.isEmpty() ? "" : who + ": ") + d.optString("name") + " " + qty + (unit.isEmpty() ? "" : " " + unit) + " බොන්න. බිව්වාම app එකේ ☑ කරන්න.");
                // හෙට මේ වෙලාවටම
                android.app.AlarmManager am = (android.app.AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
                if (am != null) DoseScheduler.schedule(ctx, am, intent.getIntExtra("idx", 0), d);
            } catch (Exception ignored) { }
            return;
        }
        if (!ACTION_CHECK.equals(a)) return;
        final PendingResult pr = goAsync();
        new Thread(() -> {
            try { check(ctx.getApplicationContext()); } catch (Exception ignored) { }
            try { UpdateChecker.notifyIfNew(ctx.getApplicationContext()); } catch (Exception ignored) { }
            finally { pr.finish(); }
        }).start();
    }

    static void check(Context ctx) throws Exception {
        SharedPreferences p = ctx.getSharedPreferences(AlertScheduler.PREFS, Context.MODE_PRIVATE);
        HttpURLConnection c = (HttpURLConnection) new URL(MainActivity.SERVER + "api/alerts").openConnection();
        c.setConnectTimeout(10000); c.setReadTimeout(10000);
        String key = p.getString("key", "");
        if (!key.isEmpty()) c.setRequestProperty("X-Household-Key", key);
        if (c.getResponseCode() != 200) return;
        InputStream in = c.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096]; int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        JSONObject j = new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
        JSONArray arr = j.optJSONArray("alerts");
        if (arr == null || arr.length() == 0) return;
        StringBuilder body = new StringBuilder();
        for (int i = 0; i < arr.length(); i++) { if (i > 0) body.append('\n'); body.append(arr.getJSONObject(i).optString("text")); }
        String text = body.toString();
        String date = j.optString("date");
        // එකම දවසේ එකම පණිවිඩය දෙපාරක් පෙන්නන්නේ නැහැ
        String sig = date + "|" + text.hashCode();
        if (sig.equals(p.getString("last", ""))) return;
        p.edit().putString("last", sig).apply();
        show(ctx, 1, arr.getJSONObject(0).optString("text"), text);
    }

    /** 🆕 Update notification — tap කළාම app එක ඇරිලා update dialog එක වහාම */
    static void showUpdate(Context ctx, String title, String text) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !nm.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "ගෙදර බඩු මතක් කිරීම්", NotificationManager.IMPORTANCE_DEFAULT));
        Intent i = new Intent(ctx, MainActivity.class).putExtra("checkUpdate", true).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent open = PendingIntent.getActivity(ctx, 77, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(title).setContentText(text)
            .setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(open).setAutoCancel(true).setColor(0xFF0E7A4B);
        nm.notify(3, b.build());
    }

    static void show(Context ctx, int nid, String title, String text) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !nm.areNotificationsEnabled()) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "ගෙදර බඩු මතක් කිරීම්", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open = PendingIntent.getActivity(ctx, nid, new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_notif).setContentTitle(nid == 1 ? "🏠 ගෙදර බඩු" : title).setContentText(nid == 1 ? title : text)
            .setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(open).setAutoCancel(true)
            .setColor(0xFF0E7A4B);
        nm.notify(nid, b.build());
    }
}
