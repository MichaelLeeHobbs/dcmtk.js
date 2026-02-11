/**
 * Short-lived DCMTK process execution.
 *
 * Two execution modes:
 * - `execCommand()` — convenience wrapper; uses `spawn()` internally for safety
 * - `spawnCommand()` — uses `child_process.spawn()`, safer for user-supplied values (Rule 7.4)
 *
 * Both enforce mandatory timeouts (Rule 4.2) and return `Result<DcmtkProcessResult>`.
 *
 * @module exec
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import kill from 'tree-kill';
import type { Result, DcmtkProcessResult, ExecOptions, SpawnOptions } from './types';
import { ok, err } from './types';
import { DEFAULT_TIMEOUT_MS, MAX_BUFFER_BYTES } from './constants';

/**
 * Kills a process tree by PID. Wraps tree-kill in a promise.
 *
 * @param pid - The process ID to kill
 */
function killTree(pid: number): void {
    try {
        kill(pid);
        /* v8 ignore next */
    } catch {
        // Process may already be dead — not exceptional
    }
}

/**
 * Executes a DCMTK binary as a short-lived process.
 *
 * **Security:** This function uses `child_process.spawn()` internally, passing
 * arguments as an array to avoid shell interpretation. This eliminates shell
 * injection risks regardless of argument content (Rule 7.4).
 *
 * @param binary - Full path to the DCMTK binary
 * @param args - Command-line arguments (passed directly, no shell interpolation)
 * @param options - Execution options (timeout, cwd, signal)
 * @returns A Result containing the process output or an error
 * @throws Never throws for expected failures (Rule 6.1)
 *
 * @example
 * ```ts
 * const result = await execCommand('/usr/local/bin/dcm2json', ['+ll', 'input.dcm']);
 * if (result.ok) {
 *     console.log(result.value.stdout);
 * }
 * ```
 */
async function execCommand(binary: string, args: readonly string[], options?: ExecOptions): Promise<Result<DcmtkProcessResult>> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise(resolve => {
        const child = spawn(binary, [...args], {
            cwd: options?.cwd,
            windowsHide: true,
            signal: options?.signal,
        });
        wireSpawnListeners(child, timeoutMs, resolve);
    });
}

/**
 * Wires event listeners on a spawned child process with timeout, bounded buffering, and settle logic.
 */
function wireSpawnListeners(child: ChildProcess, timeoutMs: number, resolve: (result: Result<DcmtkProcessResult>) => void): void {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const settle = (result: Result<DcmtkProcessResult>): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
    };

    const timer = setTimeout(() => {
        if (child.pid !== undefined && child.pid !== null) killTree(child.pid);
        settle(err(new Error(`Process timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer | string) => {
        const str = String(chunk);
        stdoutBytes += Buffer.byteLength(str);
        if (stdoutBytes <= MAX_BUFFER_BYTES) stdout += str;
    });

    child.stderr?.on('data', (chunk: Buffer | string) => {
        const str = String(chunk);
        stderrBytes += Buffer.byteLength(str);
        if (stderrBytes <= MAX_BUFFER_BYTES) stderr += str;
    });

    child.on('error', (error: Error) => {
        if (child.pid !== undefined && child.pid !== null) killTree(child.pid);
        settle(err(new Error(`Process error: ${error.message}`)));
    });

    child.on('close', (code: number | null) => {
        settle(ok({ stdout, stderr, exitCode: code ?? 1 }));
    });
}

/**
 * Executes a DCMTK binary using `child_process.spawn()`.
 *
 * Like {@link execCommand}, arguments are passed as an array to avoid shell
 * injection (Rule 7.4). This variant additionally supports custom environment
 * variables via the `env` option.
 *
 * @param binary - Full path to the DCMTK binary
 * @param args - Command-line arguments (passed directly, no shell interpolation)
 * @param options - Execution options (timeout, cwd, signal, env)
 * @returns A Result containing the process output or an error
 * @throws Never throws for expected failures (Rule 6.1)
 *
 * @example
 * ```ts
 * const result = await spawnCommand('/usr/local/bin/dcmodify', ['-m', '(0010,0010)=Smith^John', 'input.dcm']);
 * ```
 */
async function spawnCommand(binary: string, args: readonly string[], options?: SpawnOptions): Promise<Result<DcmtkProcessResult>> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise(resolve => {
        const child = spawn(binary, [...args], {
            cwd: options?.cwd,
            /* v8 ignore next -- env override branch */
            env: options?.env ? { ...process.env, ...options.env } : undefined,
            windowsHide: true,
            signal: options?.signal,
        });
        wireSpawnListeners(child, timeoutMs, resolve);
    });
}

export { execCommand, spawnCommand };
