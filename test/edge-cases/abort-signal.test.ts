/**
 * Tests for AbortSignal handling in execCommand and spawnCommand.
 * Verifies pre-aborted signals, mid-execution abort, multiple aborts,
 * and abort-after-completion scenarios.
 *
 * Uses real subprocess execution with the Node.js binary for cross-platform
 * compatibility.
 *
 * @module abort-signal.test
 */

import { describe, it, expect } from 'vitest';
import { execCommand, spawnCommand } from '../../src/exec';

/** Node binary path — works cross-platform. */
const nodeBinary = process.execPath;

/** Args for a long-running process (30s sleep). */
const longSleepArgs = ['-e', 'setTimeout(() => {}, 30000)'];

/** Args for a quick-completing process. */
const quickArgs = ['-e', 'process.stdout.write("done")'];

describe('execCommand AbortSignal handling', () => {
    it('returns error immediately for a pre-aborted signal', async () => {
        const controller = new AbortController();
        controller.abort();

        const result = await execCommand(nodeBinary, longSleepArgs, {
            timeoutMs: 30_000,
            signal: controller.signal,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/abort/i);
        }
    });

    it('aborts a long-running process mid-execution', async () => {
        const controller = new AbortController();

        // Abort after 100ms
        setTimeout(() => controller.abort(), 100);

        const start = Date.now();
        const result = await execCommand(nodeBinary, longSleepArgs, {
            timeoutMs: 30_000,
            signal: controller.signal,
        });
        const elapsed = Date.now() - start;

        expect(result.ok).toBe(false);
        // Should complete well before the 30s sleep
        expect(elapsed).toBeLessThan(5000);
    });

    it('returns normal result when process finishes before abort', async () => {
        const controller = new AbortController();

        const result = await execCommand(nodeBinary, quickArgs, {
            timeoutMs: 30_000,
            signal: controller.signal,
        });

        // Process should finish normally
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stdout).toBe('done');
            expect(result.value.exitCode).toBe(0);
        }

        // Aborting after completion should not throw
        controller.abort();
    });

    it('does not crash when abort is called multiple times', async () => {
        const controller = new AbortController();

        setTimeout(() => {
            controller.abort();
            // Second abort call should be harmless
            controller.abort();
        }, 50);

        const result = await execCommand(nodeBinary, longSleepArgs, {
            timeoutMs: 30_000,
            signal: controller.signal,
        });

        // Should still get an error result, not a crash
        expect(result.ok).toBe(false);
    });
});

describe('spawnCommand AbortSignal handling', () => {
    it('returns error immediately for a pre-aborted signal', async () => {
        const controller = new AbortController();
        controller.abort();

        const result = await spawnCommand(nodeBinary, longSleepArgs, {
            timeoutMs: 30_000,
            signal: controller.signal,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/abort/i);
        }
    });

    it('aborts a long-running process mid-execution', async () => {
        const controller = new AbortController();

        setTimeout(() => controller.abort(), 100);

        const start = Date.now();
        const result = await spawnCommand(nodeBinary, longSleepArgs, {
            timeoutMs: 30_000,
            signal: controller.signal,
        });
        const elapsed = Date.now() - start;

        expect(result.ok).toBe(false);
        expect(elapsed).toBeLessThan(5000);
    });

    it('returns normal result when process finishes before abort', async () => {
        const controller = new AbortController();

        const result = await spawnCommand(nodeBinary, quickArgs, {
            timeoutMs: 30_000,
            signal: controller.signal,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stdout).toBe('done');
            expect(result.value.exitCode).toBe(0);
        }

        // Post-completion abort should be harmless
        controller.abort();
    });

    it('does not crash when abort is called multiple times', async () => {
        const controller = new AbortController();

        setTimeout(() => {
            controller.abort();
            controller.abort();
        }, 50);

        const result = await spawnCommand(nodeBinary, longSleepArgs, {
            timeoutMs: 30_000,
            signal: controller.signal,
        });

        expect(result.ok).toBe(false);
    });
});
