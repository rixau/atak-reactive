import { describe, it, expect } from 'vitest';
import { createServer } from 'net';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { makeFixture, runCli, BUILT_CLI_VERSION, type Fixture } from './__testkit.js';

const isWin = process.platform === 'win32';

/** Hold a real port so the CLI's preflight sees it as taken. */
async function withPortHeld<T>(port: number, fn: () => T | Promise<T>): Promise<T> {
  const server = createServer();
  await new Promise<void>((res, rej) => {
    server.once('error', rej);
    server.listen(port, '0.0.0.0', () => res());
  });
  try {
    return await fn();
  } finally {
    await new Promise<void>((res) => server.close(() => res()));
  }
}

const gradleCalls = (fx: Fixture) => fx.calls().filter((c) => c.startsWith('gradlew'));
const adbCalls = (fx: Fixture) => fx.calls().filter((c) => c.startsWith('adb'));

describe.skipIf(isWin)('dev — preflight runs before anything expensive', () => {
  it('aborts with no device, without building or installing', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev'], { devices: 'List of devices attached' });

    expect(r.status).toBe(1);
    expect(r.out).toContain('No device or emulator connected');
    // the regression: this used to run a full Gradle build and install first
    expect(gradleCalls(fx)).toHaveLength(0);
    expect(fx.calls().some((c) => c.startsWith('adb install'))).toBe(false);
  });

  it('aborts when more than one device is attached', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev'], {
      devices: 'List of devices attached\nemulator-5554\tdevice\nR58M\tdevice',
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('More than one device');
    expect(gradleCalls(fx)).toHaveLength(0);
  });

  it('aborts when a second device is attached but unusable', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev'], {
      devices: 'List of devices attached\nemulator-5554\tdevice\nR58M\tunauthorized',
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('More than one device');
    expect(r.out).toContain('R58M (unauthorized)');
    expect(gradleCalls(fx)).toHaveLength(0);
    expect(fx.calls().some((c) => c.startsWith('adb install'))).toBe(false);
  });

  it('proceeds past an unusable sibling when ANDROID_SERIAL picks the usable one', () => {
    const fx = makeFixture();
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    const r = runCli(fx, ['dev', 'install'], {
      devices: 'List of devices attached\nemulator-5554\tdevice\nR58M\toffline',
      env: { ANDROID_SERIAL: 'emulator-5554' },
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain('Preflight OK — device emulator-5554');
    expect(fx.calls().some((c) => c.startsWith('adb install'))).toBe(true);
  });

  it('names the state when the only device is attached but unusable', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev'], {
      devices: 'List of devices attached\nR58M\tunauthorized',
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('No usable device');
    expect(r.out).toContain('R58M (unauthorized)');
    // not the "nothing connected" message — something is plugged in
    expect(r.out).not.toContain('No device or emulator connected');
    expect(gradleCalls(fx)).toHaveLength(0);
  });

  it('aborts when the device port is already forwarded, leaving the tunnel alone', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev'], { reverseList: `host-19 tcp:${fx.port} tcp:${fx.port}` });

    expect(r.status).toBe(1);
    expect(r.out).toContain('already forwarded');
    expect(gradleCalls(fx)).toHaveLength(0);
    // must not re-register (that silently hijacked the other plugin's tunnel)
    expect(fx.calls().some((c) => c.startsWith('adb reverse tcp:'))).toBe(false);
  });

  it('aborts when the host port is taken, without disturbing it', async () => {
    const fx = makeFixture();
    const r = await withPortHeld(fx.port, () => runCli(fx, ['dev']));

    expect(r.status).toBe(1);
    expect(r.out).toContain('already in use');
    expect(gradleCalls(fx)).toHaveLength(0);
  });

  it('rejects an invalid --port before doing anything', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev', '--port', 'abc']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Invalid --port');
    expect(fx.calls()).toHaveLength(0);
  });

  it('aborts when web/node_modules is missing', () => {
    const fx = makeFixture({ withNodeModules: false });
    const r = runCli(fx, ['dev']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('dependencies not installed');
    expect(gradleCalls(fx)).toHaveLength(0);
  });
});

