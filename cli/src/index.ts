#!/usr/bin/env node

import { init } from './commands/init.js';
import { dev } from './commands/dev.js';
import { build } from './commands/build.js';

const command = process.argv[2];

switch (command) {
  case 'init':
    init();
    break;
  case 'dev':
    dev();
    break;
  case 'build':
    build();
    break;
  default:
    console.log(`
  atak-reactive — React UI for ATAK plugins

  Commands:
    init    Set up atak-reactive in an existing ATAK plugin
    dev     Start Vite dev server with adb reverse
    build   Build web assets for release

  Usage:
    npx @atak-reactive/cli init
    npx @atak-reactive/cli dev
    npx @atak-reactive/cli build
`);
    process.exit(command ? 1 : 0);
}
