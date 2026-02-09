import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    tsconfig: 'tsconfig.build.json',
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    minify: false,
    target: 'es2020',
    shims: true,
});
