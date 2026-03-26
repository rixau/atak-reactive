package com.atakmap.android.plugintemplate;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Switch;
import android.widget.TextView;

import com.atakmap.android.dropdown.DropDown.OnStateListener;
import com.atakmap.android.dropdown.DropDownReceiver;
import com.atakmap.android.maps.MapView;
import com.atakmap.android.reactive.ReactiveWebView;
import com.atakmap.coremap.log.Log;

/**
 * Example dropdown with native tabs + one React tab via ReactiveWebView.
 * Demonstrates incremental migration: existing native UI stays native,
 * one tab is converted to React.
 */
public class MixedExampleReceiver extends DropDownReceiver implements OnStateListener {

    private static final String TAG = "MixedExampleReceiver";
    private static final int BG_DARK = 0xFF0f0f23;
    private static final int BG_CARD = 0xFF16213e;
    private static final int TEXT_DIM = 0xFF8d99ae;
    private static final int TEXT_BRIGHT = 0xFFedf2f4;
    private static final int ACCENT = 0xFF4cc9f0;

    private final Context pluginContext;
    private ReactiveWebView reactTab;
    private int currentTab = 0;
    private FrameLayout contentArea;
    private View[] tabViews;
    private TextView[] tabButtons;

    public MixedExampleReceiver(MapView mapView, Context pluginContext) {
        super(mapView);
        this.pluginContext = pluginContext;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        LinearLayout root = new LinearLayout(pluginContext);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(BG_DARK);

        // Tab bar
        LinearLayout tabBar = new LinearLayout(pluginContext);
        tabBar.setOrientation(LinearLayout.HORIZONTAL);
        tabBar.setBackgroundColor(BG_CARD);

        String[] labels = { "Status", "Config", "React" };
        tabButtons = new TextView[3];
        for (int i = 0; i < 3; i++) {
            tabButtons[i] = createTabButton(labels[i], i);
            tabBar.addView(tabButtons[i], new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        }
        root.addView(tabBar, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        // Content area
        contentArea = new FrameLayout(pluginContext);
        root.addView(contentArea, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        // Build tab content
        tabViews = new View[3];
        tabViews[0] = createStatusTab();
        tabViews[1] = createConfigTab();

        reactTab = new ReactiveWebView(getMapView(), pluginContext, "web/index.html#/embedded");
        tabViews[2] = reactTab;

        for (View v : tabViews) {
            contentArea.addView(v, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT));
        }

        selectTab(0);

        showDropDown(root, HALF_WIDTH, FULL_HEIGHT,
                FULL_WIDTH, HALF_HEIGHT, false, this);
    }

    private TextView createTabButton(String label, final int index) {
        TextView tv = new TextView(pluginContext);
        tv.setText(label);
        tv.setTextSize(12);
        tv.setTypeface(null, Typeface.BOLD);
        tv.setGravity(Gravity.CENTER);
        tv.setPadding(0, 24, 0, 24);
        tv.setOnClickListener(v -> selectTab(index));
        return tv;
    }

    private void selectTab(int index) {
        currentTab = index;
        for (int i = 0; i < tabViews.length; i++) {
            tabViews[i].setVisibility(i == index ? View.VISIBLE : View.GONE);
            tabButtons[i].setTextColor(i == index ? ACCENT : TEXT_DIM);
        }
        if (index == 2 && reactTab != null) {
            reactTab.onResume();
        } else if (reactTab != null) {
            reactTab.onPause();
        }
    }

    // --- Native tab: Status ---

    private View createStatusTab() {
        LinearLayout layout = new LinearLayout(pluginContext);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 32, 32, 32);

        addSectionHeader(layout, "PLUGIN STATUS");
        addRow(layout, "Plugin", "atak-reactive example");
        addRow(layout, "Mode", "Mixed (native + React)");
        addRow(layout, "Android", Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");
        addRow(layout, "Native tabs", "2 (Status, Config)");
        addRow(layout, "React tabs", "1 (via ReactiveWebView)");

        addSectionHeader(layout, "ABOUT");
        TextView about = new TextView(pluginContext);
        about.setText("This dropdown demonstrates incremental migration. " +
                "The Status and Config tabs are native Android views. " +
                "The React tab is a ReactiveWebView with the full atak-reactive bridge.");
        about.setTextColor(TEXT_DIM);
        about.setTextSize(13);
        about.setPadding(0, 8, 0, 0);
        layout.addView(about);

        return layout;
    }

    // --- Native tab: Config ---

    private View createConfigTab() {
        LinearLayout layout = new LinearLayout(pluginContext);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(32, 32, 32, 32);

        addSectionHeader(layout, "DISPLAY SETTINGS");

        addSwitchRow(layout, "Show overlay markers", true);
        addSwitchRow(layout, "Auto-refresh items", false);
        addSwitchRow(layout, "Enable notifications", true);

        addSectionHeader(layout, "DATA");

        addSwitchRow(layout, "Stream CoT updates", true);
        addSwitchRow(layout, "Log bridge events", false);

        return layout;
    }

    // --- Layout helpers ---

    private void addSectionHeader(LinearLayout parent, String text) {
        TextView header = new TextView(pluginContext);
        header.setText(text);
        header.setTextColor(TEXT_DIM);
        header.setTextSize(11);
        header.setTypeface(null, Typeface.BOLD);
        header.setLetterSpacing(0.1f);
        header.setPadding(0, parent.getChildCount() > 0 ? 32 : 0, 0, 12);
        parent.addView(header);
    }

    private void addRow(LinearLayout parent, String label, String value) {
        LinearLayout row = new LinearLayout(pluginContext);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, 6, 0, 6);

        TextView labelTv = new TextView(pluginContext);
        labelTv.setText(label);
        labelTv.setTextColor(TEXT_DIM);
        labelTv.setTextSize(13);
        row.addView(labelTv, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView valueTv = new TextView(pluginContext);
        valueTv.setText(value);
        valueTv.setTextColor(TEXT_BRIGHT);
        valueTv.setTextSize(13);
        valueTv.setTypeface(Typeface.MONOSPACE);
        row.addView(valueTv);

        parent.addView(row);
    }

    private void addSwitchRow(LinearLayout parent, String label, boolean defaultValue) {
        LinearLayout row = new LinearLayout(pluginContext);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, 8, 0, 8);

        TextView labelTv = new TextView(pluginContext);
        labelTv.setText(label);
        labelTv.setTextColor(TEXT_BRIGHT);
        labelTv.setTextSize(13);
        row.addView(labelTv, new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        Switch toggle = new Switch(pluginContext);
        toggle.setChecked(defaultValue);
        row.addView(toggle);

        parent.addView(row);
    }

    // --- Dropdown lifecycle ---

    @Override
    public void onDropDownVisible(boolean visible) {
        if (currentTab == 2 && reactTab != null) {
            if (visible) reactTab.onResume();
            else reactTab.onPause();
        }
    }

    @Override
    public void onDropDownClose() {
        if (reactTab != null) {
            reactTab.destroy();
            reactTab = null;
        }
    }

    @Override
    public void onDropDownSelectionRemoved() {}

    @Override
    public void onDropDownSizeChanged(double w, double h) {}

    @Override
    public void disposeImpl() {
        if (reactTab != null) {
            reactTab.destroy();
            reactTab = null;
        }
    }
}
