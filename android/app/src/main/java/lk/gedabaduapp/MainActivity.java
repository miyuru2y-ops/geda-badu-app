package lk.gedabaduapp;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import org.json.JSONObject;

/**
 * ගෙදර බඩු v2.1 — app එක server එකෙන්ම load කරනවා (app එක අලුත් කරන්න APK එක ආයේ install කරන්න ඕන නැහැ).
 * නෙට් නැති වෙලාවට: service worker cache එකෙන්, ඒකත් නැත්නම් APK එක ඇතුළේ තියෙන copy එකෙන්.
 * Native: barcode scanner (Google code scanner — camera permission ඕන නැහැ) සහ දවසට notifications.
 */
public class MainActivity extends Activity {
    static final String SERVER = "https://yfhbfdy513gg47ewhnjetul4.sportantics.com/";
    static final String LOCAL = "file:///android_asset/index.html";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setFitsSystemWindows(true);
        webView.setBackgroundColor(Color.parseColor("#f2f5f2"));
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);          // android_asset තවමත් වැඩ කරනවා
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new Bridge(), "GedaNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(SERVER) || url.startsWith("file:///android_asset/")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && request.getUrl().toString().startsWith(SERVER)) view.loadUrl(LOCAL);
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(SERVER);

        // Android 13+ — notifications වලට අවසර ඉල්ලනවා
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
        }
        AlertScheduler.schedule(this);
    }

    /** web app එකට පේන native functions: window.GedaNative.* */
    class Bridge {
        @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }

        @JavascriptInterface public void setConfig(String key, String name) {
            getSharedPreferences(AlertScheduler.PREFS, Context.MODE_PRIVATE).edit()
                .putString("key", key == null ? "" : key).putString("name", name == null ? "" : name).apply();
        }

        @JavascriptInterface public String notifStatus() {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            boolean on = nm != null && nm.areNotificationsEnabled();
            return on ? "✅ ON — දවසට උදේ 8ට සහ හවස 6ට" : "⛔ OFF — ෆෝන් Settings → Apps → ගෙදර බඩු → Notifications";
        }

        @JavascriptInterface public void scan() { runOnUiThread(MainActivity.this::startScan); }
    }

    private void startScan() {
        GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(this);
        scanner.startScan()
            .addOnSuccessListener(barcode -> {
                String raw = barcode.getRawValue();
                if (raw != null) webView.evaluateJavascript("window.gedaOnScan && window.gedaOnScan(" + JSONObject.quote(raw) + ")", null);
            })
            .addOnFailureListener(e -> Toast.makeText(this, "Scan කරන්න බැරි වුණා — Google Play services update කරලා ආයේ බලන්න", Toast.LENGTH_LONG).show());
    }

    @Override protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }
    @Override protected void onPause() { if (webView != null) webView.onPause(); super.onPause(); }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
