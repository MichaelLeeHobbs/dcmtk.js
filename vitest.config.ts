import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        testTimeout: 60_000,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.d.ts',
                'src/**/*.test.ts',
                'src/index.ts',
                'src/parsers/EventPattern.ts',
                'src/tools/_toolTypes.ts',
                'src/tools/index.ts',
                'src/servers/index.ts',
                'src/dicom/index.ts',
                'src/dicom/xmlToJson.ts',
                'src/utils/index.ts',
                'src/events/index.ts',
                // Tools covered by integration tests (mock tests removed)
                'src/tools/dcmftest.ts',
                'src/tools/dcm2xml.ts',
                'src/tools/dcm2json.ts',
                'src/tools/dcmdump.ts',
                'src/tools/dcmodify.ts',
                'src/tools/dcmconv.ts',
                'src/tools/dcmcjpeg.ts',
                'src/tools/dcmdjpeg.ts',
                'src/tools/dcmcrle.ts',
                'src/tools/dcmdrle.ts',
                'src/tools/echoscu.ts',
                'src/tools/storescu.ts',
                'src/tools/dcmsend.ts',
                'src/tools/findscu.ts',
                'src/tools/movescu.ts',
                'src/tools/getscu.ts',
                'src/tools/json2dcm.ts',
                'src/tools/dump2dcm.ts',
            ],
            thresholds: {
                branches: 95,
                functions: 95,
                lines: 95,
                statements: 95,
            },
        },
        include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        exclude: [
            // Integration tests are excluded from the default test run because they
            // require DCMTK binaries installed on the system. Run them separately
            // with: pnpm run test:integration
            'test/integration/**/*.test.ts',
        ],
    },
});
