package com.atakmap.android.reactive;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Map;

import org.junit.Test;

public class BridgeRegistryTest {

    // Two classes with the same simple name in different "packages", the way
    // com.a.Bridge and com.b.Bridge would be.
    static class First {
        static class Bridge {}
    }

    static class Second {
        static class Bridge {}
    }

    static class MyBridge {}

    static class Atak {}

    static class Other {}

    private static IllegalArgumentException expectThrows(Runnable r) {
        try {
            r.run();
        } catch (IllegalArgumentException e) {
            return e;
        }
        fail("expected IllegalArgumentException");
        return null;
    }

    @Test
    public void derivedNameIsSimpleNameWithLowerFirstLetter() {
        assertEquals("myBridge", BridgeRegistry.derivedName(new MyBridge()));
        assertEquals("atak", BridgeRegistry.derivedName(new Atak()));
    }

    @Test
    public void derivedNameIgnoresThePackage() {
        assertEquals(BridgeRegistry.derivedName(new First.Bridge()),
                BridgeRegistry.derivedName(new Second.Bridge()));
    }

    @Test
    public void jsNameIsUnderscorePrefixed() {
        assertEquals("_platformSim", BridgeRegistry.jsName("platformSim"));
    }

    @Test
    public void addReturnsTheJsName() {
        BridgeRegistry registry = new BridgeRegistry();
        assertEquals("_platformSim", registry.add("platformSim", new MyBridge()));
    }

    @Test
    public void validNamesAreAccepted() {
        BridgeRegistry registry = new BridgeRegistry();
        for (String name : Arrays.asList("a", "Z", "platformSim", "sim_2", "x9_y")) {
            registry.add(name, new Other());
        }
        assertEquals(5, registry.entries().size());
    }

    @Test
    public void invalidNamesAreRejected() {
        for (String name : Arrays.asList("", "_sim", "2sim", "my-bridge", "my.bridge",
                "my bridge", "sim$", "été")) {
            BridgeRegistry registry = new BridgeRegistry();
            IllegalArgumentException e = expectThrows(() -> registry.add(name, new Other()));
            assertTrue(e.getMessage(), e.getMessage().contains("\"" + name + "\""));
            assertTrue(registry.entries().isEmpty());
        }
    }

    @Test
    public void nullNameIsRejected() {
        BridgeRegistry registry = new BridgeRegistry();
        expectThrows(() -> registry.add(null, new Other()));
        assertTrue(registry.entries().isEmpty());
    }

    @Test
    public void nullBridgeIsRejected() {
        BridgeRegistry registry = new BridgeRegistry();
        expectThrows(() -> registry.add("sim", null));
        expectThrows(() -> BridgeRegistry.derivedName(null));
        assertTrue(registry.entries().isEmpty());
    }

    @Test
    public void atakIsReserved() {
        BridgeRegistry registry = new BridgeRegistry();
        IllegalArgumentException e = expectThrows(() -> registry.add("atak", new Other()));
        assertTrue(e.getMessage(), e.getMessage().contains("\"_atak\""));
        assertTrue(e.getMessage(), e.getMessage().contains("reserved"));
        assertTrue(e.getMessage(), e.getMessage().contains("built-in"));
        assertTrue(e.getMessage(), e.getMessage().contains(Other.class.getName()));
        assertTrue(registry.entries().isEmpty());
    }

    @Test
    public void classNamedAtakDerivesTheReservedName() {
        // The deprecated addBridge(Object) path: a class called Atak used to
        // replace the built-in bridge and blank the whole app.
        BridgeRegistry registry = new BridgeRegistry();
        Atak atak = new Atak();
        IllegalArgumentException e = expectThrows(
                () -> registry.add(BridgeRegistry.derivedName(atak), atak));
        assertTrue(e.getMessage(), e.getMessage().contains(Atak.class.getName()));
        assertTrue(registry.entries().isEmpty());
    }