describe.skipIf(isWin)('dev — port propagation', () => {
  it('carries devServerPort from local.properties to Gradle, adb and Vite', () => {
    const fx = makeFixture();
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    runCli(fx, ['dev']);

    expect(gradleCalls(fx).join()).toContain(`-PdevServerPort=${fx.port}`);
    expect(fx.calls()).toContain(`adb reverse tcp:${fx.port} tcp:${fx.port}`);
    expect(fx.calls().some((c) => c.includes('vite') && c.includes(`--port ${fx.port}`))).toBe(true);
    expect(fx.calls().some((c) => c.includes('--strictPort'))).toBe(true);
  });

  it('lets --port override local.properties', () => {
    const fx = makeFixture();
    const override = fx.port + 1;
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    runCli(fx, ['dev', '--port', String(override)]);

    expect(gradleCalls(fx).join()).toContain(`-PdevServerPort=${override}`);
    expect(gradleCalls(fx).join()).not.toContain(`-PdevServerPort=${fx.port}`);
    expect(fx.calls()).toContain(`adb reverse tcp:${override} tcp:${override}`);
  });

  it('removes its own tunnel on exit, and only its own', () => {
    const fx = makeFixture();
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    runCli(fx, ['dev']);
    expect(fx.calls()).toContain(`adb reverse --remove tcp:${fx.port}`);
  });
});

describe.skipIf(isWin)('dev — APK selection', () => {
  it('installs the newest APK, not whatever readdir returns first', () => {
    const fx = makeFixture();
    // "aaa" sorts first but is older — readdir order would install the stale one
    fx.addApk('debug', 'aaa-old-debug.apk', Date.now() - 600_000);
    fx.addApk('debug', 'zzz-new-debug.apk', Date.now());
    runCli(fx, ['dev']);

    const install = fx.calls().find((c) => c.startsWith('adb install'));
    expect(install).toContain('zzz-new-debug.apk');
    expect(install).not.toContain('aaa-old-debug.apk');
  });
});

describe.skipIf(isWin)('dev serve — no build, no install', () => {
  it('opens the tunnel and starts Vite without touching Gradle or the APK', () => {
    const fx = makeFixture();
    runCli(fx, ['dev', 'serve']);

    expect(gradleCalls(fx)).toHaveLength(0);
    expect(fx.calls().some((c) => c.startsWith('adb install'))).toBe(false);
    expect(fx.calls()).toContain(`adb reverse tcp:${fx.port} tcp:${fx.port}`);
    expect(fx.calls().some((c) => c.includes('vite') && c.includes(`--port ${fx.port}`))).toBe(true);
  });

  it('runs the same preflight as dev', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev', 'serve'], { devices: 'List of devices attached' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('No device or emulator connected');
    expect(adbCalls(fx).some((c) => c.startsWith('adb reverse tcp:'))).toBe(false);
  });
});

