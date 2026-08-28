import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createServer } from 'net';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Read devServerPort from the plugin's local.properties, one level above web/.
 * That file is the single source of truth — the Gradle build bakes the same value
 * into the debug APK, so the dev server has to agree with it.
 */
function portFromLocalProperties(): number | undefined {
  const path = resolve(process.cwd(), '..', 'local.properties');
  if (!existsSync(path)) return undefined;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0 && t.slice(0, eq).trim() === 'devServerPort') {
      const n = Number(t.slice(eq + 1).trim());
      if (Number.isInteger(n) && n >= 1024 && n <= 65535) return n;
    }
  }
  return undefined;
}

function assertPortFree(port: number): Promise<void> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => {
      console.error(`
  Port ${port} is in use. It's compiled into the APK, so Vite can't move off it.

  Give this plugin its own port:
    1. devServerPort=<n>  in local.properties
    2. npx @atak-reactive/cli dev --port <n>   (rebuilds)
`);
      process.exit(1);
    });
    probe.once('listening', () => probe.close(() => resolve()));
    probe.listen(port, '0.0.0.0');
  });
}

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port =
    Number(env.ATAK_DEV_PORT ?? process.env.ATAK_DEV_PORT ?? 0) ||
    portFromLocalProperties() ||
    5173;

  if (command === 'serve') await assertPortFree(port);

  return {
    plugins: [react()],
    base: './',
    build: { outDir: 'dist-assets/web', target: 'chrome80' },
    server: {
      host: true,
      port,
      strictPort: true,
      watch: { usePolling: true, interval: 500 },
    },
  };
});
