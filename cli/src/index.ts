#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { init } from './commands/init.js';
import { dev } from './commands/dev.js';
import { build } from './commands/build.js';
import { findProjectRoot } from './utils.js';

const args = process.argv.slice(2);
const command = args[0];

function detectDefaultFlavor(): string {
  const root = findProjectRoot();
  if (!root) return 'civ';

  const buildGradle = join(root, 'app', 'build.gradle');
  if (!existsSync(buildGradle)) return 'civ';

  try {
    const content = readFileSync(buildGradle, 'utf-8');
    // Match: [ name : 'civ', default: true ]
    const match = content.match(/name\s*:\s*'(\w+)',\s*default:\s*true/);
    if (match) return match[1];
  } catch {
    // Fall through
  }
  return 'civ';
}

function getFlavor(): string {
  const idx = args.indexOf('--flavor');
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1];
  }
  return detectDefaultFlavor();
}

switch (command) {
  case 'init':
    init();
    break;
  case 'dev':
    dev(getFlavor());
    break;
  case 'build':
    build(getFlavor());
    break;
  default:
    console.log(`
  atak-reactive — React UI for ATAK plugins

  Commands:
    init                  Set up atak-reactive in an existing ATAK plugin
    dev [--flavor name]   Build debug APK, install, start dev server
    build [--flavor name] Build web assets + release APK

  Flavor is auto-detected from build.gradle (default: civ).
  Use --flavor to override.

  Usage:
    npx @atak-reactive/cli init
    npx @atak-reactive/cli dev
    npx @atak-reactive/cli dev --flavor mil
    npx @atak-reactive/cli build
    npx @atak-reactive/cli build --flavor gov
`);
    process.exit(command ? 1 : 0);
}
