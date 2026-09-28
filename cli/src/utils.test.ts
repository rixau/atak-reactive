import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  parseDefaultFlavor,
  parseAtakVersion,
  parseAarVersion,
  deriveIntentAction,
  readPluginImpls,
  readRegisteredAction,
  isTemplateOwned,
  TEMPLATE_PACKAGE,
  isNewerVersion,
  fetchLatestVersion,
  parsePortArg,
  readLocalProperty,
  resolveDevPort,
  DEFAULT_DEV_PORT,
  parseReversedPorts,
  parseAdbDevices,
  parseAdbDeviceList,
} from './utils.js';

describe('parseDefaultFlavor', () => {
  // --- Pattern 2: direct productFlavors with getIsDefault ---

  it('detects mil as default (single line)', () => {
    expect(parseDefaultFlavor(
      'productFlavors { mil { getIsDefault().set(true) } }'
    )).toBe('mil');
  });

  it('detects civ as default (single line)', () => {
    expect(parseDefaultFlavor(
      'productFlavors { civ { getIsDefault().set(true) } }'
    )).toBe('civ');
  });

  it('detects gov as default (single line)', () => {
    expect(parseDefaultFlavor(
      'productFlavors { gov { getIsDefault().set(true) } }'
    )).toBe('gov');
  });

  it('detects mil with multiline formatting', () => {
    expect(parseDefaultFlavor(`
      productFlavors {
          mil {
              getIsDefault().set(true)
          }
      }
    `)).toBe('mil');
  });

  it('detects mil when multiple flavors defined', () => {
    expect(parseDefaultFlavor(`
      productFlavors {
          civ {
          }
          mil {
              getIsDefault().set(true)
          }
      }
    `)).toBe('mil');
  });

  it('detects gov when multiple flavors with extra config', () => {
    expect(parseDefaultFlavor(`
      productFlavors {
          civ {
              dimension 'atakFlavor'
          }
          mil {
              dimension 'atakFlavor'
          }
          gov {
              getIsDefault().set(true)
              dimension 'atakFlavor'
          }
      }
    `)).toBe('gov');
  });

  it('detects civ with tabs instead of spaces', () => {
    expect(parseDefaultFlavor(
      "productFlavors {\n\tciv {\n\t\tgetIsDefault().set(true)\n\t}\n}"
    )).toBe('civ');
  });

  it('does not capture productFlavors as the flavor name', () => {
    const result = parseDefaultFlavor(
      'productFlavors { mil { getIsDefault().set(true) } }'
    );
    expect(result).not.toBe('productFlavors');
  });

  it('handles no space before brace', () => {
    expect(parseDefaultFlavor(
      'productFlavors{ mil{ getIsDefault().set(true) } }'
    )).toBe('mil');
  });

  // --- Pattern 1: supportedFlavors array ---

  it('detects from supportedFlavors array (civ)', () => {
    expect(parseDefaultFlavor(`
      supportedFlavors = [
          [ name : 'civ', default: true ],
          [ name : 'mil' ],
      ]
    `)).toBe('civ');
  });

  it('detects from supportedFlavors array (mil)', () => {
    expect(parseDefaultFlavor(`
      supportedFlavors = [
          [ name : 'civ' ],
          [ name : 'mil', default: true ],
      ]
    `)).toBe('mil');
  });

  it('detects from supportedFlavors array (gov)', () => {
    expect(parseDefaultFlavor(`
      supportedFlavors = [
          [ name : 'gov', default: true ],
      ]
    `)).toBe('gov');
  });

  it('rejects invalid flavor in supportedFlavors array', () => {
    expect(parseDefaultFlavor(`
      supportedFlavors = [
          [ name : 'custom', default: true ],
      ]
    `)).toBe('civ');
  });

  // --- Invalid / missing / edge cases ---

  it('returns civ when no flavors defined', () => {
    expect(parseDefaultFlavor('android { buildTypes { } }')).toBe('civ');
  });

  it('returns civ for empty string', () => {
    expect(parseDefaultFlavor('')).toBe('civ');
  });

  it('returns civ when no default is set', () => {
    expect(parseDefaultFlavor(`
      productFlavors {
          civ { }
          mil { }
      }
    `)).toBe('civ');
  });

  it('rejects invalid flavor names', () => {
    expect(parseDefaultFlavor(
      'productFlavors { debug { getIsDefault().set(true) } }'
    )).toBe('civ');
  });

  it('rejects android as a flavor name', () => {
    expect(parseDefaultFlavor(
      'android { getIsDefault().set(true) }'
    )).toBe('civ');
  });

  it('handles real-world full build.gradle snippet', () => {
    expect(parseDefaultFlavor(`
      android {
          compileSdk 34
          buildToolsVersion '34.0.0'

          defaultConfig {
              applicationId "com.example.plugin"
              minSdk 21
              targetSdk 34
          }

          productFlavors {
              mil {
                  getIsDefault().set(true)
                  dimension 'atakFlavor'
              }
              civ {
                  dimension 'atakFlavor'
              }
          }

          buildTypes {
              debug {
                  debuggable true
                  matchingFallbacks = ['sdk']
              }
              release {
                  minifyEnabled true
              }
          }
      }
    `)).toBe('mil');
  });

  it('handles real-world supportedFlavors build.gradle snippet', () => {
    expect(parseDefaultFlavor(`
      buildscript {
          ext {
              ATAK_VERSION = "5.6.0"
          }
      }
      def supportedFlavors = [
          [ name : 'mil', default: true ],
          [ name : 'civ' ],
          [ name : 'gov' ],
      ]
    `)).toBe('mil');
  });
});

