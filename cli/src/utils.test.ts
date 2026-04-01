import { describe, it, expect } from 'vitest';
import { parseDefaultFlavor, parseAtakVersion, parseAarVersion, deriveIntentAction } from './utils.js';

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
    expect(deriveIntentAction('com.atakmap.android.plugintemplate')).toBe('com.atakmap.android.plugintemplate.SHOW_REACT');
  });

  it('works with short package names', () => {
    expect(deriveIntentAction('com.myplugin')).toBe('com.myplugin.SHOW_REACT');
  });
});
