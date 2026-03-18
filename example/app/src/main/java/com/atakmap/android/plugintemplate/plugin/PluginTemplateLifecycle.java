package com.atakmap.android.plugintemplate.plugin;

import com.atak.plugins.impl.AbstractPlugin;
import com.atak.plugins.impl.PluginContextProvider;
import com.atakmap.android.plugintemplate.ReactiveExampleComponent;
import gov.tak.api.plugin.IServiceController;

public class PluginTemplateLifecycle extends AbstractPlugin {

    public PluginTemplateLifecycle(IServiceController serviceController) {
        super(serviceController,
                new PluginTemplateTool(
                        serviceController.getService(PluginContextProvider.class)
                                .getPluginContext()),
                new ReactiveExampleComponent());
    }
}
