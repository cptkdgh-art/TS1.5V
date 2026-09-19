import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  root,
  resolve: {
    alias: Object.fromEntries(
      ['core', 'modules', 'shared', 'services', 'stores', 'security']
        .map((name) => [`@${name}`, path.join(root, 'src', `@${name}`)]),
    ),
  },
  test: { environment: 'node', include: ['tests/review/*.test.ts'] },
});
