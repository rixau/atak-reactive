/**
 * Test kit for CLI integration tests.
 *
 * Runs the real built CLI against a throwaway project, with `adb`, `gradlew` and
 * `npx` replaced by stubs on PATH that record every invocation. No device, no
 * emulator, no Android SDK — the commands' sequencing and arguments are the thing
 * under test, and those are exactly where the bugs have been.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, utimesSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CLI_ENTRY = join(HERE, '..', 'dist', 'index.cjs');

export interface Fixture {
  root: string;
  callLog: string;
  /** The dev server port this fixture is configured for. */
  port: number;
  /** Invocations recorded by the stubs, in order. */
  calls(): string[];
  /** Write an APK into the flavor/buildType output dir with an explicit mtime. */
  addApk(buildType: string, name: string, mtimeMs: number, flavor?: string): void;
}

export interface FixtureOpts {
  /** Output of `adb devices`. Default: one emulator. */
  devices?: string;
  /** Output of `adb reverse --list`. Default: empty. */
  reverseList?: string;
  /** Extra lines appended to app/build.gradle (e.g. a buildWebAssets task). */
  gradleExtra?: string;
  /**
   * Dev server port. Defaults to a random high port — tests must never depend on
   * whether 5173 happens to be free on the machine running them.
   */
  port?: number;
  /** Extra lines for local.properties, appended after devServerPort. */
  localProperties?: string;
  /** Omit web/node_modules to exercise the dependency guard. */
  withNodeModules?: boolean;
}

export function makeFixture(opts: FixtureOpts = {}): Fixture {
  const {
    devices = 'List of devices attached\nemulator-5554\tdevice',
    reverseList = '',
    gradleExtra = '',
    localProperties = 'sdk.dir=/x\n',
    withNodeModules = true,
  } = opts;
  const port = opts.port ?? 41000 + Math.floor(Math.random() * 8000);

  const root = mkdtempSync(join(tmpdir(), 'atak-cli-'));
  const stubbin = join(root, '.stubbin');
  const callLog = join(root, 'calls.log');
  mkdirSync(stubbin, { recursive: true });
  mkdirSync(join(root, 'app'), { recursive: true });
  mkdirSync(join(root, 'web'), { recursive: true });
  if (withNodeModules) mkdirSync(join(root, 'web', 'node_modules'), { recursive: true });
  writeFileSync(callLog, '');

  writeFileSync(join(root, 'settings.gradle'), "include ':app'\n");
  writeFileSync(join(root, 'local.properties'), `${localProperties}devServerPort=${port}\n`);
  writeFileSync(
    join(root, 'app', 'build.gradle'),
    'android {\n    buildTypes {\n        debug {\n        }\n    }\n}\n' + gradleExtra,
  );
  writeFileSync(
    join(root, 'web', 'package.json'),
    JSON.stringify({ name: 'w', scripts: { build: 'echo webbuild', dev: 'vite' } }),
  );

  const stub = (name: string, body: string) => {
    const p = join(stubbin, name);
    writeFileSync(p, `#!/bin/sh\necho "${name} $*" >> "$CALLLOG"\n${body}\n`, { mode: 0o755 });
  };
  stub('adb', `
case "$1" in
  version) echo "Android Debug Bridge version 1.0.41" ;;
  devices) printf '%s\\n' "$ADB_DEVICES" ;;
  reverse) [ "$2" = "--list" ] && printf '%s\\n' "$ADB_REVERSE_LIST" ;;
esac
exit 0`);
  // npx exits immediately so the CLI's vite.on('exit') path runs and the test ends.
  stub('npx', 'exit 0');
  stub('npm', 'exit 0');

  writeFileSync(join(root, 'gradlew'), '#!/bin/sh\necho "gradlew $*" >> "$CALLLOG"\nexit 0\n', { mode: 0o755 });

  return {
    root,
    callLog,
    port,
    calls: () =>
      readFileSync(callLog, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean),
    addApk(buildType, name, mtimeMs, flavor = 'civ') {
      const dir = join(root, 'app', 'build', 'outputs', 'apk', flavor, buildType);
      mkdirSync(dir, { recursive: true });
      const p = join(dir, name);
      writeFileSync(p, 'apk');
      utimesSync(p, mtimeMs / 1000, mtimeMs / 1000);
    },
  };
}

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
  out: string;
}

export function runCli(fx: Fixture, args: string[], opts: FixtureOpts = {}): RunResult {
  if (!existsSync(CLI_ENTRY)) {
    throw new Error(`CLI not built at ${CLI_ENTRY} — run "npm run build" first.`);
  }
  const r = spawnSync(process.execPath, [CLI_ENTRY, ...args], {
    cwd: fx.root,
    encoding: 'utf-8',
    timeout: 30_000,
    env: {
      ...process.env,
      PATH: `${join(fx.root, '.stubbin')}:${process.env.PATH}`,
      CALLLOG: fx.callLog,
      ADB_DEVICES: opts.devices ?? 'List of devices attached\nemulator-5554\tdevice',
      ADB_REVERSE_LIST: opts.reverseList ?? '',
      ATAK_REACTIVE_NO_UPDATE_CHECK: '1',
    },
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    out: (r.stdout ?? '') + (r.stderr ?? ''),
  };
}
