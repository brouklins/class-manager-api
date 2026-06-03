import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/handler.ts'
  },
  format: ['cjs'],
  platform: 'node',
  target: 'node22',
  bundle: true,
  sourcemap: true,
  clean: true,
  minify: false,
  noExternal: [/.*/],
  outExtension: () => ({
    js: '.js'
  })
});
