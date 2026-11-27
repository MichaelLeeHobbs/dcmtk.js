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
import type { ChildProcess, SpawnOptions as NodeSpawnOptions } from 'node:child_process';
import type { Result, DcmtkProcessResult, ExecOptions, SpawnOptions } from './types';
import { ok, err } from './types';
import { DEFAULT_TIMEOUT_MS, MAX_OUTPUT_BYTES } from './constants';
import { killTree } from './killTree';

/**
 * Executes a DCMTK binary as a short-lived process.
 *
 * **Security:** This function uses `child_process.spawn()` internally, passing
 * arguments as an array to avoid shell interpretation. This eliminates shell
 * injection risks regardless of argument content (Rule 7.4).
 *
 * On timeout or abort the whole process tree is killed before the Result is returned.
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
    const limits: RunLimits = { timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal: options?.signal };
    return runBinary(binary, args, { cwd: options?.cwd, windowsHide: true }, limits);
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
    const spawnOptions: NodeSpawnOptions = {
        cwd: options?.cwd,
        env: options?.env ? { ...process.env, ...options.env } : undefined,
        windowsHide: true,
    };
    const limits: RunLimits = { timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal: options?.signal };
    return runBinary(binary, args, spawnOptions, limits);
}

interface RunLimits {
    readonly timeoutMs: number;
    readonly signal: AbortSignal | undefined;
}

/**
 * Spawns the binary and settles once it exits, times out, overflows its output cap, or is aborted.
 *
 * The signal is deliberately not handed to `spawn()`: Node would kill only the direct child (#56).
 */
function runBinary(binary: string, args: readonly string[], spawnOptions: NodeSpawnOptions, limits: RunLimits): Promise<Result<DcmtkProcessResult>> {
    const name = binary.split(/[\\/]/).pop() ?? binary;
    if (limits.signal?.aborted === true) {
        return Promise.resolve(err(new Error(`${name} aborted before it started`)));
    }
    return new Promise(resolve => {
        const child = spawn(binary, [...args], spawnOptions);
        wireSpawnListeners(name, child, limits, resolve);
    });
}

/**
 * Wires event listeners on a spawned child process with timeout, abort, bounded buffering, and settle logic.
 */
function wireSpawnListeners(name: string, child: ChildProcess, limits: RunLimits, resolve: (result: Result<DcmtkProcessResult>) => void): void {
    const { timeoutMs, signal } = limits;
    let stdout = '';
    let stderr = '';
    let settled = false;
    // Set once we start killing the tree; the 'close' that the kill causes must not settle as a normal exit.
    let ending = false;
    const pidLabel = String(child.pid ?? 'unknown');

    const settle = (result: Result<DcmtkProcessResult>): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
    };

    const endWithError = (message: string): void => {
        if (ending || settled) return;
        ending = true;
        void killThenFail(child, message).then(settle);
    };

    const onAbort = (): void => endWithError(`${name} aborted (pid: ${pidLabel})`);
    const timer = setTimeout(() => endWithError(`${name} timed out after ${String(timeoutMs)}ms (pid: ${pidLabel})`), timeoutMs);
    signal?.addEventListener('abort', onAbort, { once: true });

    const onChunk = (source: 'stdout' | 'stderr', chunk: Buffer | string): void => {
        if (source === 'stdout') stdout += String(chunk);
        else stderr += String(chunk);
        if (stdout.length + stderr.length > MAX_OUTPUT_BYTES) endWithError(`${name} output exceeded ${MAX_OUTPUT_BYTES} bytes`);
    };
    child.stdout?.on('data', (chunk: Buffer | string) => onChunk('stdout', chunk));
    child.stderr?.on('data', (chunk: Buffer | string) => onChunk('stderr', chunk));

    child.on('error', (error: Error) => endWithError(`${name} error: ${error.message}`));
    child.on('close', (code: number | null) => {
        if (!ending) settle(ok({ stdout, stderr, exitCode: code ?? 1 }));
    });
}

/** Kills the child's whole tree, then builds the error Result, noting a failed kill so leftovers are explained. */
async function killThenFail(child: ChildProcess, message: string): Promise<Result<DcmtkProcessResult>> {
    if (child.pid === undefined) return err(new Error(message));
    const killed = await killTree(child.pid);
    return err(new Error(killed.ok ? message : `${message}; killing its process tree failed: ${killed.error.message}`));
}

export { execCommand, spawnCommand };