    @Test
    public void duplicateExplicitNameIsRejectedNamingBothClasses() {
        BridgeRegistry registry = new BridgeRegistry();
        MyBridge first = new MyBridge();
        registry.add("sim", first);
        IllegalArgumentException e = expectThrows(() -> registry.add("sim", new Other()));
        assertTrue(e.getMessage(), e.getMessage().contains("\"_sim\""));
        assertTrue(e.getMessage(), e.getMessage().contains(MyBridge.class.getName()));
        assertTrue(e.getMessage(), e.getMessage().contains(Other.class.getName()));
        assertEquals(1, registry.entries().size());
        assertSame(first, registry.entries().get("_sim"));
    }

    @Test
    public void sameSimpleNameInDifferentPackagesIsRejectedNamingBothClasses() {
        BridgeRegistry registry = new BridgeRegistry();
        First.Bridge a = new First.Bridge();
        Second.Bridge b = new Second.Bridge();
        registry.add(BridgeRegistry.derivedName(a), a);
        IllegalArgumentException e = expectThrows(
                () -> registry.add(BridgeRegistry.derivedName(b), b));
        assertTrue(e.getMessage(), e.getMessage().contains("\"_bridge\""));
        assertTrue(e.getMessage(), e.getMessage().contains(First.Bridge.class.getName()));
        assertTrue(e.getMessage(), e.getMessage().contains(Second.Bridge.class.getName()));
        assertSame(a, registry.entries().get("_bridge"));
    }

    @Test
    public void explicitNameClashesWithDerivedName() {
        // addBridge(Object) first, then addBridge(String, Object) with the name it
        // derived, and the other way round.
        BridgeRegistry registry = new BridgeRegistry();
        MyBridge derived = new MyBridge();
        registry.add(BridgeRegistry.derivedName(derived), derived);
        IllegalArgumentException e = expectThrows(() -> registry.add("myBridge", new Other()));
        assertTrue(e.getMessage(), e.getMessage().contains(MyBridge.class.getName()));
        assertTrue(e.getMessage(), e.getMessage().contains(Other.class.getName()));

        BridgeRegistry reversed = new BridgeRegistry();
        reversed.add("myBridge", new Other());
        expectThrows(() -> reversed.add(BridgeRegistry.derivedName(derived), derived));
        assertEquals(1, reversed.entries().size());
    }

    @Test
    public void sameInstanceTwiceUnderOneNameLeavesOneEntry() {
        BridgeRegistry registry = new BridgeRegistry();
        MyBridge bridge = new MyBridge();
        registry.add("sim", bridge);
        expectThrows(() -> registry.add("sim", bridge));
        assertEquals(1, registry.entries().size());
    }

    @Test
    public void namesAreCaseSensitive() {
        BridgeRegistry registry = new BridgeRegistry();
        registry.add("sim", new MyBridge());
        registry.add("Sim", new Other());
        registry.add("Atak", new Other());
        assertEquals(3, registry.entries().size());
    }

    @Test
    public void entriesKeepRegistrationOrder() {
        BridgeRegistry registry = new BridgeRegistry();
        Object z = new Other();
        Object a = new MyBridge();
        Object m = new Other();
        registry.add("zeta", z);
        registry.add("alpha", a);
        try {
            registry.add("zeta", new Other());
        } catch (IllegalArgumentException expected) {
            // A refused duplicate must not disturb the order.
        }
        registry.add("mid", m);

        Map<String, Object> entries = registry.entries();
        assertEquals(Arrays.asList("_zeta", "_alpha", "_mid"),
                new ArrayList<>(entries.keySet()));
        assertEquals(Arrays.asList(z, a, m), new ArrayList<>(entries.values()));
    }

    @Test(expected = UnsupportedOperationException.class)
    public void entriesAreReadOnly() {
        BridgeRegistry registry = new BridgeRegistry();
        registry.entries().put("_sim", new Other());
    }
}
