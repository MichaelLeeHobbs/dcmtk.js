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
