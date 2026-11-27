/**
 * Base class for long-lived DCMTK processes (servers).
 *
 * Manages spawning, line-by-line output buffering, typed event emission,
 * lifecycle (start/stop), mandatory timeouts, and graceful shutdown.
 *
 * Implements `Disposable` for deterministic cleanup (Rule 5.1).
 *
 * @module DcmtkProcess
 */

import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { stderr } from 'stderr-lib';
import type { Result, LineSource } from './types';
import { ok, err } from './types';
import { killTree } from './killTree';
import { DEFAULT_START_TIMEOUT_MS, DEFAULT_DRAIN_TIMEOUT_MS, MAX_OUTPUT_BYTES } from './constants';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/** Events emitted by a DcmtkProcess. */
interface DcmtkProcessEventMap {
    started: [];
    stopped: [{ readonly reason: string }];
    error: [{ readonly error: Error; readonly fatal: boolean }];
    line: [{ readonly source: LineSource; readonly text: string }];
}

/** Configuration for a DcmtkProcess instance. */
interface DcmtkProcessConfig {
    /** Full path to the DCMTK binary. */
    readonly binary: string;
    /** Command-line arguments. */
    readonly args: readonly string[];
    /** Working directory. */
    readonly cwd?: string | undefined;
    /** Timeout for start() to resolve, in milliseconds. */
    readonly startTimeoutMs?: number | undefined;
    /** Timeout for graceful drain during stop(), in milliseconds. */
    readonly drainTimeoutMs?: number | undefined;
    /**
     * A function that inspects each output line and returns `true` when
     * the process is considered "started" (e.g., "listening on port X").
     * If not provided, start() resolves immediately after spawn.
     */
    readonly isStartedPredicate?: ((line: string) => boolean) | undefined;
}

// ---------------------------------------------------------------------------
// State enum (as const, not traditional enum — Rule 3.5)
// ---------------------------------------------------------------------------

const ProcessState = {
    IDLE: 'IDLE',
    STARTING: 'STARTING',
    RUNNING: 'RUNNING',
    STOPPING: 'STOPPING',
    STOPPED: 'STOPPED',
} as const;

type ProcessStateValue = (typeof ProcessState)[keyof typeof ProcessState];

// ---------------------------------------------------------------------------
// DcmtkProcess class
// ---------------------------------------------------------------------------

/**
 * Base class for persistent DCMTK processes (e.g., dcmrecv, storescp).
 *
 * @example
 * ```ts
 * const proc = new DcmtkProcess({
 *     binary: '/usr/local/bin/dcmrecv',
 *     args: ['--config', 'storescp.cfg', '11112'],
 *     isStartedPredicate: line => line.includes('listening'),
 * });
 *
 * const result = await proc.start();
 * if (result.ok) {
 *     // Process is running
 *     proc.on('line', ({ source, text }) => console.log(`[${source}] ${text}`));
 * }
 *
 * await proc.stop();
 * ```
 */
class DcmtkProcess extends EventEmitter<DcmtkProcessEventMap> {
    private state: ProcessStateValue = ProcessState.IDLE;
    private child: ChildProcess | null = null;
    private stdoutBuffer = '';
    private stderrBuffer = '';
    private readonly config: DcmtkProcessConfig;

    constructor(config: DcmtkProcessConfig) {
        super();
        // Servers can have up to ~15 event types plus internal listeners;
        // raise above the default 10 to avoid MaxListenersExceeded warnings.
        this.setMaxListeners(20);
        this.config = config;
        // Prevent unhandled 'error' events from crashing the process (Node.js
        // throws if 'error' is emitted with no listener). Consumers should
        // register their own 'error' listener before calling start() to receive
        // errors. Startup errors are also returned via Result from start().
        this.on('error', () => {});
    }

    /** Whether the process is currently running. */
    get isRunning(): boolean {
        return this.state === ProcessState.RUNNING;
    }

    /** Current process state. */
    get currentState(): ProcessStateValue {
        return this.state;
    }