describe.skipIf(isWin)('build', () => {
  const WEB_TASK = `
task buildWebAssets(type: Exec) {
    workingDir "\${rootDir}/web"
    commandLine 'npm', 'run', 'build'
}
preBuild.dependsOn buildWebAssets
`;

  it('excludes buildWebAssets so web assets are not built twice', () => {
    const fx = makeFixture({ gradleExtra: WEB_TASK });
    runCli(fx, ['build']);
    expect(gradleCalls(fx).join()).toContain('-x buildWebAssets');
  });

  it('does not pass -x when the project has no such task', () => {
    const fx = makeFixture();
    runCli(fx, ['build']);
    expect(gradleCalls(fx).join()).not.toContain('-x buildWebAssets');
  });

  it('reports the newest release APK, not readdir order', () => {
    const fx = makeFixture();
    fx.addApk('release', 'aaa-old-release.apk', Date.now() - 600_000);
    fx.addApk('release', 'zzz-new-release.apk', Date.now());
    const r = runCli(fx, ['build']);
    expect(r.out).toContain('zzz-new-release.apk');
    expect(r.out).not.toContain('aaa-old-release.apk');
  });

  it('aborts when web/node_modules is missing', () => {
    const fx = makeFixture({ withNodeModules: false });
    const r = runCli(fx, ['build']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('dependencies not installed');
    expect(gradleCalls(fx)).toHaveLength(0);
  });
});

describe.skipIf(isWin)('init — generated Gradle and config', () => {
  it('emits a resValue that reads local.properties, not project.properties', () => {
    const fx = makeFixture();
    runCli(fx, ['init']);
    const gradle = readFileSync(join(fx.root, 'app', 'build.gradle'), 'utf-8');

    // Gradle only loads gradle.properties into project properties, so the
    // project.properties[...] form always resolves to the default.
    expect(gradle).not.toContain("project.properties['devServerPort']");
    expect(gradle).not.toContain("project.properties['devServerHost']");
    expect(gradle).toContain('atak_reactive_dev_port');
    expect(gradle).toContain('atak_reactive_dev_host');
    expect(gradle).toContain("rootProject.file('local.properties')");
  });

  it('refreshes a stale vite.config.ts on an existing project, keeping a backup', () => {
    const fx = makeFixture();
    runCli(fx, ['init']);

    // simulate a project scaffolded before strictPort existed
    const cfg = join(fx.root, 'web', 'vite.config.ts');
    writeFileSync(cfg, "export default { server: { port: 5173 } };\n");
    runCli(fx, ['init']);

    const updated = readFileSync(cfg, 'utf-8');
    expect(updated).toContain('strictPort');
    expect(existsSync(`${cfg}.bak`)).toBe(true);
    expect(readFileSync(`${cfg}.bak`, 'utf-8')).toContain('port: 5173');
  });

  it('leaves an already-current vite.config.ts alone', () => {
    const fx = makeFixture({ withWeb: false });
    runCli(fx, ['init']);
    const cfg = join(fx.root, 'web', 'vite.config.ts');
    const before = readFileSync(cfg, 'utf-8');
    runCli(fx, ['init']);
    expect(readFileSync(cfg, 'utf-8')).toBe(before);
    expect(existsSync(`${cfg}.bak`)).toBe(false);
  });

  it('is idempotent — re-running does not duplicate the resValues', () => {
    const fx = makeFixture();
    runCli(fx, ['init']);
    runCli(fx, ['init']);
    const gradle = readFileSync(join(fx.root, 'app', 'build.gradle'), 'utf-8');
    expect(gradle.split('atak_reactive_dev_port').length - 1).toBe(1);
    expect(gradle.split('atak_reactive_dev_host').length - 1).toBe(1);
  });
});

describe.skipIf(isWin)('--port forms', () => {
  it('accepts --port=N as well as --port N', () => {
    const fx = makeFixture();
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    const p = fx.port + 3;
    runCli(fx, ['dev', `--port=${p}`]);
    expect(gradleCalls(fx).join()).toContain(`-PdevServerPort=${p}`);
    expect(fx.calls()).toContain(`adb reverse tcp:${p} tcp:${p}`);
  });

  it('rejects a malformed --port= value instead of falling back', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev', '--port=abc']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Invalid --port');
    expect(fx.calls()).toHaveLength(0);
  });
});

describe.skipIf(isWin)('init — existing AAR install (the upgrade path)', () => {
  it('still applies the resValues when already on the current version', () => {
    // init short-circuits with "Already on <version>" for a matching AAR install.
    // The dev host/port resValues must still be applied, or a project scaffolded
    // before they existed can never acquire them — and `dev` tells users to run
    // init for exactly that.
    const fx = makeFixture({ aarVersion: BUILT_CLI_VERSION });
    const r = runCli(fx, ['init']);
    expect(r.out).toContain('Already on');

    const gradle = readFileSync(join(fx.root, 'app', 'build.gradle'), 'utf-8');
    expect(gradle).toContain('atak_reactive_dev_port');
    expect(gradle).toContain('atak_reactive_dev_host');
    expect(gradle).toContain("rootProject.file('local.properties')");
  });

  it('still refreshes a stale vite.config.ts on that path', () => {
    const fx = makeFixture({ aarVersion: BUILT_CLI_VERSION });
    const cfg = join(fx.root, 'web', 'vite.config.ts');
    writeFileSync(cfg, "export default { server: { port: 5173 } };\n");
    runCli(fx, ['init']);
    expect(readFileSync(cfg, 'utf-8')).toContain('strictPort');
    expect(existsSync(`${cfg}.bak`)).toBe(true);
  });
});