describe('parseAtakVersion', () => {
  it('detects version with double quotes', () => {
    expect(parseAtakVersion('ATAK_VERSION = "5.6.0"')).toBe('5.6.0');
  });

  it('detects version with single quotes', () => {
    expect(parseAtakVersion("ATAK_VERSION = '5.6.0'")).toBe('5.6.0');
  });

  it('detects version without spaces around equals', () => {
    expect(parseAtakVersion('ATAK_VERSION="5.5.1"')).toBe('5.5.1');
  });

  it('detects version with extra spaces', () => {
    expect(parseAtakVersion('ATAK_VERSION  =  "5.4.0"')).toBe('5.4.0');
  });

  it('detects version in ext block', () => {
    expect(parseAtakVersion(`
      buildscript {
          ext {
              ATAK_VERSION = "5.6.0"
          }
      }
    `)).toBe('5.6.0');
  });

  it('detects version in ext shorthand', () => {
    expect(parseAtakVersion(`
      ext.ATAK_VERSION = "5.5.0"
    `)).toBe('5.5.0');
  });

  it('returns null for missing version', () => {
    expect(parseAtakVersion('android { }')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAtakVersion('')).toBeNull();
  });

  it('returns null for malformed version', () => {
    expect(parseAtakVersion('ATAK_VERSION = "abc"')).toBeNull();
  });

  it('returns null for incomplete version', () => {
    expect(parseAtakVersion('ATAK_VERSION = "5.6"')).toBeNull();
  });

  it('detects version in full build.gradle', () => {
    expect(parseAtakVersion(`
      buildscript {
          ext {
              ATAK_VERSION = "5.6.0"
              PLUGIN_VERSION = "1.0.0"
          }
          dependencies {
              classpath 'com.android.tools.build:gradle:8.2.0'
          }
      }
    `)).toBe('5.6.0');
  });
});

describe('parseAarVersion', () => {
  it('detects version from implementation line', () => {
    expect(parseAarVersion(
      'implementation "dev.atakreactive:bridge-5.6.0:0.1.11"'
    )).toBe('0.1.11');
  });

  it('detects version with single quotes', () => {
    expect(parseAarVersion(
      "implementation 'dev.atakreactive:bridge-5.6.0:0.1.11'"
    )).toBe('0.1.11');
  });

  it('detects version for different ATAK versions', () => {
    expect(parseAarVersion(
      'implementation "dev.atakreactive:bridge-5.4.0:0.1.8"'
    )).toBe('0.1.8');
  });

  it('detects version for 5.5.1', () => {
    expect(parseAarVersion(
      'implementation "dev.atakreactive:bridge-5.5.1:0.1.10"'
    )).toBe('0.1.10');
  });

  it('detects version in full dependencies block', () => {
    expect(parseAarVersion(`
      dependencies {
          implementation fileTree(dir: 'libs', include: ['*.jar'])
          implementation "dev.atakreactive:bridge-5.6.0:0.1.11"
          implementation 'androidx.webkit:webkit:1.12.1'
      }
    `)).toBe('0.1.11');
  });

  it('returns null when no AAR present', () => {
    expect(parseAarVersion(`
      dependencies {
          implementation fileTree(dir: 'libs', include: ['*.jar'])
      }
    `)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAarVersion('')).toBeNull();
  });
});

describe('deriveIntentAction', () => {
  it('appends SHOW_REACT to package name', () => {
    expect(deriveIntentAction('com.example.plugin')).toBe('com.example.plugin.SHOW_REACT');
  });

  it('works with deep package names', () => {
    expect(deriveIntentAction('com.acme.android.deep.plugin')).toBe('com.acme.android.deep.plugin.SHOW_REACT');
  });

  it('works with short package names', () => {
    expect(deriveIntentAction('com.myplugin')).toBe('com.myplugin.SHOW_REACT');
  });
});

