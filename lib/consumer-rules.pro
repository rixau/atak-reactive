# Keep @JavascriptInterface methods — auto-applied when consuming the AAR
-keepclassmembers class com.atakmap.android.reactive.** {
    @android.webkit.JavascriptInterface <methods>;
}

# BridgeInfo resolves BuildConfig reflectively (source-include builds have no
# such class, so a compile-time reference is impossible). Without this rule R8
# strips the class from minified plugin builds and AAR installs would report
# "unknown" too.
-keep class com.atakmap.android.reactive.BuildConfig { *; }
