/**
 * Pooled DICOM receiver with auto-scaling.
 *
 * Manages a pool of long-lived `Dcmrecv` workers behind a TCP proxy,
 * routing incoming connections to idle workers. Workers are reused
 * across associations — they are only stopped during scale-down or
 * shutdown.
 *
 * @module servers/DicomReceiver
 */

import * as net from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { isSafePath, isValidAETitle } from '../patterns';
import { createValidationError } from '../tools/_toolError';
import { ensureDirectory, moveFile, statFileSafe, removeDirSafe } from '../utils';
import { Dcmrecv } from './Dcmrecv';
import type { FilenameModeValue, StorageModeValue } from './Dcmrecv';
import type { AssociationCompleteData } from '../events/dcmrecv';
import { DicomInstance } from '../dicom';
import type { DicomOpenOptions } from '../dicom/_fileHelpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MIN_POOL_SIZE = 2;
const DEFAULT_MAX_POOL_SIZE = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const CONNECTION_RETRY_INTERVAL_MS = 500;
const MAX_CONNECTION_RETRIES = 200;
const MAX_OUTPUT_LINES_PER_ASSOCIATION = 500;
/**
 * Grace period after a connection's sockets tear down before the association
 * is reaped as an unreported abort. dcmrecv reports a normal A-RELEASE (or a
 * detected abort) via ASSOCIATION_COMPLETE within milliseconds of the socket
 * closing; this delay gives that report time to arrive so a clean release is
 * never misclassified as an abort. Only if no completion arrives within the
 * window does the pool synthesize a terminal abort (see {@link
 * DicomReceiver.scheduleAbortReap}).
 */
const ABORT_REAP_GRACE_MS = 5_000;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** Snapshot of the worker pool state. */
interface PoolStatus {
    /** Number of idle workers ready for connections. */
    readonly idle: number;
    /** Number of workers currently handling associations. */
    readonly busy: number;
    /** Total number of workers (idle + busy). */
    readonly total: number;
}

/** Data emitted with FILE_RECEIVED events (raw from dcmrecv, before processing). */
interface ReceiverFileReceivedData {
    readonly filePath: string;
    readonly associationId: string;
    readonly callingAE: string;
    readonly calledAE: string;
    readonly source: string;
}

/** Data emitted with FILE_STORED events (file moved to association dir). */
interface ReceiverFileStoredData {
    readonly filePath: string;
    readonly fileSize: number;
    readonly associationId: string;
    readonly associationDir: string;
    readonly callingAE: string;
    readonly calledAE: string;
    readonly source: string;
}

/** Data emitted with INSTANCE_RECEIVED events (parsed DicomInstance available). */
interface ReceiverInstanceData {
    readonly filePath: string;
    readonly fileSize: number;
    readonly associationId: string;
    readonly associationDir: string;
    readonly callingAE: string;
    readonly calledAE: string;
    readonly source: string;
    readonly instance: DicomInstance;
}

/** Data emitted with ASSOCIATION_COMPLETE events. */
interface ReceiverAssociationData {
    readonly associationId: string;
    readonly associationDir: string;
    readonly callingAE: string;
    readonly calledAE: string;
    readonly source: string;
    readonly files: readonly string[];
    readonly durationMs: number;
    readonly endReason: 'release' | 'abort';
    readonly totalBytes: number;
    readonly bytesPerSecond: number;
    readonly startAt: number;
    readonly endAt: number;
    /** Captured stdout/stderr lines from the worker during this association. */
    readonly output: readonly string[];
}

/** Data emitted with ASSOCIATION_RECEIVED events (bubbled from worker). */
interface PoolAssociationReceivedData {
    readonly associationId: string;
    readonly callingAE: string;
    readonly calledAE: string;
    readonly source: string;
}

/** Data emitted with C_STORE_REQUEST events (bubbled from worker). */
interface PoolCStoreRequestData {
    readonly associationId: string;
    readonly raw: string;
}

/** Data emitted with ECHO_REQUEST events (bubbled from worker). */
interface PoolEchoRequestData {
    readonly associationId: string;
}

/** Data emitted with REFUSING_ASSOCIATION events (bubbled from worker). */
interface PoolRefusingAssociationData {
    readonly reason: string;
}

/** Data emitted with INSTANCE_ERROR events when DicomInstance.open fails. */
interface ReceiverInstanceErrorData {
    readonly error: Error;
    /** Whether this was a thrown exception (true) or a Result error (false). */
    readonly thrown: boolean;
    readonly filePath: string;
    readonly fileSize: number;
    readonly associationId: string;
    readonly associationDir: string;
    readonly callingAE: string;
    readonly calledAE: string;
    readonly source: string;
}

/** Data emitted with ASSOCIATION_FINALIZED — all work (including parsing) is done. */
interface ReceiverAssociationFinalizedData {
    readonly associationId: string;
    readonly associationDir: string;
    readonly callingAE: string;
    readonly calledAE: string;
    readonly source: string;
    readonly files: readonly string[];
    readonly instancesReceived: number;
    readonly instanceErrors: number;
    /**
     * How the association ended: `'release'` for a normal A-RELEASE, `'abort'`
     * for a peer abort (including associations synthesized by the grace-period
     * reaper when dcmrecv never reported completion). Lets consumers that drive
     * terminal state off this event distinguish a reaped abort from a clean
     * finish without also listening to ASSOCIATION_COMPLETE.
     */
    readonly endReason: 'release' | 'abort';
}

/** Data emitted with error events. */
interface ReceiverErrorData {
    readonly error: Error;
    readonly filePath?: string;
    readonly associationId?: string;
    readonly associationDir?: string;
    readonly callingAE?: string;
    readonly calledAE?: string;
    readonly source?: string;
}

/** Typed event map for DicomReceiver. */
interface DicomReceiverEventMap {
    FILE_RECEIVED: [ReceiverFileReceivedData];
    FILE_STORED: [ReceiverFileStoredData];
    INSTANCE_RECEIVED: [ReceiverInstanceData];
    INSTANCE_ERROR: [ReceiverInstanceErrorData];
    ASSOCIATION_COMPLETE: [ReceiverAssociationData];
    ASSOCIATION_FINALIZED: [ReceiverAssociationFinalizedData];
    ASSOCIATION_RECEIVED: [PoolAssociationReceivedData];
    C_STORE_REQUEST: [PoolCStoreRequestData];
    ECHO_REQUEST: [PoolEchoRequestData];
    REFUSING_ASSOCIATION: [PoolRefusingAssociationData];
    error: [ReceiverErrorData];
}

