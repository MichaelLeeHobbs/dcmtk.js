import { describe, it, expect } from 'vitest';
import { execCommand, spawnCommand } from './exec';

// These tests use real child processes with safe, cross-platform commands.
// No mocking needed — we test the actual execution path.

const isWindows = process.platform === 'win32';

// Cross-platform echo command
const echoCmd = isWindows ? 'cmd' : 'echo';
const echoArgs = isWindows ? ['/c', 'echo', 'hello'] : ['hello'];

// Cross-platform command that writes to stderr
const stderrCmd = isWindows ? 'cmd' : 'sh';
const stderrArgs = isWindows ? ['/c', 'echo', 'oops>&2'] : ['-c', 'echo oops >&2'];

// Cross-platform command that exits with code 1
const failCmd = isWindows ? 'cmd' : 'sh';
const failArgs = isWindows ? ['/c', 'exit', '1'] : ['-c', 'exit 1'];

describe('execCommand()', () => {
    it('captures stdout from a successful command', async () => {
        const result = await execCommand(echoCmd, echoArgs);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stdout.trim()).toBe('hello');
            expect(result.value.exitCode).toBe(0);
        }
    });

    it('captures stderr', async () => {
        const result = await execCommand(stderrCmd, stderrArgs);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stderr.trim()).toBe('oops');
        }
    });

    it('reports non-zero exit codes', async () => {
        const result = await execCommand(failCmd, failArgs);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.exitCode).toBe(1);
        }
    });

    it('returns error for nonexistent binary', async () => {
        const result = await execCommand('nonexistent_binary_xyz_12345', []);

        // spawn returns a Process error for ENOENT
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('Process error');
        }
    });

    it('times out long-running processes', async () => {
        const result = await execCommand(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], { timeoutMs: 200 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timed out');
        }
    });
});

describe('spawnCommand()', () => {
    it('captures stdout from a successful command', async () => {
        const result = await spawnCommand(echoCmd, echoArgs);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stdout.trim()).toBe('hello');
            expect(result.value.exitCode).toBe(0);
        }
    });

    it('captures stderr', async () => {
        const result = await spawnCommand(stderrCmd, stderrArgs);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stderr.trim()).toBe('oops');
        }
    });

    it('reports non-zero exit codes', async () => {
        const result = await spawnCommand(failCmd, failArgs);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.exitCode).toBe(1);
        }
    });

    it('returns error for nonexistent binary', async () => {
        const result = await spawnCommand('nonexistent_binary_xyz_12345', []);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('Process error');
        }
    });

    it('times out long-running processes', async () => {
        // Use node to sleep — works cross-platform
        const result = await spawnCommand(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], { timeoutMs: 200 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timed out');
        }
    });

    it('supports AbortSignal cancellation', async () => {
        const controller = new AbortController();

        // Abort after 100ms
        setTimeout(() => controller.abort(), 100);

        const result = await spawnCommand(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], {
            timeoutMs: 30_000,
            signal: controller.signal,
        });

        // Should fail due to abort
        expect(result.ok).toBe(false);
    });
});
