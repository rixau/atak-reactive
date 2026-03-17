package com.atakmap.android.helloworld;

import android.content.Context;

import com.atakmap.android.maps.MapView;
import com.atakmap.android.reactive.ReactiveDropDown;

/**
 * Example React-based screen in an existing ATAK plugin.
 * This coexists with all the native Java UI screens in HelloWorld.
 *
 * The UI is defined in web/src/App.tsx and hot-reloads during development.
 */
public class ReactSettingsReceiver extends ReactiveDropDown {

    public static final String SHOW_REACT_SETTINGS =
            "com.atakmap.android.helloworld.SHOW_REACT_SETTINGS";

    public ReactSettingsReceiver(MapView mapView, Context pluginContext) {
        super(mapView, pluginContext, "web/index.html");
    }
}
