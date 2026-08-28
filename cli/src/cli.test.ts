import { describe, it, expect } from 'vitest';
import { createServer } from 'net';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { makeFixture, runCli, type Fixture } from './__testkit.js';

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

describe.skipIf(isWin)('serve — no build, no install', () => {
  it('opens the tunnel and starts Vite without touching Gradle or the APK', () => {
    const fx = makeFixture();
    runCli(fx, ['serve']);

    expect(gradleCalls(fx)).toHaveLength(0);
    expect(fx.calls().some((c) => c.startsWith('adb install'))).toBe(false);
    expect(fx.calls()).toContain(`adb reverse tcp:${fx.port} tcp:${fx.port}`);
    expect(fx.calls().some((c) => c.includes('vite') && c.includes(`--port ${fx.port}`))).toBe(true);
  });

  it('runs the same preflight as dev', () => {
    const fx = makeFixture();
    const r = runCli(fx, ['serve'], { devices: 'List of devices attached' });
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
