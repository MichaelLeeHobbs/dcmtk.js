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
import kill from 'tree-kill';
import type { Result, LineSource } from './types';
import { ok, err } from './types';
import { DEFAULT_START_TIMEOUT_MS, DEFAULT_DRAIN_TIMEOUT_MS } from './constants';

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
        this.config = config;
        // Prevent unhandled 'error' events from crashing the process.
        // Consumers can add their own 'error' listener to override.
        this.on('error', () => {
            // Default no-op handler; errors are returned via Result from start()
        });
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
                this.killChild();
                resolve(err(new Error(`Process failed to start within ${timeoutMs}ms`)));
            }, timeoutMs);

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
                const msg = e instanceof Error ? e.message : String(e);
                settle(err(new Error(`Failed to spawn process: ${msg}`)));
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
            /* v8 ignore next 4 -- drain timeout is a safety net for unresponsive processes */
            const timer = setTimeout(() => {
                this.killChild();
                this.state = ProcessState.STOPPED;
                resolve();
            }, drainMs);

            if (this.child) {
                this.child.once('close', () => {
                    clearTimeout(timer);
                    this.state = ProcessState.STOPPED;
                    resolve();
                });
                this.killChild();
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
            this.killChild();
            this.child = null;
        }
        this.state = ProcessState.STOPPED;
        this.removeAllListeners();
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private killChild(): void {
        if (this.child?.pid !== undefined && this.child.pid !== null) {
            try {
                kill(this.child.pid);
                /* v8 ignore next */
            } catch {
                // Process may already be dead
            }
        }
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
            this.processLines(source, 'stdoutBuffer');
        } else {
            this.stderrBuffer += String(chunk);
            this.processLines(source, 'stderrBuffer');
        }
    }

    private processLines(source: LineSource, bufferKey: 'stdoutBuffer' | 'stderrBuffer'): void {
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
