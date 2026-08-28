import { execSync, type ChildProcess } from 'child_process';
import { createServer, type Server } from 'net';
import { log, logError, exec, parseReversedPorts, parseAdbDeviceList } from '../utils.js';

/**
 * Bind the port and keep it bound. Checking alone is not enough: work can happen
 * between "port was free" and the dev server actually binding it, and anything can
 * take it in that window. Callers release it immediately before spawning Vite.
 */
export function holdPort(port: number): Promise<Server | null> {
  // Bind :: (dual-stack) rather than 0.0.0.0. Vite is started with --host, which
  // binds ::, so a 0.0.0.0-only reservation can succeed while Vite later fails
  // EADDRINUSE against an IPv6 listener — after the build and install have run.
  // Fall back to 0.0.0.0 on hosts without IPv6.
  const bind = (host?: string) =>
    new Promise<Server | null>((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(null));
      server.once('listening', () => resolve(server));
      if (host) server.listen(port, host);
      else server.listen(port);
    });
  return bind().then((s) => s ?? bind('0.0.0.0'));
}

export function releasePort(held: Server | null): Promise<void> {
  return new Promise((resolve) => {
    if (!held) return resolve();
    held.close(() => resolve());
  });
}

/** Resolve the single device to act on. Exits on failure. */
export function preflightDevice(): string {
  if (!exec('adb version').ok) {
    logError('adb not found on PATH. Install Android platform-tools and try again.');
    process.exit(1);
  }

  const devices = exec('adb devices');
  const attached = devices.ok ? parseAdbDeviceList(devices.output) : [];
  const serials = attached.filter((d) => d.state === 'device').map((d) => d.serial);

  if (attached.length === 0) {
    logError('No device or emulator connected. Connect one and try again.');
    process.exit(1);
  }

  // Name the state: an unauthorized device otherwise reads as a missing one.
  if (serials.length === 0) {
    const listed = attached.map((d) => `${d.serial} (${d.state})`).join(', ');
    logError(
      `No usable device — adb reports: ${listed}.\n` +
      `  "unauthorized" means the RSA prompt on the device has not been accepted.\n` +
      `  "offline" usually clears with: adb disconnect && adb kill-server.`,
    );
    process.exit(1);
  }

  // adb honours ANDROID_SERIAL for install/reverse, so respect it here too rather
  // than refusing outright and telling the user to set a variable we then ignore.
  const wanted = process.env.ANDROID_SERIAL;
  let serial = serials[0];

  // Counted over every transport, matching adb. See parseAdbDeviceList.
  if (attached.length > 1) {
    if (wanted && serials.includes(wanted)) {
      serial = wanted;
    } else {
      const listed = attached.map((d) => `${d.serial} (${d.state})`).join(', ');
      logError(
        `More than one device connected (${listed}).\n` +
        `  adb refuses to choose, even when only one is usable.\n` +
        `  Set ANDROID_SERIAL to one of them, or disconnect the others.`,
      );
      process.exit(1);
    }
  } else if (wanted && !serials.includes(wanted)) {
    logError(`ANDROID_SERIAL is "${wanted}" but that device is not connected.`);
    process.exit(1);
  }

  return serial;
}

/**
 * Reserve the dev server port and confirm the device port is not already
 * forwarded. Exits on failure. The returned server must be released just before
 * the dev server binds.
 */
export async function preflightPort(port: number): Promise<Server> {
  const reverseList = exec('adb reverse --list');
  if (reverseList.ok && parseReversedPorts(reverseList.output).includes(port)) {
    logError(
      `Device port ${port} is already forwarded.\n` +
      `  Another plugin is in dev on it, or a previous session left it behind\n` +
      `  (cleanup does not run on SIGKILL or a closed terminal).\n\n` +
      `  Reclaim it:   adb reverse --remove tcp:${port}\n` +
      `  Or use another port: devServerPort in local.properties, or --port <n>.`,
    );
    process.exit(1);
  }

  const held = await holdPort(port);
  if (!held) {
    logError(
      `Port ${port} is already in use.\n` +
      `  Another dev server may have been left behind — a CLI killed with SIGKILL\n` +
      `  or a closed terminal orphans its Vite process.\n\n` +
      `  Find it:  lsof -i :${port}      (or: ss -ltnp | grep :${port})\n` +
      `  Or use another port: devServerPort in local.properties, or --port <n>.`,
    );
    process.exit(1);
  }
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