/** Options for creating a DicomReceiver instance. */
interface DicomReceiverOptions {
    /** External port to listen on (required). */
    readonly port: number;
    /** Root directory for association subdirectories (required). */
    readonly storageDir: string;
    /** Application Entity Title for workers. */
    readonly aeTitle?: string | undefined;
    /** Minimum number of idle workers to maintain. */
    readonly minPoolSize?: number | undefined;
    /** Maximum total workers allowed. */
    readonly maxPoolSize?: number | undefined;
    /** Timeout for waiting for an idle worker (milliseconds). */
    readonly connectionTimeoutMs?: number | undefined;
    /** Path to a dcmrecv association negotiation configuration file. */
    readonly configFile?: string | undefined;
    /** Profile name within the configuration file. */
    readonly configProfile?: string | undefined;
    /** ACSE timeout in seconds (passed through to Dcmrecv workers). */
    readonly acseTimeout?: number | undefined;
    /** DIMSE timeout in seconds (passed through to Dcmrecv workers). */
    readonly dimseTimeout?: number | undefined;
    /** Maximum PDU receive size (passed through to Dcmrecv workers). */
    readonly maxPdu?: number | undefined;
    /** Filename generation mode for received files (passed through to Dcmrecv workers). */
    readonly filenameMode?: FilenameModeValue | undefined;
    /** Extension appended to received filenames, e.g. `'.dcm'` (passed through to Dcmrecv workers). */
    readonly filenameExtension?: string | undefined;
    /** Storage mode for received files (passed through to Dcmrecv workers). */
    readonly storageMode?: StorageModeValue | undefined;
    /** Options passed to DicomInstance.open() for each received file. Defaults charsetFallback to `'Latin1'`. */
    readonly instanceOpenOptions?: DicomOpenOptions | undefined;
    /** Whether to parse received files into DicomInstance. When false, INSTANCE_RECEIVED and INSTANCE_ERROR events are not emitted. Defaults to true. */
    readonly parseInstances?: boolean | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

// ---------------------------------------------------------------------------
// Zod validation schema
// ---------------------------------------------------------------------------

const DicomReceiverOptionsSchema = z
    .object({
        port: z.number().int().min(0).max(65535),
        storageDir: z.string().min(1).refine(isSafePath, { message: 'path traversal detected in storageDir' }),
        aeTitle: z.string().min(1).max(16).refine(isValidAETitle, { message: 'AE Title contains invalid characters' }).optional(),
        minPoolSize: z.number().int().min(1).max(100).optional(),
        maxPoolSize: z.number().int().min(1).max(100).optional(),
        connectionTimeoutMs: z.number().int().positive().optional(),
        configFile: z.string().min(1).refine(isSafePath, { message: 'path traversal detected in configFile' }).optional(),
        configProfile: z.string().min(1).optional(),
        acseTimeout: z.number().int().positive().optional(),
        dimseTimeout: z.number().int().positive().optional(),
        maxPdu: z.number().int().min(4096).max(131072).optional(),
        filenameMode: z.enum(['default', 'unique', 'short-unique', 'system-time']).optional(),
        filenameExtension: z.string().min(1).optional(),
        storageMode: z.enum(['normal', 'bit-preserving', 'ignore']).optional(),
        instanceOpenOptions: z
            .object({
                timeoutMs: z.number().int().positive().optional(),
                signal: z.instanceof(AbortSignal).optional(),
                charsetAssume: z.string().min(1).optional(),
                charsetFallback: z.string().min(1).optional(),
            })
            .strict()
            .optional(),
        parseInstances: z.boolean().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .refine(data => (data.minPoolSize ?? DEFAULT_MIN_POOL_SIZE) <= (data.maxPoolSize ?? DEFAULT_MAX_POOL_SIZE), {
        message: 'minPoolSize must be <= maxPoolSize',
    });

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Frozen context for a single association, captured synchronously at connection time. */
interface AssociationContext {
    readonly associationId: string;
    readonly associationDir: string;
    readonly startAt: number;
}

// ---------------------------------------------------------------------------
// Internal Worker class
// ---------------------------------------------------------------------------

/** Encapsulates a single Dcmrecv worker and its per-association state. */
class Worker {
    readonly dcmrecv: Dcmrecv;
    readonly port: number;
    readonly tempDir: string;
    private _state: 'idle' | 'busy' | 'finalizing' = 'idle';
    private _context: AssociationContext | undefined;
    private readonly _pending = new Set<Promise<void>>();
    private readonly _instancePending = new Set<Promise<void>>();
    private _instancesReceived = 0;
    private _instanceErrors = 0;
    private _finalized = false;
    private _associationReceivedEmitted = false;
    private _reapScheduled = false;
    private readonly _files: string[] = [];
    private readonly _fileSizes: number[] = [];
    private readonly _outputLines: string[] = [];
    private _remoteSocket: net.Socket | undefined;
    private _workerSocket: net.Socket | undefined;

    constructor(dcmrecv: Dcmrecv, port: number, tempDir: string) {
        this.dcmrecv = dcmrecv;
        this.port = port;
        this.tempDir = tempDir;
    }

    /** Current worker state: idle (ready), busy (handling association), finalizing (draining). */
    get state(): 'idle' | 'busy' | 'finalizing' {
        return this._state;
    }

    /** Active association context, or undefined when idle. */
    get context(): AssociationContext | undefined {
        return this._context;
    }

    /** Files moved to the association directory during the current association. */
    get files(): readonly string[] {
        return this._files;
    }

    /** Byte sizes parallel to files[], for transfer stats. */
    get fileSizes(): readonly number[] {
        return this._fileSizes;
    }

    /** Captured output lines during the current association. */
    get outputLines(): readonly string[] {
        return this._outputLines;
    }

    /** Marks the worker busy with a new association context. */
    beginAssociation(ctx: AssociationContext): void {
        this._state = 'busy';
        this._context = ctx;
        this._files.length = 0;
        this._fileSizes.length = 0;
        this._outputLines.length = 0;
        this._pending.clear();
        this._instancePending.clear();
        this._instancesReceived = 0;
        this._instanceErrors = 0;
        this._finalized = false;
        this._associationReceivedEmitted = false;
        this._reapScheduled = false;
    }

    /**
     * Claims the single abort-reap timer slot for this association. The socket
     * `cleanup` handler runs on up to four socket events (remote/worker ×
     * error/close, plus an explicit setup-race call), so without this guard each
     * teardown would arm its own redundant grace-period timer. Returns true only
     * for the first caller; subsequent calls return false and arm nothing.
     */
    claimReapSchedule(): boolean {
        if (this._reapScheduled) return false;
        this._reapScheduled = true;
        return true;
    }

    /** True once per association: the first caller wins the finalize, others get false. */
    beginFinalizeOnce(): boolean {
        if (this._finalized) return false;
        this._finalized = true;
        return true;
    }

    /** Whether finalize handling has already been claimed for the current association. */
    get finalized(): boolean {
        return this._finalized;
    }

    /** Records that ASSOCIATION_RECEIVED was emitted to consumers for this association. */
    markAssociationReceived(): void {
        this._associationReceivedEmitted = true;
    }

    /**
     * Whether ASSOCIATION_RECEIVED was emitted for the current association —
     * i.e. the association was handed off to consumers. When false (a connection
     * that aborted during/before DICOM negotiation), no consumer ever engaged
     * with the association directory, so the pool owns its cleanup.
     */
    get associationReceived(): boolean {
        return this._associationReceivedEmitted;
    }

    /**
     * Atomically reserves a just-selected idle worker so concurrent connection
     * routing cannot hand the same worker to two associations. Must be called
     * synchronously the instant an idle worker is picked — before any `await` —
     * because `handleConnection` yields (e.g. on `ensureDirectory`) between
     * selecting a worker and calling {@link beginAssociation}. Without this,
     * two concurrent connections both see the worker as idle, both proceed, and
     * the second `beginAssociation` overwrites the first's context — orphaning
     * the first association (no terminal event ever fires for it). Released via
     * {@link release} if association setup fails before `beginAssociation`.
     */
    reserve(): void {
        this._state = 'busy';
    }

    /** Returns a reserved-but-not-yet-begun worker to the idle pool (setup failed). */
    release(): void {
        this._state = 'idle';
    }

    /** Marks the worker as finalizing — still has valid context but cannot accept new connections. */
    markFinalizing(): void {
        this._state = 'finalizing';
    }

    /**
     * Returns the worker to idle. Context is intentionally preserved so that
     * late FILE_RECEIVED events (arriving in a subsequent pipe chunk after
     * ASSOCIATION_RELEASE) still have valid association info. Context is
     * cleared on the next {@link beginAssociation} call.
     */
    endAssociation(): void {
        this._state = 'idle';
        // NOTE: _context is NOT cleared here — see JSDoc above
        this._files.length = 0;
        this._fileSizes.length = 0;
        this._outputLines.length = 0;
        this._pending.clear();
        this._instancePending.clear();
        this._instancesReceived = 0;
        this._instanceErrors = 0;
        this._remoteSocket = undefined;
        this._workerSocket = undefined;
    }

    /** Tracks an in-flight file handling promise; auto-removes on completion. */
    trackFile(promise: Promise<void>): void {
        this._pending.add(promise);
        void promise.finally(() => {
            this._pending.delete(promise);
        });
    }

    /** Tracks an in-flight instance parsing promise; auto-removes on completion. */
    trackInstance(promise: Promise<void>): void {
        this._instancePending.add(promise);
        void promise.finally(() => {
            this._instancePending.delete(promise);
        });
    }

    /** Records a successful instance parse. */
    recordInstanceSuccess(): void {
        this._instancesReceived++;
    }

    /** Records a failed instance parse. */
    recordInstanceError(): void {
        this._instanceErrors++;
    }

    /** Awaits all in-flight instance parsing promises. */
    async drainInstancePending(): Promise<void> {
        if (this._instancePending.size > 0) {
            await Promise.all(this._instancePending);
        }
    }

    /** Number of successfully parsed instances in this association. */
    get instancesReceived(): number {
        return this._instancesReceived;
    }

    /** Number of failed instance parses in this association. */
    get instanceErrors(): number {
        return this._instanceErrors;
    }

    /** Records a successfully received file path and its size. */
    recordFile(filePath: string, size: number): void {
        this._files.push(filePath);
        this._fileSizes.push(size);
    }

    /** Awaits all in-flight file handling promises. */
    async drainPendingFiles(): Promise<void> {
        if (this._pending.size > 0) {
            await Promise.all(this._pending);
        }
    }

    /** Appends a line to the output buffer, respecting the cap. */
    captureOutput(text: string): void {
        if (this._outputLines.length < MAX_OUTPUT_LINES_PER_ASSOCIATION) {
            this._outputLines.push(text);
        }
    }

    /** Stores the remote and worker sockets for later cleanup. */
    setSockets(remote: net.Socket, worker: net.Socket): void {
        this._remoteSocket = remote;
        this._workerSocket = worker;
    }

    /** Destroys both sockets if they exist and are not already destroyed. */
    destroySockets(): void {
        if (this._remoteSocket !== undefined && !this._remoteSocket.destroyed) {
            this._remoteSocket.destroy();
        }
        if (this._workerSocket !== undefined && !this._workerSocket.destroyed) {
            this._workerSocket.destroy();
        }
    }
}

// ---------------------------------------------------------------------------
// Port allocation helper
// ---------------------------------------------------------------------------

/** Allocates a free ephemeral port by binding to port 0. */
function allocatePort(): Promise<Result<number>> {
    return new Promise(resolve => {
        const server = net.createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (addr === null || typeof addr === 'string') {
                server.close(() => resolve(err(new Error('Failed to allocate port'))));
                return;
            }
            const port = addr.port;
            server.close(() => resolve(ok(port)));
        });
        server.on('error', e => {
            resolve(err(new Error(`Port allocation failed: ${e.message}`)));
        });
    });
}

// ---------------------------------------------------------------------------
// Trivial helpers
// ---------------------------------------------------------------------------

/** Sums an array of numbers iteratively. */
function sumArray(arr: readonly number[]): number {
    let total = 0;
    for (let i = 0; i < arr.length; i++) {
        total += arr[i] ?? 0;
    }
    return total;
}

// ---------------------------------------------------------------------------
// DicomReceiver class
// ---------------------------------------------------------------------------

/**
 * Pooled DICOM receiver with auto-scaling.
 *
 * Manages a pool of long-lived `Dcmrecv` workers behind a TCP proxy.
 * Incoming connections are routed to idle workers. Workers are reused
 * across associations and only stopped during scale-down or shutdown.
 *
 * @example
 * ```ts
 * const result = DicomReceiver.create({
 *     port: 4242,
 *     storageDir: '/data/received',
 *     minPoolSize: 2,
 *     maxPoolSize: 8,
 * });
 * if (!result.ok) { console.error(result.error.message); return; }
 * const receiver = result.value;
 *
 * receiver.onFileReceived(data => console.log('File:', data.filePath));
 * receiver.onAssociationComplete(data => console.log('Done:', data.associationDir));
 *
 * await receiver.start();
 * ```
 */
class DicomReceiver extends EventEmitter<DicomReceiverEventMap> {
    private readonly options: DicomReceiverOptions;
    private readonly minPoolSize: number;
    private readonly maxPoolSize: number;
    private readonly connectionTimeoutMs: number;
    private readonly resolvedInstanceOpenOptions: DicomOpenOptions;
    private readonly parseInstances: boolean;
    private readonly workers: Map<number, Worker> = new Map();
    private tcpServer: net.Server | undefined;
    private associationCounter = 0;
    private started = false;
    private stopping = false;
    private abortHandler: (() => void) | undefined;