describe('isNewerVersion', () => {
  it('detects a newer patch, minor, and major', () => {
    expect(isNewerVersion('0.1.13', '0.1.2')).toBe(true);
    expect(isNewerVersion('0.2.0', '0.1.13')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true);
  });

  it('is false for equal or older versions', () => {
    expect(isNewerVersion('0.1.13', '0.1.13')).toBe(false);
    expect(isNewerVersion('0.1.2', '0.1.13')).toBe(false);
    expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false);
  });

  it('compares numerically, not lexically (the 0.1.2 vs 0.1.13 trap)', () => {
    expect(isNewerVersion('0.1.13', '0.1.9')).toBe(true);
    expect('0.1.13' > '0.1.9').toBe(false); // string compare would get this wrong
  });

  it('handles pre-release suffixes and uneven segment counts', () => {
    expect(isNewerVersion('0.2.0-beta.1', '0.1.13')).toBe(true);
    expect(isNewerVersion('0.1.13', '0.1')).toBe(true);
    expect(isNewerVersion('0.1', '0.1.0')).toBe(false);
  });
});

describe('fetchLatestVersion', () => {
  it('returns null immediately when opted out', async () => {
    const prev = process.env.ATAK_REACTIVE_NO_UPDATE_CHECK;
    process.env.ATAK_REACTIVE_NO_UPDATE_CHECK = '1';
    expect(await fetchLatestVersion()).toBeNull();
    if (prev === undefined) delete process.env.ATAK_REACTIVE_NO_UPDATE_CHECK;
    else process.env.ATAK_REACTIVE_NO_UPDATE_CHECK = prev;
  });
});

describe('dev server port resolution', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'atak-port-'));

  it('parses --port', () => {
    expect(parsePortArg(['dev', '--port', '5174'])).toBe(5174);
    expect(parsePortArg(['dev'])).toBeUndefined();
  });

  it('rejects an invalid --port instead of silently defaulting', () => {
    expect(() => parsePortArg(['dev', '--port', 'abc'])).toThrow();
    expect(() => parsePortArg(['dev', '--port', '80'])).toThrow();
    expect(() => parsePortArg(['dev', '--port'])).toThrow();
  });

  it('reads devServerPort from local.properties', () => {
    writeFileSync(join(tmp, 'local.properties'), '# c\nsdk.dir=/x\ndevServerPort=5180\n');
    expect(readLocalProperty(tmp, 'devServerPort')).toBe('5180');
    expect(resolveDevPort(tmp)).toBe(5180);
  });

  it('lets --port win over local.properties', () => {
    expect(resolveDevPort(tmp, 5199)).toBe(5199);
  });

  it('defaults to 5173 when unset', () => {
    const empty = mkdtempSync(join(tmpdir(), 'atak-port-empty-'));
    expect(resolveDevPort(empty)).toBe(DEFAULT_DEV_PORT);
  });

  it('parses device ports out of adb reverse --list', () => {
    expect(parseReversedPorts('host-19 tcp:5173 tcp:5173\nhost-19 tcp:5174 tcp:9999'))
      .toEqual([5173, 5174]);
    expect(parseReversedPorts('')).toEqual([]);
  });

  it('parses attached devices, ignoring offline/unauthorized', () => {
    const out = 'List of devices attached\nemulator-5554\tdevice\nfoo\toffline\nbar\tunauthorized';
    expect(parseAdbDevices(out)).toEqual(['emulator-5554']);
  });

  it('keeps unusable transports in the full list, with their state', () => {
    const out = 'List of devices attached\nemulator-5554\tdevice\nfoo\toffline\nbar\tunauthorized';
    expect(parseAdbDeviceList(out)).toEqual([
      { serial: 'emulator-5554', state: 'device' },
      { serial: 'foo', state: 'offline' },
      { serial: 'bar', state: 'unauthorized' },
    ]);
  });

  it('ignores daemon chatter and blank lines', () => {
    const out =
      '* daemon not running; starting now at tcp:5037 *\n' +
      '* daemon started successfully *\n' +
      'List of devices attached\n\nemulator-5554\tdevice\n\n';
    expect(parseAdbDeviceList(out)).toEqual([{ serial: 'emulator-5554', state: 'device' }]);
    expect(parseAdbDevices(out)).toEqual(['emulator-5554']);
  });

  it('handles adb devices -l extra columns', () => {
    const out = 'List of devices attached\nemulator-5554     device product:sdk_gphone64 model:Pixel_7';
    expect(parseAdbDeviceList(out)).toEqual([{ serial: 'emulator-5554', state: 'device' }]);
  });

  it('returns nothing for an empty list', () => {
    expect(parseAdbDeviceList('List of devices attached\n')).toEqual([]);
  });
});

