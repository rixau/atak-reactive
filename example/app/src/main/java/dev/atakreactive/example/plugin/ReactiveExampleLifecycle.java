package dev.atakreactive.example.plugin;

import com.atak.plugins.impl.AbstractPlugin;
import com.atak.plugins.impl.PluginContextProvider;
import dev.atakreactive.example.ReactiveExampleComponent;
import gov.tak.api.plugin.IServiceController;

public class ReactiveExampleLifecycle extends AbstractPlugin {

    public ReactiveExampleLifecycle(IServiceController serviceController) {
        super(serviceController,
                new ReactiveExampleTool(
                        serviceController.getService(PluginContextProvider.class)
                                .getPluginContext()),
                new ReactiveExampleComponent());
    }
}
