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
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { isSafePath, isValidAETitle } from '../patterns';
import { createValidationError } from '../tools/_toolError';
import { Dcmrecv } from './Dcmrecv';
import type { AssociationCompleteData } from '../events/dcmrecv';
import { DicomInstance } from '../dicom/DicomInstance';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MIN_POOL_SIZE = 2;
const DEFAULT_MAX_POOL_SIZE = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const CONNECTION_RETRY_INTERVAL_MS = 500;
const MAX_CONNECTION_RETRIES = 200;
const MAX_OUTPUT_LINES_PER_ASSOCIATION = 500;

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

/** Data emitted with FILE_RECEIVED events. */
interface ReceiverFileData {
    readonly filePath: string;
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
    FILE_RECEIVED: [ReceiverFileData];
    ASSOCIATION_COMPLETE: [ReceiverAssociationData];
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
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict()
    .refine(data => (data.minPoolSize ?? DEFAULT_MIN_POOL_SIZE) <= (data.maxPoolSize ?? DEFAULT_MAX_POOL_SIZE), {
        message: 'minPoolSize must be <= maxPoolSize',
    });

// ---------------------------------------------------------------------------
// Internal worker type
// ---------------------------------------------------------------------------

interface WorkerInfo {
    readonly dcmrecv: Dcmrecv;
    readonly port: number;
    readonly tempDir: string;
    state: 'idle' | 'busy';
    associationId: string | undefined;
    associationDir: string | undefined;
    /** Files moved to the association dir during the current association. */
    files: string[];
    /** Byte sizes parallel to files[], for transfer stats. */
    fileSizes: number[];
    /** Captured output lines during the current association. */
    outputLines: string[];
    /** Timestamp when the TCP connection was routed to this worker. */
    startAt: number | undefined;
    remoteSocket: net.Socket | undefined;
    workerSocket: net.Socket | undefined;
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
    private readonly workers: Map<number, WorkerInfo> = new Map();
    private tcpServer: net.Server | undefined;
    private associationCounter = 0;
    private started = false;
    private stopping = false;
    private abortHandler: (() => void) | undefined;

    private constructor(options: DicomReceiverOptions) {
        super();
        this.setMaxListeners(20);
        this.on('error', () => {
            /* prevent Node.js uncaught exception on unhandled 'error' */
        });
        this.options = options;
        this.minPoolSize = options.minPoolSize ?? DEFAULT_MIN_POOL_SIZE;
        this.maxPoolSize = options.maxPoolSize ?? DEFAULT_MAX_POOL_SIZE;
        this.connectionTimeoutMs = options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
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
     * Registers a listener for received files.
     *
     * @param listener - Callback receiving file data
     * @returns this for chaining
     */
    onFileReceived(listener: (data: ReceiverFileData) => void): this {
        return this.on('FILE_RECEIVED', listener);
    }

    /**
     * Registers a listener for completed associations.
     *
     * @param listener - Callback receiving association data
     * @returns this for chaining
     */
    onAssociationComplete(listener: (data: ReceiverAssociationData) => void): this {
        return this.on('ASSOCIATION_COMPLETE', listener);
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
            remoteSocket.destroy();
            this.emit('error', { error: mkdirResult.error });
            return;
        }

        worker.state = 'busy';
        worker.associationId = associationId;
        worker.associationDir = associationDir;
        worker.files = [];
        worker.fileSizes = [];
        worker.outputLines = [];
        worker.startAt = Date.now();

        this.pipeConnection(worker, remoteSocket);
        void this.replenishPool();
    }

    /** Finds an idle worker, retrying up to connectionTimeoutMs. */
    private async findIdleWorker(): Promise<WorkerInfo | undefined> {
        const idle = this.getIdleWorker();
        if (idle !== undefined) return idle;

        const maxRetries = Math.min(Math.ceil(this.connectionTimeoutMs / CONNECTION_RETRY_INTERVAL_MS), MAX_CONNECTION_RETRIES);

        for (let i = 0; i < maxRetries; i++) {
            await delay(CONNECTION_RETRY_INTERVAL_MS);
            const found = this.getIdleWorker();
            if (found !== undefined) return found;
            if (this.stopping) return undefined;
        }
        return undefined;
    }

    /** Returns the first idle worker, or undefined. */
    private getIdleWorker(): WorkerInfo | undefined {
        for (const w of this.workers.values()) {
            if (w.state === 'idle') return w;
        }
        return undefined;
    }

