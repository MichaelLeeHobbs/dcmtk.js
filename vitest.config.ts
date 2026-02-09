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
            exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/index.ts', 'src/parsers/EventPattern.ts'],
            thresholds: {
                branches: 95,
                functions: 95,
                lines: 95,
                statements: 95,
            },
        },
        include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    },
});
