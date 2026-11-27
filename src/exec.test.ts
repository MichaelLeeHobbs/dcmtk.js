import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
            expect(result.error.message).toMatch(/error/i);
        }
    });

    it('times out long-running processes', async () => {
        const result = await execCommand(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], { timeoutMs: 200 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/timed out/);
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
            expect(result.error.message).toMatch(/error/i);
        }
    });

    it('times out long-running processes', async () => {
        // Use node to sleep — works cross-platform
        const result = await spawnCommand(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], { timeoutMs: 200 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/timed out/);
        }
    });

    it('passes custom env to child process', async () => {
        const result = await spawnCommand(process.execPath, ['-e', 'process.stdout.write(process.env.TEST_CUSTOM_VAR || "missing")'], {
            env: { TEST_CUSTOM_VAR: 'hello_from_env' },
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stdout).toBe('hello_from_env');
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

    it('does not spawn when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();

        const result = await spawnCommand(process.execPath, ['-e', 'setTimeout(()=>{},30000)'], { signal: controller.signal });

        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/aborted before it started/);
    });

    // Windows only: tree-kill finds descendants with `ps --ppid`, which BusyBox (the Alpine CI image) rejects, and the
    // grandchild layout is a Windows launcher problem; on Linux DCMTK runs as a direct child.
    it.skipIf(!isWindows)('kills the grandchild on abort, as with a Chocolatey shim running the real binary (#56)', async () => {
        const pidFile = join(mkdtempSync(join(tmpdir(), 'exec-tree-')), 'grandchild.pid');
        const controller = new AbortController();
        const running = spawnCommand(process.execPath, ['-e', LAUNCHER_SCRIPT, pidFile], { timeoutMs: 30_000, signal: controller.signal });
        const grandchild = await waitForPidFile(pidFile);
        try {
            controller.abort();
            const result = await running;

            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toMatch(/aborted/);
            expect(await waitUntilGone(grandchild)).toBe(true);
        } finally {
            killQuietly(grandchild);
        }
    });
});

// `detached` keeps the grandchild out of the launcher's libuv job object, so it survives the launcher dying
// exactly like the real exe behind a Chocolatey shim. Only a process-tree kill reaches it.
const LAUNCHER_SCRIPT = [
    "const { spawn } = require('node:child_process');",
    "const c = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });",
    "require('node:fs').writeFileSync(process.argv[1], String(c.pid));",
    'setInterval(() => {}, 1000);',
].join('\n');

function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function killQuietly(pid: number): void {
    try {
        process.kill(pid);
    } catch {
        // Already gone
    }
}

async function waitForPidFile(path: string): Promise<number> {
    for (let i = 0; i < 100; i++) {
        if (existsSync(path)) {
            const pid = Number(readFileSync(path, 'utf8'));
            if (pid > 0) return pid;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`launcher never wrote ${path}`);
}

async function waitUntilGone(pid: number): Promise<boolean> {
    for (let i = 0; i < 60; i++) {
        if (!isAlive(pid)) return true;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
}