    /** Pipes remote socket bidirectionally to the worker's port. */
    private pipeConnection(worker: WorkerInfo, remoteSocket: net.Socket): void {
        const workerSocket = net.createConnection({ port: worker.port, host: '127.0.0.1' });

        worker.remoteSocket = remoteSocket;
        worker.workerSocket = workerSocket;

        remoteSocket.pipe(workerSocket);
        workerSocket.pipe(remoteSocket);

        remoteSocket.resume();

        const cleanup = (): void => {
            remoteSocket.unpipe(workerSocket);
            workerSocket.unpipe(remoteSocket);
            if (!remoteSocket.destroyed) remoteSocket.destroy();
            if (!workerSocket.destroyed) workerSocket.destroy();
        };

        remoteSocket.on('error', cleanup);
        workerSocket.on('error', cleanup);
        remoteSocket.on('close', cleanup);
        workerSocket.on('close', cleanup);
    }

    // -----------------------------------------------------------------------
    // Worker pool management
    // -----------------------------------------------------------------------

    /** Spawns `count` new workers and adds them to the pool. */
    private async spawnWorkers(count: number): Promise<Result<void>> {
        const promises: Promise<Result<WorkerInfo>>[] = [];
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
            aeTitle: this.options.aeTitle ?? 'DCMRECV',
            outputDirectory: tempDir,
            configFile: this.options.configFile,
            configProfile: this.options.configProfile,
            acseTimeout: this.options.acseTimeout,
            dimseTimeout: this.options.dimseTimeout,
            maxPdu: this.options.maxPdu,
        });
    }

    /** Spawns a single Dcmrecv worker with an ephemeral port. */
    private async spawnWorker(): Promise<Result<WorkerInfo>> {
        const portResult = await allocatePort();
        if (!portResult.ok) return portResult;
        const port = portResult.value;

        const tempDir = path.join(os.tmpdir(), `dcmrecv-pool-${String(port)}-${String(Date.now())}`);
        const mkdirResult = await ensureDirectory(tempDir);
        if (!mkdirResult.ok) return mkdirResult;

        const createResult = this.createDcmrecv(port, tempDir);
        if (!createResult.ok) return createResult;

        const dcmrecv = createResult.value;
        const worker: WorkerInfo = {
            dcmrecv,
            port,
            tempDir,
            state: 'idle',
            associationId: undefined,
            associationDir: undefined,
            files: [],
            fileSizes: [],
            outputLines: [],
            startAt: undefined,
            remoteSocket: undefined,
            workerSocket: undefined,
        };

        this.wireWorkerEvents(worker);
        const startResult = await dcmrecv.start();
        if (!startResult.ok) {
            return err(new Error(`DicomReceiver: worker start failed on port ${String(port)}: ${startResult.error.message}`));
        }

        this.workers.set(port, worker);
        return ok(worker);
    }

    /** Stops a single worker: stop process, clean temp dir, remove from pool. */
    private async stopWorker(worker: WorkerInfo): Promise<void> {
        if (worker.remoteSocket !== undefined && !worker.remoteSocket.destroyed) {
            worker.remoteSocket.destroy();
        }
        if (worker.workerSocket !== undefined && !worker.workerSocket.destroyed) {
            worker.workerSocket.destroy();
        }
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

        const promises: Promise<Result<WorkerInfo>>[] = [];
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
        const idleWorkers: WorkerInfo[] = [];
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
    private wireWorkerEvents(worker: WorkerInfo): void {
        this.wireFileReceived(worker);
        this.wireAssociationComplete(worker);
        this.wireAssociationReceived(worker);
        this.wireCStoreRequest(worker);
        this.wireEchoRequest(worker);
        this.wireRefusingAssociation(worker);
        this.wireOutputCapture(worker);
    }

    /** Wires FILE_RECEIVED from dcmrecv worker to handleFileReceived. */
    private wireFileReceived(worker: WorkerInfo): void {
        worker.dcmrecv.onFileReceived(data => {
            void this.handleFileReceived(worker, data);
        });
    }

    /** Moves a received file, opens it as DicomInstance, and emits FILE_RECEIVED. */
    private async handleFileReceived(worker: WorkerInfo, data: { filePath: string; callingAE: string; calledAE: string; source: string }): Promise<void> {
        if (worker.associationDir === undefined || worker.associationId === undefined) return;
        const srcPath = data.filePath;
        const destPath = path.join(worker.associationDir, path.basename(srcPath));
        const assocId = worker.associationId;
        const assocDir = worker.associationDir;

        const moveResult = await moveFile(srcPath, destPath);
        const finalPath = moveResult.ok ? destPath : srcPath;
        worker.files.push(finalPath);
        worker.fileSizes.push(await statFileSafe(finalPath));

        const openResult = await DicomInstance.open(finalPath);
        if (!openResult.ok) {
            this.emit('error', {
                error: openResult.error,
                filePath: finalPath,
                associationId: assocId,
                associationDir: assocDir,
                callingAE: data.callingAE,
                calledAE: data.calledAE,
                source: data.source,
            });
            return;
        }

        this.emit('FILE_RECEIVED', {
            filePath: finalPath,
            associationId: assocId,
            associationDir: assocDir,
            callingAE: data.callingAE,
            calledAE: data.calledAE,
            source: data.source,
            instance: openResult.value,
        });
    }

    /** Returns worker to idle pool on association complete, emits summary. */
    private wireAssociationComplete(worker: WorkerInfo): void {
        worker.dcmrecv.onAssociationComplete((data: AssociationCompleteData) => {
            const assocId = worker.associationId ?? data.associationId;
            const assocDir = worker.associationDir ?? '';
            const files = [...worker.files];
            const output = [...worker.outputLines];

            const endAt = Date.now();
            const startAt = worker.startAt ?? endAt;
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

            worker.state = 'idle';
            worker.associationId = undefined;
            worker.associationDir = undefined;
            worker.files = [];
            worker.fileSizes = [];
            worker.outputLines = [];
            worker.startAt = undefined;
            worker.remoteSocket = undefined;
            worker.workerSocket = undefined;

            void this.scaleDown();
        });
    }

    /** Bubbles ASSOCIATION_RECEIVED from dcmrecv worker. */
    private wireAssociationReceived(worker: WorkerInfo): void {
        worker.dcmrecv.onEvent('ASSOCIATION_RECEIVED', (data: { callingAE: string; calledAE: string; source: string }) => {
            this.emit('ASSOCIATION_RECEIVED', {
                associationId: worker.associationId ?? '',
                callingAE: data.callingAE,
                calledAE: data.calledAE,
                source: data.source,
            });
        });
    }

    /** Bubbles C_STORE_REQUEST from dcmrecv worker. */
    private wireCStoreRequest(worker: WorkerInfo): void {
        worker.dcmrecv.onEvent('C_STORE_REQUEST', (data: { raw: string }) => {
            this.emit('C_STORE_REQUEST', {
                associationId: worker.associationId ?? '',
                raw: data.raw,
            });
        });
    }

    /** Bubbles ECHO_REQUEST from dcmrecv worker. */
    private wireEchoRequest(worker: WorkerInfo): void {
        worker.dcmrecv.onEvent('ECHO_REQUEST', () => {
            this.emit('ECHO_REQUEST', {
                associationId: worker.associationId ?? '',
            });
        });
    }

    /** Bubbles REFUSING_ASSOCIATION from dcmrecv worker. */
    private wireRefusingAssociation(worker: WorkerInfo): void {
        worker.dcmrecv.onEvent('REFUSING_ASSOCIATION', (data: { reason: string }) => {
            this.emit('REFUSING_ASSOCIATION', {
                reason: data.reason,
            });
        });
    }

    /** Captures worker output lines during busy associations. */
    private wireOutputCapture(worker: WorkerInfo): void {
        worker.dcmrecv.on('line', ({ text }: { text: string }) => {
            if (worker.state === 'busy' && worker.outputLines.length < MAX_OUTPUT_LINES_PER_ASSOCIATION) {
                worker.outputLines.push(text);
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

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

/** Ensures a directory exists, creating it recursively if needed. */
async function ensureDirectory(dirPath: string): Promise<Result<void>> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        return ok(undefined);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return err(new Error(`Failed to create directory ${dirPath}: ${msg}`));
    }
}

/** Moves a file from src to dest, falling back to copy+delete on cross-device. */
async function moveFile(src: string, dest: string): Promise<Result<void>> {
    try {
        await fs.rename(src, dest);
        return ok(undefined);
    } catch {
        try {
            await fs.copyFile(src, dest);
            await fs.unlink(src);
            return ok(undefined);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return err(new Error(`Failed to move file ${src} → ${dest}: ${msg}`));
        }
    }
}

/** Returns the file size in bytes, or 0 on error. */
async function statFileSafe(filePath: string): Promise<number> {
    try {
        const stat = await fs.stat(filePath);
        return stat.size;
    } catch {
        /* v8 ignore next */
        return 0;
    }
}

/** Sums an array of numbers iteratively. */
function sumArray(arr: readonly number[]): number {
    let total = 0;
    for (let i = 0; i < arr.length; i++) {
        total += arr[i] ?? 0;
    }
    return total;
}

/** Removes a directory recursively, ignoring errors. */
async function removeDirSafe(dirPath: string): Promise<void> {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
    } catch {
        /* best-effort cleanup */
    }
}

/** Promise-based delay. */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export { DicomReceiver };
export type {
    DicomReceiverOptions,
    DicomReceiverEventMap,
    ReceiverFileData,
    ReceiverAssociationData,
    ReceiverErrorData,
    PoolStatus,
    PoolAssociationReceivedData,
    PoolCStoreRequestData,
    PoolEchoRequestData,
    PoolRefusingAssociationData,
};
