#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { init } from './commands/init.js';
import { dev } from './commands/dev.js';
import { build } from './commands/build.js';
import { serve } from './commands/serve.js';
import {
  findProjectRoot,
  parseDefaultFlavor,
  parsePortArg,
  CLI_VERSION,
  fetchLatestVersion,
  isNewerVersion,
} from './utils.js';

const args = process.argv.slice(2);
const command = args[0];

function detectDefaultFlavor(): string {
  const root = findProjectRoot();
  if (!root) return 'civ';

  const buildGradle = join(root, 'app', 'build.gradle');
  if (!existsSync(buildGradle)) return 'civ';

  try {
    return parseDefaultFlavor(readFileSync(buildGradle, 'utf-8'));
  } catch {
    return 'civ';
  }
}

function getFlavor(): string {
  const idx = args.indexOf('--flavor');
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1];
  }
  return detectDefaultFlavor();
}

/**
 * Warn when the running CLI is behind npm. `npx` will happily reuse a stale cached
 * copy, so without this the CLI silently scaffolds an old payload and even reports
 * its own version as "latest".
 */
async function warnIfOutdated(): Promise<void> {
  const latest = await fetchLatestVersion();
  if (latest && isNewerVersion(latest, CLI_VERSION)) {
    console.log(`  ⚠ Newer version available: ${latest} (running ${CLI_VERSION})`);
    console.log(`    npx @atak-reactive/cli@latest ${command ?? 'init'}\n`);
  }
}

async function main(): Promise<void> {
  if (command === '--version' || command === '-v') {
    console.log(CLI_VERSION);
    return;
  }

  if (command === 'init' || command === 'dev' || command === 'build' || command === 'serve') {
    // Always state which version is running — makes a stale npx cache obvious.
    console.log(`\n  atak-reactive v${CLI_VERSION}`);
    await warnIfOutdated();
  }

  switch (command) {
    case 'init':
      init({ embedded: args.includes('--embedded'), dryRun: args.includes('--dry-run') });
      break;
    case 'dev': {
      let port: number | undefined;
      try {
        port = parsePortArg(args);
      } catch (e) {
        console.error(`\n  Error: ${(e as Error).message}\n`);
        process.exit(1);
      }
      await dev(getFlavor(), { port });
      break;
    }
    case 'serve': {
      let port: number | undefined;
      try {
        port = parsePortArg(args);
      } catch (e) {
        console.error(`\n  Error: ${(e as Error).message}\n`);
        process.exit(1);
      }
      await serve({ port });
      break;
    }
    case 'build':
      build(getFlavor());
      break;
    default:
      console.log(`
  atak-reactive v${CLI_VERSION} — React UI for ATAK plugins

  Commands:
    init  [--embedded] [--dry-run]   Set up or update atak-reactive in an ATAK plugin
    dev   [--flavor name] [--port n] Build debug APK, install, tunnel, start dev server
    serve [--port n]                 Start dev server + adb tunnel (no build/install)
    build [--flavor name]            Build web assets + signed release APK
    --version, -v                    Print the CLI version

  Flavor is auto-detected from build.gradle (default: civ).
  Use --flavor to override.

  dev  = build + install + tunnel + server. Use after changing Java or the port.
  serve = tunnel + server only. Use to restart the server without reinstalling.

  The dev server port defaults to 5173. Set devServerPort in local.properties to
  give each plugin its own port (so two can run at once), or pass --port for a
  single run. The port is compiled into the debug APK, so changing it needs "dev".

  Tip: pin to the newest release with @latest —
    npx @atak-reactive/cli@latest init
  (npx may otherwise reuse an older cached copy.)
  Set ATAK_REACTIVE_NO_UPDATE_CHECK=1 to skip the update check.

  Usage:
    npx @atak-reactive/cli init
    npx @atak-reactive/cli dev
    npx @atak-reactive/cli dev --flavor mil
    npx @atak-reactive/cli dev --port 5174
    npx @atak-reactive/cli serve
    npx @atak-reactive/cli serve --port 5174
    npx @atak-reactive/cli build
    npx @atak-reactive/cli build --flavor gov
`);
      process.exit(command ? 1 : 0);
  }
}

main();
