# Keep @JavascriptInterface methods for WebView bridge
-keepclassmembers class com.atakmap.android.reactive.** {
    @android.webkit.JavascriptInterface <methods>;
}
