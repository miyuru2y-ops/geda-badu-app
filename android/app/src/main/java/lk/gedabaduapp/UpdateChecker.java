package lk.gedabaduapp;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** GitHub Release එකේ අලුත් APK එකක් තියෙනවද බලලා, එක tap එකෙන් download + install. */
public class UpdateChecker {
    static final String BASE = "https://github.com/miyuru2y-ops/geda-badu-app/releases/latest/download/";

    static void check(Activity act) { check(act, false); }

    /** GitHub එකේ version.json — නැත්නම් null */
    static JSONObject fetchVersion() throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(BASE + "version.json").openConnection();
        c.setConnectTimeout(10000); c.setReadTimeout(10000);
        if (c.getResponseCode() != 200) return null;
        InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[2048]; int n; while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
    }

    /** App එක වහලා තිබුණත් — alarm එකෙන් call වෙනවා. අලුත් version එකක් ආවොත් එක පාරක් notification එකක්. */
    static void notifyIfNew(Context ctx) {
        try {
            JSONObject j = fetchVersion(); if (j == null) return;
            int code = j.optInt("versionCode", 0);
            if (code <= BuildConfig.VERSION_CODE) return;
            SharedPreferences p = ctx.getSharedPreferences(AlertScheduler.PREFS, Context.MODE_PRIVATE);
            if (p.getInt("updNotified", 0) == code) return;
            p.edit().putInt("updNotified", code).apply();
            String notes = j.optString("notes", "");
            AlertReceiver.showUpdate(ctx, "🆕 ගෙදර බඩු " + j.optString("versionName", "") + " update එකක් තියෙනවා",
                (notes.isEmpty() ? "" : notes + "\n") + "මෙතන tap කරලා Update ඔබන්න.");
        } catch (Exception ignored) { }
    }

    static void check(Activity act, boolean force) {
        SharedPreferences p = act.getSharedPreferences(AlertScheduler.PREFS, Context.MODE_PRIVATE);
        long last = p.getLong("updCheck", 0);
        if (!force && System.currentTimeMillis() - last < 3600 * 1000L) return;   // පැයකට වරක්
        p.edit().putLong("updCheck", System.currentTimeMillis()).apply();
        new Thread(() -> {
            try {
                JSONObject j = fetchVersion(); if (j == null) return;
                int code = j.optInt("versionCode", 0);
                if (code <= BuildConfig.VERSION_CODE) return;
                String name = j.optString("versionName", ""), notes = j.optString("notes", "");
                act.runOnUiThread(() -> {
                    if (act.isFinishing()) return;
                    new AlertDialog.Builder(act)
                        .setTitle("🆕 ගෙදර බඩු " + name)
                        .setMessage("අලුත් version එකක් තියෙනවා." + (notes.isEmpty() ? "" : "\n\n" + notes) + "\n\nUpdate ඔබලා, ඊට පස්සේ එන \"Install\" ඔබන්න. ලිස්ට් එකට කිසිම දෙයක් වෙන්නේ නැහැ.")
                        .setPositiveButton("⬇️ Update", (d, w) -> download(act, name))
                        .setNegativeButton("පස්සේ", null)
                        .show();
                });
            } catch (Exception ignored) { }
        }).start();
    }

    static void download(Activity act, String name) {
        DownloadManager dm = (DownloadManager) act.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) return;
        DownloadManager.Request r = new DownloadManager.Request(Uri.parse(BASE + "geda-badu.apk"))
            .setTitle("ගෙදර බඩු " + name)
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(act, Environment.DIRECTORY_DOWNLOADS, "geda-badu-" + System.currentTimeMillis() + ".apk");
        final long id = dm.enqueue(r);
        Toast.makeText(act, "⬇️ Download වෙනවා…", Toast.LENGTH_SHORT).show();
        BroadcastReceiver done = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                if (i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != id) return;
                try { c.unregisterReceiver(this); } catch (Exception ignored) { }
                Uri apk = dm.getUriForDownloadedFile(id);
                if (apk == null) { Toast.makeText(c, "Download එක අසාර්ථකයි — පස්සේ ආයේ බලන්න", Toast.LENGTH_LONG).show(); return; }
                Intent install = new Intent(Intent.ACTION_VIEW).setDataAndType(apk, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                try { c.startActivity(install); } catch (Exception e) { Toast.makeText(c, "Install කරන්න බැරි වුණා", Toast.LENGTH_LONG).show(); }
            }
        };
        IntentFilter f = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) act.getApplicationContext().registerReceiver(done, f, Context.RECEIVER_EXPORTED);
        else act.getApplicationContext().registerReceiver(done, f);
    }
}
