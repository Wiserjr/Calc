package br.com.wiserjr.calc;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayInputStream;
import java.util.Collections;
import org.json.JSONException;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    public static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
    public static final String CALCULATOR_URL = LOCAL_ORIGIN + "/assets/index.html";
    private WebView webView;
    private boolean pageReady;
    private String lastConsoleError = "";

    @Override @SuppressLint("SetJavaScriptEnabled")
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16, 47, 61));
        webView = new WebView(this);
        webView.setId(View.generateViewId());
        webView.setBackgroundColor(Color.rgb(241, 245, 245));
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        root.requestApplyInsets();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " CalcAndroid/" + BuildConfig.VERSION_NAME);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (isLocal(request.getUrl())) {
                    WebResourceResponse response = assets.shouldInterceptRequest(request.getUrl());
                    if (response != null) return response;
                }
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
                        Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isLocal(request.getUrl())) return false;
                if (request.isForMainFrame()) openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                pageReady = CALCULATOR_URL.equals(url);
                view.evaluateJavascript("document.querySelectorAll('a[target]').forEach(a => a.removeAttribute('target'))", null);
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) Toast.makeText(MainActivity.this, R.string.load_error, Toast.LENGTH_LONG).show();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) lastConsoleError = message.message();
                return super.onConsoleMessage(message);
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "CalcAndroid", Collections.singleton(LOCAL_ORIGIN),
                    (view, message, sourceOrigin, isMainFrame, reply) -> {
                        if (isMainFrame && LOCAL_ORIGIN.equals(sourceOrigin.toString())) handleMessage(message.getData(), reply);
                    });
        } else Toast.makeText(this, R.string.webview_required, Toast.LENGTH_LONG).show();
        webView.loadUrl(CALCULATOR_URL);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::finish);
    }

    static boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())
                && uri.getPort() == -1 && "/assets/index.html".equals(uri.getPath()) && uri.getQuery() == null;
    }

    private void openExternal(Uri uri) {
        String host = uri.getHost();
        boolean official = host != null && (host.equals("gov.br") || host.endsWith(".gov.br")
                || host.equals("leg.br") || host.endsWith(".leg.br"));
        if (!"https".equals(uri.getScheme()) || !official) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException error) { Toast.makeText(this, R.string.external_unavailable, Toast.LENGTH_LONG).show(); }
    }

    private void handleMessage(String data, JavaScriptReplyProxy reply) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        String id = "";
        try {
            if (data == null || data.length() > 100000 || !pageReady) throw new JSONException("Mensagem inválida.");
            JSONObject request = new JSONObject(data);
            id = request.getString("id");
            String action = request.getString("action");
            switch (action) {
                case "copy":
                    ClipboardManager clipboard = getSystemService(ClipboardManager.class);
                    clipboard.setPrimaryClip(ClipData.newPlainText(getString(R.string.copy_label), request.getString("text")));
                    break;
                case "print":
                    PrintManager printing = getSystemService(PrintManager.class);
                    if (printing == null) throw new IllegalStateException("Impressão indisponível neste aparelho.");
                    printing.print(getString(R.string.print_name), webView.createPrintDocumentAdapter("memoria-calculo"),
                            new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                    break;
                case "share":
                    Intent intent = new Intent(Intent.ACTION_SEND).setType("text/plain")
                            .putExtra(Intent.EXTRA_SUBJECT, getString(R.string.print_name))
                            .putExtra(Intent.EXTRA_TEXT, request.getString("text"));
                    startActivity(Intent.createChooser(intent, getString(R.string.share_title)));
                    break;
                default: throw new JSONException("Ação não reconhecida.");
            }
            reply.postMessage(new JSONObject().put("id", id).put("ok", true).toString());
        } catch (Exception error) {
            try { reply.postMessage(new JSONObject().put("id", id).put("ok", false)
                    .put("error", "Não foi possível concluir a ação no Android.").toString()); }
            catch (JSONException ignored) { /* Invalid input cannot alter the calculator. */ }
        }
    }

    public WebView getCalculatorForTesting() { return webView; }
    public boolean isCalculatorReadyForTesting() { return pageReady; }
    public String getConsoleErrorForTesting() { return lastConsoleError; }

    @Override protected void onPause() { webView.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (webView != null) webView.onResume(); }
    @Override protected void onDestroy() {
        if (webView != null) { ((FrameLayout) webView.getParent()).removeView(webView); webView.destroy(); }
        super.onDestroy();
    }
}