describe.skipIf(isWin)('init --dry-run — reports without writing', () => {
  // Moving the always-on patches ahead of the early returns put them ahead of the
  // dry-run guard too, so --dry-run wrote the resValues for real.
  it('does not touch build.gradle on a fresh project', () => {
    const fx = makeFixture({ withWeb: false });
    const gradlePath = join(fx.root, 'app', 'build.gradle');
    const before = readFileSync(gradlePath, 'utf-8');

    const r = runCli(fx, ['init', '--dry-run']);

    expect(readFileSync(gradlePath, 'utf-8')).toBe(before);
    expect(r.out).toContain('+ Add dev server host resValue');
    expect(r.out).toContain('+ Add dev server port resValue');
    // it used to write, then read its own writes back and call them pre-existing
    expect(r.out).not.toContain('Added dev server host resValue');
    expect(r.out).not.toContain('already present');
  });

  it('does not touch build.gradle on the existing-AAR path', () => {
    // This path early-returns on "Already on <version>", which is where the
    // unguarded write was reached first.
    const fx = makeFixture({ aarVersion: BUILT_CLI_VERSION });
    const gradlePath = join(fx.root, 'app', 'build.gradle');
    const before = readFileSync(gradlePath, 'utf-8');

    const r = runCli(fx, ['init', '--dry-run']);

    expect(readFileSync(gradlePath, 'utf-8')).toBe(before);
    expect(r.out).toContain('+ Add dev server port resValue');
  });

  it('does not refresh a stale vite.config.ts or leave a .bak', () => {
    const fx = makeFixture({ aarVersion: BUILT_CLI_VERSION });
    const cfg = join(fx.root, 'web', 'vite.config.ts');
    writeFileSync(cfg, "export default { server: { port: 5173 } };\n");

    const r = runCli(fx, ['init', '--dry-run']);

    expect(readFileSync(cfg, 'utf-8')).not.toContain('strictPort');
    expect(existsSync(`${cfg}.bak`)).toBe(false);
    expect(r.out).toContain('Update web/vite.config.ts');
  });

  it('reports the always-on patches on the source-migration path', () => {
    // This path early-returned without printing pendingPatches, so the dry run
    // listed only the three migration steps and hid the resValue insertions and
    // vite.config refresh that a real run performs.
    const fx = makeFixture();
    mkdirSync(join(fx.root, 'app', 'src', 'main', 'java', 'com', 'atakmap', 'android', 'reactive'), {
      recursive: true,
    });
    const cfg = join(fx.root, 'web', 'vite.config.ts');
    writeFileSync(cfg, "export default { server: { port: 5173 } };\n");
    const gradlePath = join(fx.root, 'app', 'build.gradle');
    const before = readFileSync(gradlePath, 'utf-8');

    const r = runCli(fx, ['init', '--dry-run']);

    expect(r.out).toContain('Would migrate:');
    expect(r.out).toContain('Add dev server host resValue');
    expect(r.out).toContain('Add dev server port resValue');
    expect(r.out).toContain('Update web/vite.config.ts');
    // still a dry run
    expect(readFileSync(gradlePath, 'utf-8')).toBe(before);
    expect(readFileSync(cfg, 'utf-8')).not.toContain('strictPort');
    expect(existsSync(`${cfg}.bak`)).toBe(false);
  });

  it('marks the always-on patches as additions on the AAR-update path', () => {
    const fx = makeFixture({ aarVersion: '0.0.1' });
    const r = runCli(fx, ['init', '--dry-run']);
    expect(r.out).toContain('Would update:');
    expect(r.out).toContain('+ Add dev server port resValue');
  });

  it('is a no-op the second time too — the first run must not have changed the report', () => {
    const fx = makeFixture({ withWeb: false });
    const first = runCli(fx, ['init', '--dry-run']);
    const second = runCli(fx, ['init', '--dry-run']);
    expect(second.out).toBe(first.out);
  });
});


