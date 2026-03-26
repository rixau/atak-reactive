import { defineConfig } from 'tsup';
import { cpSync, readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  sourcemap: true,
  clean: true,
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
  onSuccess: async () => {
    // Copy templates into dist so they're available at runtime
    cpSync('src/templates', 'dist/templates', { recursive: true });
    console.log('Copied templates to dist/');
  },
});
