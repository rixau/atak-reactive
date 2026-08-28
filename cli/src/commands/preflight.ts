import { execSync, type ChildProcess } from 'child_process';
import { createServer, type Server } from 'net';
import { log, logError, exec, parseReversedPorts, parseAdbDevices } from '../utils.js';

/**
 * Bind the port and keep it bound. Checking alone is not enough: work can happen
 * between "port was free" and the dev server actually binding it, and anything can
 * take it in that window. Callers release it immediately before spawning Vite.
 */
export function holdPort(port: number): Promise<Server | null> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(null));
    server.once('listening', () => resolve(server));
    server.listen(port, '0.0.0.0');
  });
}

export function releasePort(held: Server | null): Promise<void> {
  return new Promise((resolve) => {
    if (!held) return resolve();
    held.close(() => resolve());
  });
}

/**
 * Everything that can fail cheaply, before anything expensive runs. Exits the
 * process on failure. Returns the held port, which the caller must release just
 * before handing the port to Vite.
 */
export async function preflight(port: number): Promise<Server> {
  if (!exec('adb version').ok) {
    logError('adb not found on PATH. Install Android platform-tools and try again.');
    process.exit(1);
  }

  const devices = exec('adb devices');
  const serials = devices.ok ? parseAdbDevices(devices.output) : [];
  if (serials.length === 0) {
    logError('No device or emulator connected. Connect one and try again.');
    process.exit(1);
  }
  if (serials.length > 1) {
    logError(
      `More than one device connected (${serials.join(', ')}).\n` +
      '  adb cannot pick one — disconnect the others, or set ANDROID_SERIAL.',
    );
    process.exit(1);
  }

  const reverseList = exec('adb reverse --list');
  if (reverseList.ok && parseReversedPorts(reverseList.output).includes(port)) {
    logError(
      `Device port ${port} is already forwarded — another plugin is in dev on it.\n` +
      `  Set devServerPort in local.properties, or pass --port <n>.`,
    );
    process.exit(1);
  }

  const held = await holdPort(port);
  if (!held) {
    logError(
      `Port ${port} is already in use.\n` +
      `  Set devServerPort in local.properties, or pass --port <n>.`,
    );
    process.exit(1);
  }

  log(`Preflight OK — device ${serials[0]}, port ${port} reserved`);
  return held;
}

/** Open the reverse tunnel. Exits on failure. */
export function openTunnel(port: number, onFail: () => Promise<void>): Promise<void> | void {
  try {
    execSync(`adb reverse tcp:${port} tcp:${port}`, { stdio: 'pipe' });
    log(`adb reverse tcp:${port} — port forwarding active`);
  } catch {
    return onFail().then(() => {
      logError(`adb reverse tcp:${port} failed.`);
      process.exit(1);
    });
  }
}

/** Remove the reverse tunnel. Never throws. */
export function closeTunnel(port: number): void {
  try {
    execSync(`adb reverse --remove tcp:${port}`, { stdio: 'pipe' });
  } catch {
    // Tunnel already gone
  }
}

/**
 * Kill the dev server and everything it spawned.
 *
 * `spawn(..., { shell: true })` puts a shell between us and Vite, so child.kill()
 * signals the shell and orphans the real Vite process — it survives, keeps the port,
 * and gets reparented to init. Spawning detached gives the child its own process
 * group, and signalling the negative pid takes the whole group down.
 */
export function killProcessTree(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /t /f`, { stdio: 'pipe' });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      // Already dead
    }
  }
}

/** Spawn options that make killProcessTree work. */
export const devServerSpawnOpts = {
  stdio: 'inherit' as const,
  shell: true,
  detached: process.platform !== 'win32',
};