describe.skipIf(isWin)('dev install — build and install, no server', () => {
  it('builds and installs but never opens a tunnel or starts Vite', () => {
    const fx = makeFixture();
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    runCli(fx, ['dev', 'install']);

    expect(gradleCalls(fx).join()).toContain('assembleCivDebug');
    expect(fx.calls().some((c) => c.startsWith('adb install'))).toBe(true);
    expect(fx.calls().some((c) => c.startsWith('adb reverse tcp:'))).toBe(false);
    expect(fx.calls().some((c) => c.includes('vite'))).toBe(false);
  });

  it('does not fail when the port is busy — it needs no port', async () => {
    const fx = makeFixture();
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    const r = await withPortHeld(fx.port, () => runCli(fx, ['dev', 'install']));
    expect(r.status).toBe(0);
    expect(fx.calls().some((c) => c.startsWith('adb install'))).toBe(true);
  });

  it('still passes the resolved port to Gradle so the APK bakes it', () => {
    const fx = makeFixture();
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    runCli(fx, ['dev', 'install']);
    expect(gradleCalls(fx).join()).toContain(`-PdevServerPort=${fx.port}`);
  });
});

describe.skipIf(isWin)('dev — subcommand routing', () => {
  it('rejects an unknown dev subcommand', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['dev', 'bogus']);
    expect(r.status).toBe(1);
    expect(r.out).toContain('unknown "dev bogus"');
    expect(fx.calls()).toHaveLength(0);
  });

  it('treats a flag after dev as the full cycle, not a subcommand', () => {
    const fx = makeFixture();
    fx.addApk('debug', 'app-civ-debug.apk', Date.now());
    const p = fx.port + 5;
    runCli(fx, ['dev', '--port', String(p)]);
    expect(gradleCalls(fx).join()).toContain(`-PdevServerPort=${p}`);
    expect(fx.calls()).toContain(`adb reverse tcp:${p} tcp:${p}`);
  });
});

describe.skipIf(isWin)('build — web asset verification', () => {
  /** Minimal zip (no compression) so the check can be exercised without Gradle. */
  function writeZip(path: string, names: string[]): void {
    const locals: Buffer[] = [];
    const central: Buffer[] = [];
    let offset = 0;
    for (const name of names) {
      const n = Buffer.from(name, 'utf8');
      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(0x04034b50, 0);
      lh.writeUInt16LE(n.length, 26);
      locals.push(lh, n);
      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(0x02014b50, 0);
      ch.writeUInt16LE(n.length, 28);
      ch.writeUInt32LE(offset, 42);
      central.push(ch, n);
      offset += 30 + n.length;
    }
    const cd = Buffer.concat(central);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(names.length, 8);
    eocd.writeUInt16LE(names.length, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(offset, 16);
    writeFileSync(path, Buffer.concat([...locals, cd, eocd]));
  }

  const releaseApk = (fx: Fixture) =>
    join(fx.root, 'app', 'build', 'outputs', 'apk', 'civ', 'release', 'app-release.apk');

  function prepareRelease(fx: Fixture, names: string[]): void {
    fx.addApk('release', 'app-release.apk', Date.now());
    writeZip(releaseApk(fx), names);
  }

  it('fails when the web assets did not make it into the APK', () => {
    const fx = makeFixture();
    prepareRelease(fx, ['AndroidManifest.xml', 'classes.dex']);
    const r = runCli(fx, ['build']);

    expect(r.status).toBe(1);
    expect(r.out).toContain('Web assets are missing');
    // the failure this guards: dev works off Vite, release ships a blank panel
    expect(r.out).toContain('blank panel');
  });

  it('passes and reports the count when they are bundled', () => {
    const fx = makeFixture();
    prepareRelease(fx, [
      'AndroidManifest.xml',
      'assets/web/index.html',
      'assets/web/assets/index-abc.js',
    ]);
    const r = runCli(fx, ['build']);

    expect(r.status).toBe(0);
    expect(r.out).toContain('Web assets bundled (2 files)');
    expect(r.out).toContain('Release APK:');
  });

  it('warns rather than failing when the APK cannot be read as a zip', () => {
    const fx = makeFixture();
    fx.addApk('release', 'app-release.apk', Date.now());
    writeFileSync(releaseApk(fx), 'not a zip');
    const r = runCli(fx, ['build']);

    expect(r.status).toBe(0);
    expect(r.out).toContain('could not read the APK');
  });
});
