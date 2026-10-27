package lk.gedabaduapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Home screen widget — අඩු බඩු, සාප්පු ලිස්ට් ගණන, වැදගත්ම මතක් කිරීම. Tap කළාම app එක ඇරෙනවා. */
public class GedaWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        final PendingResult pr = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try { update(app, mgr, ids, fetch(app)); } catch (Exception e) { update(app, mgr, ids, null); }
            finally { pr.finish(); }
        }).start();
    }

    static JSONObject fetch(Context ctx) throws Exception {
        SharedPreferences p = ctx.getSharedPreferences(AlertScheduler.PREFS, Context.MODE_PRIVATE);
        HttpURLConnection c = (HttpURLConnection) new URL(MainActivity.SERVER + "api/widget").openConnection();
        c.setConnectTimeout(10000); c.setReadTimeout(10000);
        String key = p.getString("key", "");
        if (!key.isEmpty()) c.setRequestProperty("X-Household-Key", key);
        if (c.getResponseCode() != 200) return null;
        InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096]; int n; while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        String body = out.toString(StandardCharsets.UTF_8.name());
        p.edit().putString("widget", body).apply();   // offline වෙලාවට අන්තිම එක
        return new JSONObject(body);
    }

    static void update(Context ctx, AppWidgetManager mgr, int[] ids, JSONObject j) {
        if (j == null) {
            try { j = new JSONObject(ctx.getSharedPreferences(AlertScheduler.PREFS, Context.MODE_PRIVATE).getString("widget", "{}")); } catch (Exception e) { j = new JSONObject(); }
        }
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget);
        int lowCount = j.optInt("lowCount", 0), shop = j.optInt("shop", 0);
        JSONArray low = j.optJSONArray("low"), al = j.optJSONArray("alerts");
        StringBuilder lows = new StringBuilder();
        if (low != null) for (int i = 0; i < low.length() && i < 4; i++) { if (i > 0) lows.append(", "); lows.append(low.optString(i)); }
        v.setTextViewText(R.id.w_low, lowCount == 0 ? "👍 අඩු බඩු නැහැ" : "⚠️ අඩු " + lowCount + ": " + lows);
        v.setTextViewText(R.id.w_shop, "🛒 සාප්පු ලිස්ට් එකේ " + shop);
        v.setTextViewText(R.id.w_alert, al != null && al.length() > 0 ? al.optString(0) : "");
        PendingIntent open = PendingIntent.getActivity(ctx, 50, new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.w_root, open);
        for (int id : ids) mgr.updateAppWidget(id, v);
    }

    /** app එකේ වෙනසක් කළාම widget එක අලුත් කරනවා */
    static void refresh(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, GedaWidget.class));
        if (ids.length == 0) return;
        Intent i = new Intent(ctx, GedaWidget.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        ctx.sendBroadcast(i);
    }
}
