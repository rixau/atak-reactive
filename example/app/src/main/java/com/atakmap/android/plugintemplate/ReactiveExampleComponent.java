package com.atakmap.android.plugintemplate;

import android.content.Context;
import android.content.Intent;

import com.atakmap.android.dropdown.DropDownMapComponent;
import com.atakmap.android.ipc.AtakBroadcast.DocumentedIntentFilter;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.plugintemplate.plugin.R;
import com.atakmap.android.reactive.ReactiveDropDown;
import com.atakmap.coremap.log.Log;

public class ReactiveExampleComponent extends DropDownMapComponent {

    private static final String TAG = "ReactiveExample";
    public static final String SHOW_REACT = "com.atakmap.android.plugintemplate.SHOW_REACT";
    public static final String SHOW_MIXED = "com.atakmap.android.plugintemplate.SHOW_MIXED";

    private ReactiveDropDown reactiveDropDown;
    private MixedExampleReceiver mixedReceiver;
    private NativeChurnReceiver churnReceiver;
    private NativeListReceiver nativeListReceiver;
    private BenchReceiver benchReceiver;

    @Override
    public void onCreate(final Context context, Intent intent,
            final MapView view) {
        context.setTheme(R.style.ATAKPluginTheme);
        super.onCreate(context, intent, view);

        reactiveDropDown = new ReactiveDropDown(view, context, "web/index.html");
        DocumentedIntentFilter filter = new DocumentedIntentFilter();
        filter.addAction(SHOW_REACT, "React example screen");
        registerDropDownReceiver(reactiveDropDown, filter);

        mixedReceiver = new MixedExampleReceiver(view, context);
        DocumentedIntentFilter mixedFilter = new DocumentedIntentFilter();
        mixedFilter.addAction(SHOW_MIXED, "Mixed native + React example");
        registerDropDownReceiver(mixedReceiver, mixedFilter);

        // Benchmark-only: lets scripts put a marker load on the map that does
        // not depend on any panel being open. See NativeChurnReceiver.
        churnReceiver = new NativeChurnReceiver(view);
        churnReceiver.register(view.getContext().getApplicationContext());

        // Benchmark-only: the native counterpart of the Map Items page, and an
        // adb-reachable way to open either panel. See BenchReceiver.
        nativeListReceiver = new NativeListReceiver(view, context);
        DocumentedIntentFilter nativeFilter = new DocumentedIntentFilter();
        nativeFilter.addAction(NativeListReceiver.SHOW, "Benchmark: plain native list");
        registerDropDownReceiver(nativeListReceiver, nativeFilter);
        benchReceiver = new BenchReceiver();
        benchReceiver.register(view.getContext().getApplicationContext());

        Log.d(TAG, "Reactive example component initialized");
    }

    @Override
    protected void onDestroyImpl(Context context, MapView view) {
        if (churnReceiver != null) {
            churnReceiver.unregister(view.getContext().getApplicationContext());
        }
        if (benchReceiver != null) {
            benchReceiver.unregister(view.getContext().getApplicationContext());
        }
        super.onDestroyImpl(context, view);
    }
}