    private constructor(options: DicomReceiverOptions) {
        super();
        this.setMaxListeners(20);
        this.options = options;
        this.minPoolSize = options.minPoolSize ?? DEFAULT_MIN_POOL_SIZE;
        this.maxPoolSize = options.maxPoolSize ?? DEFAULT_MAX_POOL_SIZE;
        this.connectionTimeoutMs = options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
        this.resolvedInstanceOpenOptions = { charsetFallback: 'Latin1', ...options.instanceOpenOptions };
        this.parseInstances = options.parseInstances ?? true;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Creates a new DicomReceiver instance.
     *
     * @param options - Configuration options
     * @returns A Result containing the instance or a validation error
     */
    static create(options: DicomReceiverOptions): Result<DicomReceiver> {
        const validation = DicomReceiverOptionsSchema.safeParse(options);
        if (!validation.success) {
            return err(createValidationError('DicomReceiver', validation.error));
        }
        return ok(new DicomReceiver(options));
    }

    /**
     * Starts the TCP proxy and spawns the initial worker pool.
     *
     * @returns A Result indicating success or failure
     */
    async start(): Promise<Result<void>> {
        if (this.started) {
            return err(new Error('DicomReceiver: already started'));
        }
        this.started = true;

        const storageDirResult = await ensureDirectory(this.options.storageDir);
        if (!storageDirResult.ok) return storageDirResult;

        const spawnResults = await this.spawnWorkers(this.minPoolSize);
        if (!spawnResults.ok) return spawnResults;

        const listenResult = await this.startTcpProxy();
        if (!listenResult.ok) return listenResult;

        if (this.options.signal !== undefined) {
            this.wireAbortSignal(this.options.signal);
        }

        return ok(undefined);
    }

    /**
     * Stops the TCP proxy and all workers.
     */
    async stop(): Promise<void> {
        if (!this.started || this.stopping) {
            return;
        }
        this.stopping = true;

        if (this.options.signal !== undefined && this.abortHandler !== undefined) {
            this.options.signal.removeEventListener('abort', this.abortHandler);
        }

        await this.closeTcpProxy();

        // Drain in-flight work on busy/finalizing workers before killing processes
        await this.drainAllWorkers();

        const stopPromises: Promise<void>[] = [];
        for (const worker of this.workers.values()) {
            stopPromises.push(this.stopWorker(worker));
        }
        await Promise.all(stopPromises);
        this.workers.clear();

        this.started = false;
        this.stopping = false;
    }

    /**
     * Registers a typed listener for a DicomReceiver-specific event.
     *
     * @param event - The event name from DicomReceiverEventMap
     * @param listener - Callback receiving typed event data
     * @returns this for chaining
     */
    onEvent<K extends keyof DicomReceiverEventMap>(event: K, listener: (...args: DicomReceiverEventMap[K]) => void): this {
        return this.on(event, listener as never);
    }

    /**
     * Registers a listener for files received by dcmrecv (before move/parse).
     *
     * @param listener - Callback receiving raw file data
     * @returns this for chaining
     */
    onFileReceived(listener: (data: ReceiverFileReceivedData) => void): this {
        return this.on('FILE_RECEIVED', listener);
    }

    /**
     * Registers a listener for files stored in the association directory.
     *
     * @param listener - Callback receiving stored file data with size
     * @returns this for chaining
     */
    onFileStored(listener: (data: ReceiverFileStoredData) => void): this {
        return this.on('FILE_STORED', listener);
    }

    /**
     * Registers a listener for parsed DicomInstance availability.
     *
     * @param listener - Callback receiving instance data
     * @returns this for chaining
     */
    onInstanceReceived(listener: (data: ReceiverInstanceData) => void): this {
        return this.on('INSTANCE_RECEIVED', listener);
    }

    /**
     * Registers a listener for DicomInstance.open failures.
     *
     * @param listener - Callback receiving instance error data
     * @returns this for chaining
     */
    onInstanceError(listener: (data: ReceiverInstanceErrorData) => void): this {
        return this.on('INSTANCE_ERROR', listener);
    }

    /**
     * Registers a listener for completed associations (file moves done).
     *
     * @param listener - Callback receiving association data
     * @returns this for chaining
     */
    onAssociationComplete(listener: (data: ReceiverAssociationData) => void): this {
        return this.on('ASSOCIATION_COMPLETE', listener);
    }

    /**
     * Registers a listener for fully finalized associations (all parsing done).
     *
     * @param listener - Callback receiving finalized data with instance counts
     * @returns this for chaining
     */
    onAssociationFinalized(listener: (data: ReceiverAssociationFinalizedData) => void): this {
        return this.on('ASSOCIATION_FINALIZED', listener);
    }

    /**
     * Registers a listener for new associations (bubbled from workers).
     *
     * @param listener - Callback receiving association received data
     * @returns this for chaining
     */
    onAssociationReceived(listener: (data: PoolAssociationReceivedData) => void): this {
        return this.on('ASSOCIATION_RECEIVED', listener);
    }

    /**
     * Registers a listener for C-STORE requests (bubbled from workers).
     *
     * @param listener - Callback receiving C-STORE request data
     * @returns this for chaining
     */
    onCStoreRequest(listener: (data: PoolCStoreRequestData) => void): this {
        return this.on('C_STORE_REQUEST', listener);
    }

    /**
     * Registers a listener for C-ECHO requests (bubbled from workers).
     *
     * @param listener - Callback receiving echo request data
     * @returns this for chaining
     */
    onEchoRequest(listener: (data: PoolEchoRequestData) => void): this {
        return this.on('ECHO_REQUEST', listener);
    }

    /**
     * Registers a listener for refused associations (bubbled from workers).
     *
     * @param listener - Callback receiving refusing association data
     * @returns this for chaining
     */
    onRefusingAssociation(listener: (data: PoolRefusingAssociationData) => void): this {
        return this.on('REFUSING_ASSOCIATION', listener);
    }

    /**
     * Routes an external socket to an idle worker.
     *
     * The pool must be started via `start()` before calling this method.
     * Use this when managing your own TCP listener (e.g., protocol router).
     *
     * @param socket - An incoming net.Socket to route to a worker
     */
    handleSocket(socket: net.Socket): void {
        if (!this.started) {
            socket.destroy(new Error('DicomReceiver: not started'));
            return;
        }
        void this.handleConnection(socket);
    }

    /** Current pool status. */
    get poolStatus(): PoolStatus {
        let idle = 0;
        let busy = 0;
        for (const w of this.workers.values()) {
            if (w.state === 'idle') idle++;
            else busy++;
        }
        return { idle, busy, total: this.workers.size };
    }

    // -----------------------------------------------------------------------
    // TCP proxy
    // -----------------------------------------------------------------------

    /** Starts the TCP proxy on the configured port. Skips if port is 0. */
    private startTcpProxy(): Promise<Result<void>> {
        if (this.options.port === 0) {
            return Promise.resolve(ok(undefined));
        }
        return new Promise(resolve => {
            this.tcpServer = net.createServer(socket => {
                void this.handleConnection(socket);
            });
            this.tcpServer.on('error', e => {
                if (!this.started) {
                    resolve(err(new Error(`DicomReceiver: TCP proxy failed: ${e.message}`)));
                } else {
                    this.emit('error', { error: e instanceof Error ? e : new Error(String(e)) });
                }
            });
            this.tcpServer.listen(this.options.port, () => {
                resolve(ok(undefined));
            });
        });
    }

    /** Closes the TCP proxy server. */
    private closeTcpProxy(): Promise<void> {
        return new Promise(resolve => {
            if (this.tcpServer === undefined) {
                resolve();
                return;
            }
            this.tcpServer.close(() => resolve());
        });
    }

    /** Drains in-flight file and instance work on all non-idle workers, with a 5s safety timeout. */
    private async drainAllWorkers(): Promise<void> {
        const drainPromises: Promise<void>[] = [];
        for (const worker of this.workers.values()) {
            if (worker.state !== 'idle') {
                drainPromises.push(worker.drainPendingFiles());
                drainPromises.push(worker.drainInstancePending());
            }
        }
        if (drainPromises.length === 0) return;
        await Promise.race([Promise.all(drainPromises), delay(5000)]);
    }

    // -----------------------------------------------------------------------
    // Connection routing
    // -----------------------------------------------------------------------

    /** Routes an incoming connection to an idle worker. */
    private async handleConnection(remoteSocket: net.Socket): Promise<void> {
        remoteSocket.pause();

        const worker = await this.findIdleWorker();
        if (worker === undefined) {
            remoteSocket.destroy(new Error('DicomReceiver: no idle worker available'));
            this.emit('error', { error: new Error('DicomReceiver: connection rejected — pool exhausted') });
            return;
        }

        this.associationCounter++;
        const associationId = `assoc-${String(this.associationCounter)}`;
        const associationDir = path.join(this.options.storageDir, associationId);

        const mkdirResult = await ensureDirectory(associationDir);
        if (!mkdirResult.ok) {
            worker.release();
            remoteSocket.destroy();
            this.emit('error', { error: mkdirResult.error });
            return;
        }

        const ctx: AssociationContext = {
            associationId,
            associationDir,
            startAt: Date.now(),
        };

        worker.beginAssociation(ctx);
        this.pipeConnection(worker, remoteSocket);
        void this.replenishPool().catch((e: unknown) => {
            this.emit('error', { error: e instanceof Error ? e : new Error(String(e)) });
        });
    }

    /** Finds an idle worker, retrying up to connectionTimeoutMs. */
    private async findIdleWorker(): Promise<Worker | undefined> {
        // reserve() is called synchronously on the picked worker, with no await
        // between getIdleWorker() and reserve(), so two concurrent callers can
        // never select the same idle worker (single-threaded event loop).
        const idle = this.getIdleWorker();
        if (idle !== undefined) {
            idle.reserve();
            return idle;
        }

        const maxRetries = Math.min(Math.ceil(this.connectionTimeoutMs / CONNECTION_RETRY_INTERVAL_MS), MAX_CONNECTION_RETRIES);

        for (let i = 0; i < maxRetries; i++) {
            await delay(CONNECTION_RETRY_INTERVAL_MS);
            const found = this.getIdleWorker();
            if (found !== undefined) {
                found.reserve();
                return found;
            }
            if (this.stopping) return undefined;
        }
        return undefined;
    }

    /** Returns the first idle worker, or undefined. */
    private getIdleWorker(): Worker | undefined {
        for (const w of this.workers.values()) {
            if (w.state === 'idle') return w;
        }
        return undefined;
    }

    /** Pipes remote socket bidirectionally to the worker's port. */
    private pipeConnection(worker: Worker, remoteSocket: net.Socket): void {
        const workerSocket = net.createConnection({ port: worker.port, host: '127.0.0.1' });

        worker.setSockets(remoteSocket, workerSocket);

        // Captured per-association so a late cleanup (after the worker is
        // recycled to a new association) can be identified by context identity
        // and ignored.
        const ctx = worker.context;

        const cleanup = (): void => {
            remoteSocket.unpipe(workerSocket);
            workerSocket.unpipe(remoteSocket);
            if (!remoteSocket.destroyed) remoteSocket.destroy();
            if (!workerSocket.destroyed) workerSocket.destroy();
            this.scheduleAbortReap(worker, ctx);
        };

        // Wait for the worker connection to be established before piping.
        // Writing to a socket before 'connect' buffers data in userland;
        // on Windows and some container runtimes this buffered data is
        // silently lost, causing the DICOM association handshake to hang.
        workerSocket.on('connect', () => {
            remoteSocket.pipe(workerSocket);
            workerSocket.pipe(remoteSocket);
            remoteSocket.resume();
        });

        remoteSocket.on('error', cleanup);
        workerSocket.on('error', cleanup);
        remoteSocket.on('close', cleanup);
        workerSocket.on('close', cleanup);

        // The remote may have aborted while handleConnection awaited an idle
        // worker / created the directory — before these handlers were attached.
        // A 'close' that already fired won't fire again, so detect it now and
        // run cleanup explicitly; otherwise the worker would stay busy forever
        // and its directory would leak.
        if (remoteSocket.destroyed) {
            cleanup();
        }
    }

    /**
     * After a connection's sockets tear down, reaps the association as an
     * aborted one *only if* dcmrecv never reported completion within
     * {@link ABORT_REAP_GRACE_MS}. Without this, a peer abort destroys the
     * sockets but dcmrecv may never emit ASSOCIATION_COMPLETE, so the worker
     * stays busy forever, ASSOCIATION_FINALIZED never fires (consumers can't
     * release per-association state), and the association directory is never
     * removed. The grace delay ensures a normal A-RELEASE — whose socket also
     * closes — is finalized by its own completion report and never reaped here.
     */
    private scheduleAbortReap(worker: Worker, ctx: AssociationContext | undefined): void {
        // Skip if this association is already finalizing/idle, was reassigned,
        // or had no context (worker never began an association).
        if (ctx === undefined || worker.context !== ctx || worker.state !== 'busy') return;

        // cleanup() can fire several times per teardown; arm exactly one timer.
        if (!worker.claimReapSchedule()) return;

        const timer = setTimeout(() => {
            // Re-check at fire time: dcmrecv may have reported completion (state
            // no longer 'busy'), or the worker may have been recycled to a new
            // association (different context identity).
            if (worker.context !== ctx || worker.state !== 'busy' || worker.finalized) return;

            worker.markFinalizing();
            // Remove the directory only if no consumer engaged (no
            // ASSOCIATION_RECEIVED); an engaged consumer owns its own cleanup.
            const removeDir = !worker.associationReceived;
            void this.finalizeAssociation(
                worker,
                {
                    associationId: ctx.associationId,
                    callingAE: '',
                    calledAE: '',
                    source: '',
                    files: [],
                    durationMs: Date.now() - ctx.startAt,
                    endReason: 'abort',
                },
                removeDir
            );
        }, ABORT_REAP_GRACE_MS);

        // Don't keep the event loop alive solely for this fallback timer.
        timer.unref();
    }

    // -----------------------------------------------------------------------
    // Worker pool management
    // -----------------------------------------------------------------------

    /** Spawns `count` new workers and adds them to the pool. */
    private async spawnWorkers(count: number): Promise<Result<void>> {
        const promises: Promise<Result<Worker>>[] = [];
        for (let i = 0; i < count; i++) {
            promises.push(this.spawnWorker());
        }
        const results = await Promise.all(promises);
        for (const result of results) {
            if (!result.ok) return err(result.error);
        }
        return ok(undefined);
    }

    /** Creates a Dcmrecv instance with the pool's shared options. */
    private createDcmrecv(port: number, tempDir: string): Result<Dcmrecv> {
        return Dcmrecv.create({
            port,
            aeTitle: this.options.aeTitle,
            outputDirectory: tempDir,
            configFile: this.options.configFile,
            configProfile: this.options.configProfile,
            acseTimeout: this.options.acseTimeout,
            dimseTimeout: this.options.dimseTimeout,
            maxPdu: this.options.maxPdu,
            filenameMode: this.options.filenameMode ?? 'unique',
            filenameExtension: this.options.filenameExtension,
            storageMode: this.options.storageMode,
        });
    }

    /** Spawns a single Dcmrecv worker with an ephemeral port. */
    private async spawnWorker(): Promise<Result<Worker>> {
        const portResult = await allocatePort();
        if (!portResult.ok) return portResult;
        const port = portResult.value;

        const tempDir = path.join(os.tmpdir(), `dcmrecv-pool-${String(port)}-${String(Date.now())}`);
        const mkdirResult = await ensureDirectory(tempDir);
        if (!mkdirResult.ok) return mkdirResult;

        const createResult = this.createDcmrecv(port, tempDir);
        if (!createResult.ok) return createResult;

        const dcmrecv = createResult.value;
        const worker = new Worker(dcmrecv, port, tempDir);

        this.wireWorkerEvents(worker);
        const startResult = await dcmrecv.start();
        if (!startResult.ok) {
            return err(new Error(`DicomReceiver: worker start failed on port ${String(port)}: ${startResult.error.message}`));
        }

        this.workers.set(port, worker);
        return ok(worker);
    }

    /** Stops a single worker: destroy sockets, stop process, clean temp dir, remove from pool. */
    private async stopWorker(worker: Worker): Promise<void> {
        worker.destroySockets();
        await worker.dcmrecv.stop();
        worker.dcmrecv[Symbol.dispose]();
        await removeDirSafe(worker.tempDir);
        this.workers.delete(worker.port);
    }

    /** Pre-emptively spawns workers to keep idle count >= minPoolSize. */
    private async replenishPool(): Promise<void> {
        const status = this.poolStatus;
        const needed = this.minPoolSize - status.idle;
        const capacity = this.maxPoolSize - status.total;
        const toSpawn = Math.min(needed, capacity);

        if (toSpawn <= 0) return;

        const promises: Promise<Result<Worker>>[] = [];
        for (let i = 0; i < toSpawn; i++) {
            promises.push(this.spawnWorker());
        }
        const results = await Promise.all(promises);
        for (const result of results) {
            if (!result.ok) {
                this.emit('error', { error: result.error });
            }
        }
    }

    /** Stops excess idle workers when idle count > minPoolSize + 2. */
    private async scaleDown(): Promise<void> {
        const idleWorkers: Worker[] = [];
        for (const w of this.workers.values()) {
            if (w.state === 'idle') idleWorkers.push(w);
        }
        const excess = idleWorkers.length - (this.minPoolSize + 2);
        if (excess <= 0) return;

        const toStop = idleWorkers.slice(0, excess);
        const promises: Promise<void>[] = [];
        for (const w of toStop) {
            promises.push(this.stopWorker(w));
        }
        await Promise.all(promises);
    }

    // -----------------------------------------------------------------------
    // Worker event wiring
    // -----------------------------------------------------------------------

    /** Wires all events on a worker: file handling, association lifecycle, output capture. */
    private wireWorkerEvents(worker: Worker): void {
        this.wireFileReceived(worker);
        this.wireAssociationComplete(worker);
        this.wireAssociationReceived(worker);
        this.wireCStoreRequest(worker);
        this.wireEchoRequest(worker);
        this.wireRefusingAssociation(worker);
        this.wireOutputCapture(worker);
    }

    /** Wires FILE_RECEIVED from dcmrecv worker — captures context synchronously. */
    private wireFileReceived(worker: Worker): void {
        worker.dcmrecv.onFileReceived(data => {
            const ctx = worker.context;
            if (ctx === undefined) {
                this.emit('error', {
                    error: new Error(`DicomReceiver: FILE_RECEIVED with no active association (worker state: ${worker.state})`),
                    filePath: data.filePath,
                    callingAE: data.callingAE,
                    calledAE: data.calledAE,
                    source: data.source,
                });
                return;
            }

            // FILE_RECEIVED: raw notification from dcmrecv, before any processing
            this.emit('FILE_RECEIVED', {
                filePath: data.filePath,
                associationId: ctx.associationId,
                callingAE: data.callingAE,
                calledAE: data.calledAE,
                source: data.source,
            });

            const promise = this.handleFileReceived(worker, data, ctx);
            worker.trackFile(promise);
        });
    }

    /** Moves file to association dir, emits FILE_STORED, then parses instance. */
    private async handleFileReceived(
        worker: Worker,
        data: { filePath: string; callingAE: string; calledAE: string; source: string },
        ctx: AssociationContext
    ): Promise<void> {
        try {
            await this.moveAndEmitFile(worker, data, ctx);
        } catch (thrown: unknown) {
            const error = thrown instanceof Error ? thrown : new Error(String(thrown));
            this.emit('error', {
                error,
                filePath: data.filePath,
                associationId: ctx.associationId,
                associationDir: ctx.associationDir,
                callingAE: data.callingAE,
                calledAE: data.calledAE,
                source: data.source,
            });
        }
    }

    /** Inner handler: move file, emit FILE_STORED, parse DICOM, emit INSTANCE_RECEIVED. */
    private async moveAndEmitFile(
        worker: Worker,
        data: { filePath: string; callingAE: string; calledAE: string; source: string },
        ctx: AssociationContext
    ): Promise<void> {
        const srcPath = data.filePath;
        const destPath = path.join(ctx.associationDir, path.basename(srcPath));

        const moveResult = await moveFile(srcPath, destPath);
        const finalPath = moveResult.ok ? destPath : srcPath;
        const fileSize = await statFileSafe(finalPath);
        worker.recordFile(finalPath, fileSize);

        // FILE_STORED: file is safely on disk in the association directory
        this.emit('FILE_STORED', {
            filePath: finalPath,
            fileSize,
            associationId: ctx.associationId,
            associationDir: ctx.associationDir,
            callingAE: data.callingAE,
            calledAE: data.calledAE,
            source: data.source,
        });

        if (this.parseInstances) {
            const instanceCtx = {
                filePath: finalPath,
                fileSize,
                associationId: ctx.associationId,
                associationDir: ctx.associationDir,
                callingAE: data.callingAE,
                calledAE: data.calledAE,
                source: data.source,
            };
            worker.trackInstance(this.parseAndEmitInstance(worker, instanceCtx));
        }
    }

    /** Parses a DICOM file and emits INSTANCE_RECEIVED or INSTANCE_ERROR. */
    private async parseAndEmitInstance(worker: Worker, ctx: ReceiverFileStoredData): Promise<void> {
        try {
            const openResult = await DicomInstance.open(ctx.filePath, this.resolvedInstanceOpenOptions);
            if (!openResult.ok) {
                worker.recordInstanceError();
                this.emit('INSTANCE_ERROR', { error: openResult.error, thrown: false, ...ctx });
                return;
            }
            worker.recordInstanceSuccess();
            this.emit('INSTANCE_RECEIVED', { ...ctx, instance: openResult.value });
        } catch (thrown: unknown) {
            const error = thrown instanceof Error ? thrown : new Error(String(thrown));
            worker.recordInstanceError();
            this.emit('INSTANCE_ERROR', { error, thrown: true, ...ctx });
        }
    }

    /** Returns worker to idle pool on association complete, emits summary. */
    private wireAssociationComplete(worker: Worker): void {
        worker.dcmrecv.onAssociationComplete((data: AssociationCompleteData) => {
            // If the abort reaper already finalized this association (socket
            // torn down with no completion report), don't re-finalize — that
            // would mark an idle/reassigned worker as finalizing and leak it.
            if (worker.finalized) return;

            // Mark worker as finalizing SYNCHRONOUSLY — prevents findIdleWorker
            // from routing new connections to this worker during drain. (#25)
            worker.markFinalizing();

            // Defer the actual drain to the check phase (after I/O callbacks) so
            // any remaining FILE_RECEIVED events in pending pipe chunks are processed
            // before ASSOCIATION_FINALIZED fires. (#25)
            //
            // removeDir only when no consumer ever engaged (no ASSOCIATION_RECEIVED) —
            // e.g. a connection that aborted during negotiation. Those directories
            // have no consumer to clean them; an engaged association's directory
            // is owned by the consumer (which may still be processing files).
            const removeDir = !worker.associationReceived;
            setImmediate(() => {
                void this.finalizeAssociation(worker, data, removeDir);
            });
        });
    }

    /**
     * Awaits file ops, emits ASSOCIATION_COMPLETE, awaits parsing, emits
     * ASSOCIATION_FINALIZED, returns the worker to idle. Runs at most once per
     * association via {@link Worker.beginFinalizeOnce}.
     *
     * @param removeDir - When true, removes the association directory after
     *   finalizing. Set when no consumer ever engaged with the association
     *   (no ASSOCIATION_RECEIVED was emitted) — e.g. a connection that aborted
     *   during negotiation — so the pool reclaims the directory it created.
     *   When a consumer did engage this stays false: the consumer owns
     *   directory cleanup once it has processed the received files (removing it
     *   here could race in-flight consumer reads of those files).
     */
    private async finalizeAssociation(worker: Worker, data: AssociationCompleteData, removeDir = false): Promise<void> {
        if (!worker.beginFinalizeOnce()) return;

        await worker.drainPendingFiles();
        this.emitAssociationComplete(worker, data);

        await worker.drainInstancePending();
        this.emitAssociationFinalized(worker, data);

        const associationDir = worker.context?.associationDir;
        worker.endAssociation();
        if (removeDir && associationDir !== undefined) {
            await removeDirSafe(associationDir);
        }
        void this.scaleDown();
    }

    /** Emits the ASSOCIATION_COMPLETE event with transfer stats. */
    private emitAssociationComplete(worker: Worker, data: AssociationCompleteData): void {
        const ctx = worker.context;
        const assocId = ctx?.associationId ?? data.associationId;
        const assocDir = ctx?.associationDir ?? '';
        const startAt = ctx?.startAt ?? Date.now();
        const files = [...worker.files];
        const output = [...worker.outputLines];

        const endAt = Date.now();
        const totalBytes = sumArray(worker.fileSizes);
        const elapsedMs = endAt - startAt;
        const bytesPerSecond = elapsedMs > 0 ? Math.round((totalBytes / elapsedMs) * 1000) : 0;

        this.emit('ASSOCIATION_COMPLETE', {
            associationId: assocId,
            associationDir: assocDir,
            callingAE: data.callingAE,
            calledAE: data.calledAE,
            source: data.source,
            files,
            durationMs: data.durationMs,
            endReason: data.endReason,
            totalBytes,
            bytesPerSecond,
            startAt,
            endAt,
            output,
        });
    }

    /** Emits ASSOCIATION_FINALIZED after all instance parsing is done. */
    private emitAssociationFinalized(worker: Worker, data: AssociationCompleteData): void {
        const ctx = worker.context;
        this.emit('ASSOCIATION_FINALIZED', {
            associationId: ctx?.associationId ?? data.associationId,
            associationDir: ctx?.associationDir ?? '',
            callingAE: data.callingAE,
            calledAE: data.calledAE,
            source: data.source,
            files: [...worker.files],
            instancesReceived: worker.instancesReceived,
            instanceErrors: worker.instanceErrors,
            endReason: data.endReason,
        });
    }

    /** Bubbles ASSOCIATION_RECEIVED from dcmrecv worker. */
    private wireAssociationReceived(worker: Worker): void {
        worker.dcmrecv.onEvent('ASSOCIATION_RECEIVED', (data: { callingAE: string; calledAE: string; source: string }) => {
            // Suppress a late/duplicate ASSOCIATION_RECEIVED that dcmrecv's
            // stdout can deliver after the worker already finalized its
            // association. Bubbling it would make a consumer register an
            // association that never receives a matching ASSOCIATION_FINALIZED
            // (the worker is done), stranding it until any consumer-side reaper
            // fires. `finalized` is reset by beginAssociation before a genuinely
            // new association's RECEIVED arrives, so only strays are filtered.
            if (worker.finalized) return;

            // Record the hand-off so cleanup knows a consumer engaged with this
            // association (and therefore owns its directory cleanup).
            worker.markAssociationReceived();
            this.emit('ASSOCIATION_RECEIVED', {
                associationId: worker.context?.associationId ?? '',
                callingAE: data.callingAE,
                calledAE: data.calledAE,
                source: data.source,
            });
        });
    }

    /** Bubbles C_STORE_REQUEST from dcmrecv worker. */
    private wireCStoreRequest(worker: Worker): void {
        worker.dcmrecv.onEvent('C_STORE_REQUEST', (data: { raw: string }) => {
            this.emit('C_STORE_REQUEST', {
                associationId: worker.context?.associationId ?? '',
                raw: data.raw,
            });
        });
    }

    /** Bubbles ECHO_REQUEST from dcmrecv worker. */
    private wireEchoRequest(worker: Worker): void {
        worker.dcmrecv.onEvent('ECHO_REQUEST', () => {
            this.emit('ECHO_REQUEST', {
                associationId: worker.context?.associationId ?? '',
            });
        });
    }

    /** Bubbles REFUSING_ASSOCIATION from dcmrecv worker. */
    private wireRefusingAssociation(worker: Worker): void {
        worker.dcmrecv.onEvent('REFUSING_ASSOCIATION', (data: { reason: string }) => {
            this.emit('REFUSING_ASSOCIATION', {
                reason: data.reason,
            });
        });
    }

    /** Captures worker output lines during busy associations. */
    private wireOutputCapture(worker: Worker): void {
        worker.dcmrecv.on('line', ({ text }: { text: string }) => {
            if (worker.state === 'busy') {
                worker.captureOutput(text);
            }
        });
    }

    // -----------------------------------------------------------------------
    // Abort signal
    // -----------------------------------------------------------------------

    /** Wires an AbortSignal to stop the receiver. */
    private wireAbortSignal(signal: AbortSignal): void {
        /* v8 ignore next 4 */
        if (signal.aborted) {
            void this.stop();
            return;
        }
        this.abortHandler = (): void => {
            void this.stop();
        };
        signal.addEventListener('abort', this.abortHandler, { once: true });
    }
}

/** @deprecated Use ReceiverFileStoredData instead. */
type ReceiverFileData = ReceiverFileStoredData;

export { DicomReceiver };
export type {
    DicomReceiverOptions,
    DicomReceiverEventMap,
    ReceiverFileReceivedData,
    ReceiverFileStoredData,
    ReceiverInstanceData,
    ReceiverInstanceErrorData,
    ReceiverAssociationFinalizedData,
    ReceiverFileData,
    ReceiverAssociationData,
    ReceiverErrorData,
    PoolStatus,
    PoolAssociationReceivedData,
    PoolCStoreRequestData,
    PoolEchoRequestData,
    PoolRefusingAssociationData,
};
