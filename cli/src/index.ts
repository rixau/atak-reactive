#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { init } from './commands/init.js';
import { dev } from './commands/dev.js';
import { build } from './commands/build.js';
import {
  findProjectRoot,
  parseDefaultFlavor,
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

  if (command === 'init' || command === 'dev' || command === 'build') {
    // Always state which version is running — makes a stale npx cache obvious.
    console.log(`\n  atak-reactive v${CLI_VERSION}`);
    await warnIfOutdated();
  }

  switch (command) {
    case 'init':
      init({ embedded: args.includes('--embedded'), dryRun: args.includes('--dry-run') });
      break;
    case 'dev':
      dev(getFlavor());
      break;
    case 'build':
      build(getFlavor());
      break;
    default:
      console.log(`
  atak-reactive v${CLI_VERSION} — React UI for ATAK plugins

  Commands:
    init [--embedded] [--dry-run]  Set up or update atak-reactive in an ATAK plugin
    dev [--flavor name]   Build debug APK, install, start dev server
    build [--flavor name] Build web assets + release APK
    --version, -v         Print the CLI version

  Flavor is auto-detected from build.gradle (default: civ).
  Use --flavor to override.

  Tip: pin to the newest release with @latest —
    npx @atak-reactive/cli@latest init
  (npx may otherwise reuse an older cached copy.)
  Set ATAK_REACTIVE_NO_UPDATE_CHECK=1 to skip the update check.

  Usage:
    npx @atak-reactive/cli init
    npx @atak-reactive/cli dev
    npx @atak-reactive/cli dev --flavor mil
    npx @atak-reactive/cli build
    npx @atak-reactive/cli build --flavor gov
`);
      process.exit(command ? 1 : 0);
  }
}

main();
