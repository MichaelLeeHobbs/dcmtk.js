import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DcmtkProcess, ProcessState } from './DcmtkProcess';
import { killTree } from './killTree';
import { err, ok } from './types';

vi.mock('./killTree', () => ({ killTree: vi.fn() }));

const mockKillTree = vi.mocked(killTree);

function killQuietly(pid: number): void {
    try {
        process.kill(pid);
    } catch {
        // Already gone
    }
}

function collectErrors(proc: DcmtkProcess): { message: string; fatal: boolean }[] {
    const errors: { message: string; fatal: boolean }[] = [];
    proc.on('error', ({ error, fatal }) => errors.push({ message: error.message, fatal }));
    return errors;
}

describe('DcmtkProcess stop() when the process does not close', () => {
    beforeEach(() => {
        mockKillTree.mockReset();
    });

    it('reports a failed tree kill as a non-fatal error and still stops after the drain timeout', async () => {
        mockKillTree.mockResolvedValue(err(new Error('Access is denied')));
        const proc = new DcmtkProcess({
            binary: process.execPath,
            args: ['-e', 'console.log(process.pid); setInterval(() => {}, 1000)'],
            isStartedPredicate: line => /^\d+$/.test(line),
            drainTimeoutMs: 200,
        });
        let pid = 0;
        proc.on('line', ({ text }) => {
            if (/^\d+$/.test(text)) pid = Number(text);
        });
        const errors = collectErrors(proc);

        try {
            expect((await proc.start()).ok).toBe(true);
            await proc.stop();

            expect(proc.currentState).toBe(ProcessState.STOPPED);
            expect(errors).toContainEqual({ message: 'Failed to kill process tree: Access is denied', fatal: false });
        } finally {
            if (pid > 0) killQuietly(pid);
        }
    });

    it('reports a descendant still holding the output pipes after the root exited', async () => {
        // The kill reaches only the root, as when a launcher's real binary escapes the tree; the grandchild
        // inherits stdout, so 'close' never fires.
        mockKillTree.mockImplementation(pid => {
            killQuietly(pid);
            return Promise.resolve(ok(undefined));
        });
        const pidFile = join(mkdtempSync(join(tmpdir(), 'drain-')), 'grandchild.pid');
        const launcher = [
            "const { spawn } = require('node:child_process');",
            "const c = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'inherit' });",
            "require('node:fs').writeFileSync(process.argv[1], String(c.pid));",
            "console.log('up'); setInterval(() => {}, 1000);",
        ].join('\n');
        const proc = new DcmtkProcess({
            binary: process.execPath,
            args: ['-e', launcher, pidFile],
            isStartedPredicate: line => line === 'up',
            drainTimeoutMs: 500,
        });
        const errors = collectErrors(proc);

        try {
            expect((await proc.start()).ok).toBe(true);
            await proc.stop();

            expect(proc.currentState).toBe(ProcessState.STOPPED);
            expect(mockKillTree).toHaveBeenCalledTimes(1);
            expect(errors.some(e => !e.fatal && /output stayed open/.test(e.message))).toBe(true);
        } finally {
            if (existsSync(pidFile)) killQuietly(Number(readFileSync(pidFile, 'utf8')));
        }
    });
});
