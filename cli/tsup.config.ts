import { defineConfig } from 'tsup';
import { cpSync } from 'fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node18',
  sourcemap: true,
  clean: true,
  onSuccess: async () => {
    // Copy templates into dist so they're available at runtime
    cpSync('src/templates', 'dist/templates', { recursive: true });
    console.log('Copied templates to dist/');
  },
});