    /**
     * Starts the DCMTK process.
     *
     * Single-use enforcement: returns an error if called more than once.
     * Waits for the `isStartedPredicate` to match an output line, or resolves
     * immediately after spawn if no predicate is configured.
     *
     * @returns A Result indicating success or failure
     */
    async start(): Promise<Result<void>> {
        if (this.state !== ProcessState.IDLE) {
            return err(new Error(`Cannot start: process is in state "${this.state}"`));
        }
        this.state = ProcessState.STARTING;
        const timeoutMs = this.config.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS;

        return new Promise<Result<void>>(resolve => {
            let settled = false;
            const timer = setTimeout(() => {
                if (settled) return;
                settled = true;
                this.state = ProcessState.STOPPED;
                void this.killChild();
                resolve(err(new Error(`Process failed to start within ${timeoutMs}ms`)));
            }, timeoutMs);

            // Safe from races: Node.js is single-threaded, so the `settled`
            // flag check + set is atomic within each event handler invocation.
            const settle = (result: Result<void>): void => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(result);
            };

            try {
                this.child = spawn(this.config.binary, [...this.config.args], {
                    cwd: this.config.cwd,
                    windowsHide: true,
                });
                /* v8 ignore start -- spawn() rarely throws synchronously */
            } catch (e: unknown) {
                settle(err(new Error(`Failed to spawn process: ${stderr(e).message}`)));
                return;
            }
            /* v8 ignore stop */
            this.wireChildEvents(settle);
        });
    }

    /**
     * Stops the process gracefully.
     *
     * Waits up to `drainTimeoutMs` for the process to exit, then force-kills.
     */
    async stop(): Promise<void> {
        if (this.state === ProcessState.STOPPED || this.state === ProcessState.IDLE) {
            return;
        }

        this.state = ProcessState.STOPPING;
        const drainMs = this.config.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS;

        return new Promise<void>(resolve => {
            const finish = (): void => {
                this.state = ProcessState.STOPPED;
                resolve();
            };
            const timer = setTimeout(() => {
                const child = this.child;
                if (child !== null && child.exitCode === null && child.signalCode === null) {
                    void this.killChild().then(result => {
                        this.reportKillFailure(result);
                        finish();
                    });
                    return;
                }
                // The root exited but 'close' never came: a process it started still holds the stdio pipes, and
                // no tree kill can reach it from a dead root.
                this.reportKillFailure(
                    err(new Error(`process exited but its output stayed open for ${String(drainMs)}ms; a process it started may still be running`))
                );
                finish();
            }, drainMs);

            // Safe: Node.js is single-threaded, so `this.child` cannot become null
            // between the check and the `.once('close', ...)` registration. The
            // drain timeout handles the edge case where the child exits before
            // the close listener is registered.
            if (this.child) {
                this.child.once('close', () => {
                    clearTimeout(timer);
                    this.state = ProcessState.STOPPED;
                    resolve();
                });
                void this.killChild().then(result => this.reportKillFailure(result));
                /* v8 ignore start -- edge case: state is RUNNING but child is already null */
            } else {
                clearTimeout(timer);
                this.state = ProcessState.STOPPED;
                resolve();
            }
            /* v8 ignore stop */
        });
    }

    /**
     * Implements Disposable for deterministic cleanup (Rule 5.1).
     */
    [Symbol.dispose](): void {
        if (this.child) {
            void this.killChild();
            this.child = null;
        }
        this.state = ProcessState.STOPPED;
        this.removeAllListeners();
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private killChild(): Promise<Result<void>> {
        const pid = this.child?.pid;
        if (pid === undefined) return Promise.resolve(ok(undefined));
        return killTree(pid);
    }

    /**
     * Surfaces a failed tree kill as a non-fatal error, since it may have left a DCMTK process running.
     * The listener check matters: `[Symbol.dispose]` removes every listener, and emitting 'error' with none throws.
     */
    private reportKillFailure(result: Result<void>): void {
        if (result.ok || this.listenerCount('error') === 0) return;
        this.emit('error', { error: new Error(`Failed to kill process tree: ${result.error.message}`), fatal: false });
    }

    /**
     * Wires all child process event handlers for startup.
     */
    private wireChildEvents(settle: (result: Result<void>) => void): void {
        const child = this.child;
        if (!child) return;

        child.on('error', (error: Error) => {
            this.emit('error', { error, fatal: true });
            if (this.state === ProcessState.STARTING) {
                this.state = ProcessState.STOPPED;
                settle(err(new Error(`Process error during start: ${error.message}`)));
            }
        });

        child.on('close', (code: number | null) => {
            const prevState = this.state;
            this.state = ProcessState.STOPPED;
            this.child = null;
            const reason = `Process exited with code ${String(code ?? 'null')}`;
            this.emit('stopped', { reason });
            if (prevState === ProcessState.STARTING) settle(err(new Error(reason)));
        });

        child.stdout?.on('data', (chunk: Buffer | string) => {
            this.handleData('stdout', chunk);
        });
        child.stderr?.on('data', (chunk: Buffer | string) => {
            this.handleData('stderr', chunk);
        });

        child.on('spawn', () => {
            if (!this.config.isStartedPredicate) {
                this.state = ProcessState.RUNNING;
                this.emit('started');
                settle(ok(undefined));
            }
        });

        if (this.config.isStartedPredicate) {
            this.wireStartedPredicate(settle);
        }
    }

    /**
     * Wires a line listener that resolves start() when the predicate matches.
     */
    private wireStartedPredicate(settle: (result: Result<void>) => void): void {
        const onLine = ({ text }: { readonly source: LineSource; readonly text: string }): void => {
            if (this.config.isStartedPredicate?.(text)) {
                this.removeListener('line', onLine);
                this.state = ProcessState.RUNNING;
                this.emit('started');
                settle(ok(undefined));
            }
        };
        this.on('line', onLine);
    }

    private handleData(source: LineSource, chunk: Buffer | string): void {
        if (source === 'stdout') {
            this.stdoutBuffer += String(chunk);
        } else {
            this.stderrBuffer += String(chunk);
        }

        if (this.stdoutBuffer.length + this.stderrBuffer.length > MAX_OUTPUT_BYTES) {
            this.emit('error', { error: new Error(`Process output exceeded ${MAX_OUTPUT_BYTES} bytes`), fatal: true });
            void this.killChild();
            return;
        }

        this.processLines(source, source === 'stdout' ? 'stdoutBuffer' : 'stderrBuffer');
    }

    private processLines(source: LineSource, bufferKey: 'stdoutBuffer' | 'stderrBuffer'): void {
        // Handle bare \r (CR-only) line endings by converting to \n
        this[bufferKey] = this[bufferKey].replace(/\r(?!\n)/g, '\n');

        let newlineIdx = this[bufferKey].indexOf('\n');

        // Iterative line extraction — no recursion (Rule 8.2)
        while (newlineIdx !== -1) {
            const current = this[bufferKey];
            const line = current.substring(0, newlineIdx).replace(/\r$/, '');
            this[bufferKey] = current.substring(newlineIdx + 1);
            this.emit('line', { source, text: line });
            newlineIdx = this[bufferKey].indexOf('\n');
        }
    }
}

export { DcmtkProcess, ProcessState };
export type { DcmtkProcessEventMap, DcmtkProcessConfig, ProcessStateValue };
