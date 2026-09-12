package com.atakmap.android.plugintemplate;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.atakmap.android.ipc.AtakBroadcast;
import com.atakmap.coremap.log.Log;

/**
 * Benchmark-only: lets adb open either panel without driving the UI by tap.
 *
 * Registered on the Android context rather than AtakBroadcast because it has
 * to be reachable from {@code adb shell am broadcast}; AtakBroadcast is
 * process-local. It just re-broadcasts the plugin's own show intents.
 * <pre>
 * adb shell am broadcast -p com.atakmap.app.civ \
 *     -a com.atakmap.android.plugintemplate.BENCH --es op native-list
 * adb shell am broadcast -p com.atakmap.app.civ \
 *     -a com.atakmap.android.plugintemplate.BENCH --es op react
 * </pre>
 */
public class BenchReceiver extends BroadcastReceiver {

    private static final String TAG = "Bench";
    public static final String ACTION = "com.atakmap.android.plugintemplate.BENCH";

    public void register(Context appContext) {
        IntentFilter filter = new IntentFilter(ACTION);
        if (Build.VERSION.SDK_INT >= 33) {
            appContext.registerReceiver(this, filter, Context.RECEIVER_EXPORTED);
        } else {
            appContext.registerReceiver(this, filter);
        }
        Log.d(TAG, "registered for " + ACTION);
    }

    public void unregister(Context appContext) {
        try {
            appContext.unregisterReceiver(this);
        } catch (IllegalArgumentException ignored) {
            // never registered
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String op = intent.getStringExtra("op");
        if (op == null) op = "";
        switch (op) {
            case "native-list":
                AtakBroadcast.getInstance().sendBroadcast(new Intent(NativeListReceiver.SHOW));
                break;
            case "react":
                AtakBroadcast.getInstance().sendBroadcast(new Intent(ReactiveExampleComponent.SHOW_REACT));
                break;
            default:
                Log.w(TAG, "unknown op: " + op);
        }
    }
}
