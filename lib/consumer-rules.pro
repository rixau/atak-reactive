# Keep @JavascriptInterface methods — auto-applied when consuming the AAR
-keepclassmembers class com.atakmap.android.reactive.** {
    @android.webkit.JavascriptInterface <methods>;
}
