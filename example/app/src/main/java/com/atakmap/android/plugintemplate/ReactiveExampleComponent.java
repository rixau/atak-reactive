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

    private ReactiveDropDown reactiveDropDown;

    @Override
    public void onCreate(final Context context, Intent intent,
            final MapView view) {
        context.setTheme(R.style.ATAKPluginTheme);
        super.onCreate(context, intent, view);

        reactiveDropDown = new ReactiveDropDown(view, context, "web/index.html");
        DocumentedIntentFilter filter = new DocumentedIntentFilter();
        filter.addAction(SHOW_REACT, "React example screen");
        registerDropDownReceiver(reactiveDropDown, filter);

        Log.d(TAG, "Reactive example component initialized");
    }

    @Override
    protected void onDestroyImpl(Context context, MapView view) {
        super.onDestroyImpl(context, view);
    }
}
