package dev.atakreactive.example;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.atakmap.android.dropdown.DropDownReceiver;
import com.atakmap.android.ipc.AtakBroadcast;
import com.atakmap.android.maps.MapView;
import com.atakmap.coremap.log.Log;

/**
 * Benchmark-only: lets adb open either panel without driving the UI by tap.
 *
 * Registered on the Android context rather than AtakBroadcast because it has
 * to be reachable from {@code adb shell am broadcast}; AtakBroadcast is
 * process-local. It just re-broadcasts the plugin's own show intents.
 * <pre>
 * adb shell am broadcast -p com.atakmap.app.civ \
 *     -a dev.atakreactive.example.BENCH --es op native-list
 * adb shell am broadcast -p com.atakmap.app.civ \
 *     -a dev.atakreactive.example.BENCH --es op react
 * </pre>
 * Lifecycle ops for checking closed/covered panels (#88). The back key does not
 * close the React panel — the page's router takes it — so these close panels
 * directly:
 * <ul>
 *   <li>{@code close}: close the React panel.</li>
 *   <li>{@code retain} / {@code unretain}: mark the React panel retained, so a
 *       drop-down opened over it covers it (its view is detached) instead of
 *       closing it.</li>
 *   <li>{@code close-native}: close the native list panel, uncovering a
 *       retained React panel underneath.</li>
 * </ul>
 */
public class BenchReceiver extends BroadcastReceiver {

    private static final String TAG = "Bench";
    public static final String ACTION = "dev.atakreactive.example.BENCH";

    private final DropDownReceiver reactPanel;
    private final DropDownReceiver nativePanel;

    public BenchReceiver(DropDownReceiver reactPanel, DropDownReceiver nativePanel) {
        this.reactPanel = reactPanel;
        this.nativePanel = nativePanel;
    }

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
            case "close":
                MapView.getMapView().post(reactPanel::closeDropDown);
                break;
            case "retain":
            case "unretain":
                final boolean retain = op.equals("retain");
                MapView.getMapView().post(() -> reactPanel.setRetain(retain));
                break;
            case "close-native":
                MapView.getMapView().post(nativePanel::closeDropDown);
                break;
            default:
                Log.w(TAG, "unknown op: " + op);
        }
    }
}
