package com.atakmap.android.plugintemplate.plugin;

import android.content.Context;

import com.atak.plugins.impl.AbstractPluginTool;
import com.atakmap.android.plugintemplate.ReactiveExampleComponent;

public class PluginTemplateTool extends AbstractPluginTool {

    public PluginTemplateTool(Context context) {
        super(context,
                context.getString(R.string.app_name),
                context.getString(R.string.app_name),
                context.getResources().getDrawable(R.drawable.ic_launcher, null),
                ReactiveExampleComponent.SHOW_REACT);
    }
}
