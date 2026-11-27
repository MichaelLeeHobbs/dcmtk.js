/**
 * Process-tree termination shared by short-lived tools and long-lived servers.
 *
 * @module killTree
 */

import { stderr } from 'stderr-lib';
import kill from 'tree-kill';
import type { Result } from './types';
import { ok, err } from './types';

const KILL_TREE_TIMEOUT_MS = 10_000;

/**
 * Kills a process and every descendant it started.
 *
 * Always kill DCMTK processes through this, never `child.kill()` or spawn's `signal`: those reach only the
 * direct child, and on Windows a launcher such as a Chocolatey shim runs the real binary as a grandchild (#56).
 *
 * On Windows this runs `taskkill /T /F`, which has terminated the tree when it returns; a root that already
 * exited counts as success, since `/T` can only walk the tree from a live root. On POSIX it sends SIGTERM and
 * does not wait for exit; it finds descendants with `ps --ppid`, which BusyBox (Alpine) rejects, so there only
 * the root is signalled.
 *
 * @param pid - Root process ID
 * @param timeoutMs - How long to wait for the kill command before giving up
 * @returns ok once the kill command finished, or an error saying why it failed or that it timed out
 */
function killTree(pid: number, timeoutMs: number = KILL_TREE_TIMEOUT_MS): Promise<Result<void>> {
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            resolve(err(new Error(`killing process tree ${String(pid)} did not finish within ${String(timeoutMs)}ms`)));
        }, timeoutMs);
        const done = (error?: Error | null): void => {
            clearTimeout(timer);
            resolve(error && !isAlreadyGone(error) ? err(error) : ok(undefined));
        };
        try {
            kill(pid, done);
            /* v8 ignore next 3 -- tree-kill throws synchronously only for a non-numeric pid */
        } catch (e: unknown) {
            done(stderr(e));
        }
    });
}

/** taskkill exits with 128 when the PID does not exist. */
function isAlreadyGone(error: Error): boolean {
    return process.platform === 'win32' && (error as Error & { code?: unknown }).code === 128;
}

export { killTree };
