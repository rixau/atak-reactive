package dev.atakreactive.example.plugin;

import android.content.Context;

import com.atak.plugins.impl.AbstractPluginTool;

import dev.atakreactive.example.R;
import dev.atakreactive.example.ReactiveExampleComponent;

public class ReactiveExampleTool extends AbstractPluginTool {

    public ReactiveExampleTool(Context context) {
        super(context,
                context.getString(R.string.app_name),
                context.getString(R.string.app_name),
                context.getResources().getDrawable(R.drawable.ic_reactive_tool, null),
                ReactiveExampleComponent.SHOW_REACT);
    }
}
