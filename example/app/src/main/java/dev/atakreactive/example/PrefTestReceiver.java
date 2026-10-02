package dev.atakreactive.example;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.atakmap.android.ipc.AtakBroadcast;
import com.atakmap.android.ipc.AtakBroadcast.DocumentedIntentFilter;
import com.atakmap.android.preference.AtakPreferences;
import com.atakmap.coremap.log.Log;

import java.util.Collections;

/**
 * Integration-test only: writes ATAK preferences of every stored type.
 *
 * The bridge can only write strings (setPreference takes a string), but ATAK
 * stores booleans, numbers and string sets too, and those are exactly what the
 * preference listener used to choke on. The Test page sends this intent with
 * sendBroadcast and checks what preferenceChanged and getPreference report
 * for each key. Registered on AtakBroadcast, so only code inside ATAK can
 * reach it.
 */
public class PrefTestReceiver extends BroadcastReceiver {

    private static final String TAG = "PrefTest";
    public static final String ACTION = "dev.atakreactive.example.PREF_TEST";
    static final String PREFIX = "test.reactive.typed.";

    private final Context context;

    public PrefTestReceiver(Context context) {
        this.context = context;
    }

    public void register() {
        DocumentedIntentFilter filter = new DocumentedIntentFilter();
        filter.addAction(ACTION, "Integration test: write typed preferences");
        AtakBroadcast.getInstance().registerReceiver(this, filter);
    }

    public void unregister() {
        AtakBroadcast.getInstance().unregisterReceiver(this);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        SharedPreferences sp = AtakPreferences.getInstance(context).getSharedPrefs();
        String op = intent.getStringExtra("op");
        if ("write".equals(op)) {
            sp.edit()
                    .putBoolean(PREFIX + "bool", true)
                    .putInt(PREFIX + "int", 42)
                    .putLong(PREFIX + "long", 9000000000L)
                    .putFloat(PREFIX + "float", 1.5f)
                    .putStringSet(PREFIX + "set", Collections.singleton("a"))
                    .apply();
        } else if ("clear".equals(op)) {
            sp.edit()
                    .remove(PREFIX + "bool")
                    .remove(PREFIX + "int")
                    .remove(PREFIX + "long")
                    .remove(PREFIX + "float")
                    .remove(PREFIX + "set")
                    .apply();
        } else {
            Log.w(TAG, "unknown op: " + op);
        }
    }
}
