package lk.gedabaduapp;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * ගෙදර බඩු v2 — app එක server එකෙන්ම load කරනවා (ඒ නිසා app එක අලුත් කරන්න APK එක ආයේ install කරන්න ඕන නැහැ).
 * නෙට් නැති වෙලාවට: service worker cache එකෙන්, ඒකත් නැත්නම් APK එක ඇතුළේ තියෙන copy එකෙන්.
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

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(SERVER) || url.startsWith("file:///android_asset/")) return false;
                // WhatsApp වගේ වෙන ලින්ක් — ෆෝන් එකේ app එකෙන් අරිනවා
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // server එකට යන්න බැරි නම් (මුල්ම වතාවේ offline) APK එකේ copy එක පෙන්නනවා
                if (request.isForMainFrame() && request.getUrl().toString().startsWith(SERVER)) {
                    view.loadUrl(LOCAL);
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient()); // confirm() dialogs

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(SERVER);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

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
