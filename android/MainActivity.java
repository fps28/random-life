package com.fps28.randomlife;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "life.local";
    private WebView web;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(21, 24, 34));
        getWindow().setNavigationBarColor(Color.rgb(29, 32, 42));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(21, 24, 34));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }

            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && path != null) {
                    String type;
                    switch (path) {
                        case "/index.html": type = "text/html"; break;
                        case "/style.css": type = "text/css"; break;
                        case "/events.js":
                        case "/branches.js":
                        case "/world.js":
                        case "/engine.js":
                        case "/app.js": type = "application/javascript"; break;
                        default: return missing();
                    }
                    try {
                        return new WebResourceResponse(type, "UTF-8", getAssets().open(path.substring(1)));
                    } catch (IOException ignored) {
                        return missing();
                    }
                }
                return missing();
            }
        });
        setContentView(web);
        web.loadUrl("https://" + HOST + "/index.html");
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), null);
    }

    @Override protected void onDestroy() {
        setContentView(new android.widget.FrameLayout(this));
        web.destroy();
        super.onDestroy();
    }
}