describe('readPluginImpls', () => {
  /** Write a plugin.xml into a throwaway app dir and return that dir. */
  const withPluginXml = (body: string): string => {
    const appDir = mkdtempSync(join(tmpdir(), 'atak-impl-'));
    mkdirSync(join(appDir, 'src', 'main', 'assets'), { recursive: true });
    writeFileSync(join(appDir, 'src', 'main', 'assets', 'plugin.xml'), body);
    return appDir;
  };

  it('returns every extension, not just the first', () => {
    // ATAK asks for IPlugin and IToolbarItem separately and de-dupes each one,
    // so a renamed first extension does not make a later one safe.
    const dir = withPluginXml(`<plugin>
  <extension type="gov.tak.api.plugin.IPlugin" impl="com.acme.recon.plugin.ReconLifecycle" singleton="true" />
  <extension type="com.atak.plugins.impl.IToolbarItem" impl="${TEMPLATE_PACKAGE}.plugin.PluginTemplateTool" singleton="true" />
</plugin>`);
    expect(readPluginImpls(dir)).toEqual([
      'com.acme.recon.plugin.ReconLifecycle',
      `${TEMPLATE_PACKAGE}.plugin.PluginTemplateTool`,
    ]);
  });

  it('ignores commented-out extensions, as ATAK does', () => {
    // SimpleXML drops comments, so a half-finished rename that left the old
    // impl in a comment block must not be reported as a live collision.
    const dir = withPluginXml(`<plugin>
  <!-- was: <extension impl="${TEMPLATE_PACKAGE}.plugin.PluginTemplateLifecycle" /> -->
  <extension type="gov.tak.api.plugin.IPlugin" impl="com.acme.recon.plugin.ReconLifecycle" singleton="true" />
</plugin>`);
    expect(readPluginImpls(dir)).toEqual(['com.acme.recon.plugin.ReconLifecycle']);
  });

  it('accepts single-quoted attributes', () => {
    const dir = withPluginXml(`<plugin><extension impl='com.acme.recon.plugin.ReconLifecycle' /></plugin>`);
    expect(readPluginImpls(dir)).toEqual(['com.acme.recon.plugin.ReconLifecycle']);
  });

  it('does not match a longer attribute ending in impl', () => {
    const dir = withPluginXml(`<plugin><extension simpl="nope" impl="com.acme.Real" /></plugin>`);
    expect(readPluginImpls(dir)).toEqual(['com.acme.Real']);
  });

  it('returns nothing when there is no plugin.xml', () => {
    expect(readPluginImpls(mkdtempSync(join(tmpdir(), 'atak-impl-')))).toEqual([]);
  });
});

describe('isTemplateOwned', () => {
  it('matches a class under the template package', () => {
    expect(isTemplateOwned(`${TEMPLATE_PACKAGE}.plugin.PluginTemplateLifecycle`)).toBe(true);
  });

  it('requires a package boundary, not a bare prefix', () => {
    // com.atakmap.android.plugintemplatex is somebody else's package entirely.
    expect(isTemplateOwned(`${TEMPLATE_PACKAGE}x.plugin.Foo`)).toBe(false);
  });

  it('is false for a renamed class and for null', () => {
    expect(isTemplateOwned('com.acme.recon.plugin.ReconLifecycle')).toBe(false);
    expect(isTemplateOwned(null)).toBe(false);
  });
});

describe('readRegisteredAction', () => {
  const withSource = (body: string): string => {
    const dir = mkdtempSync(join(tmpdir(), 'atak-act-'));
    const file = join(dir, 'PluginMapComponent.java');
    writeFileSync(file, body);
    return file;
  };

  it('reads the action out of an injected registration', () => {
    const file = withSource(`
      ReactiveDropDown reactScreen = new ReactiveDropDown(view, context, "web/index.html");
      DocumentedIntentFilter reactFilter = new DocumentedIntentFilter();
      reactFilter.addAction("com.acme.recon.SHOW_REACT",
              "React screen powered by atak-reactive");
    `);
    expect(readRegisteredAction(file)).toBe('com.acme.recon.SHOW_REACT');
  });

  it('ignores addAction calls on other filters', () => {
    const file = withSource(`
      otherFilter.addAction("com.acme.other.SOMETHING", "not ours");
      reactFilter.addAction("com.acme.recon.SHOW_REACT", "ours");
    `);
    expect(readRegisteredAction(file)).toBe('com.acme.recon.SHOW_REACT');
  });

  it('returns null when nothing is registered, and for a missing file', () => {
    expect(readRegisteredAction(withSource('public class Foo {}'))).toBeNull();
    expect(readRegisteredAction(join(tmpdir(), 'does-not-exist-atak.java'))).toBeNull();
  });
});
