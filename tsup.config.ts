import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        tools: 'src/tools/index.ts',
        servers: 'src/servers/index.ts',
        dicom: 'src/dicom/index.ts',
        utils: 'src/utils/index.ts',
    },
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
