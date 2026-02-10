/**
 * DICOM Viewer Network Receiver wrapping the dcmpsrcv binary.
 *
 * Provides a type-safe, event-driven API for the DICOMscope network
 * receiver component. Accepts incoming DICOM associations for storage
 * and C-ECHO verification.
 *
 * @module servers/Dcmpsrcv
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { DcmtkProcess } from '../DcmtkProcess';
import type { DcmtkProcessConfig } from '../DcmtkProcess';
import { LineParser } from '../parsers/LineParser';
import { resolveBinary } from '../tools/_resolveBinary';
import { DCMPSRCV_PATTERNS, DCMPSRCV_FATAL_EVENTS } from '../events/dcmpsrcv';
import type {
    ReceiverListeningData,
    ReceiverDatabaseReadyData,
    ReceiverAssociationReceivedData,
    ReceiverAssociationAcknowledgedData,
    ReceiverEchoRequestData,
    ReceiverCStoreRequestData,
    FileDeletedData,
    ReceiverCannotStartListenerData,
    ReceiverConfigErrorData,
} from '../events/dcmpsrcv';

// ---------------------------------------------------------------------------
// Event map type
// ---------------------------------------------------------------------------

/** Typed event map for the Dcmpsrcv server. */
interface DcmpsrcvEventMap {
    LISTENING: [ReceiverListeningData];
    DATABASE_READY: [ReceiverDatabaseReadyData];
    ASSOCIATION_RECEIVED: [ReceiverAssociationReceivedData];
    ASSOCIATION_ACKNOWLEDGED: [ReceiverAssociationAcknowledgedData];
    ECHO_REQUEST: [ReceiverEchoRequestData];
    C_STORE_REQUEST: [ReceiverCStoreRequestData];
    FILE_DELETED: [FileDeletedData];
    ASSOCIATION_RELEASE: [];
    ASSOCIATION_ABORTED: [];
    CANNOT_START_LISTENER: [ReceiverCannotStartListenerData];
    CONFIG_ERROR: [ReceiverConfigErrorData];
    TERMINATING: [];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a Dcmpsrcv server instance. */
interface DcmpsrcvOptions {
    /** Path to the dcmpstat configuration file (required). */
    readonly configFile: string;
    /** Receiver identifier from the config file (optional, defaults to first receiver). */
    readonly receiverId?: string | undefined;
    /** Log level override. */
    readonly logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | undefined;
    /** Path to a log configuration file. */
    readonly logConfig?: string | undefined;
    /** Timeout for start() to resolve, in milliseconds. */
    readonly startTimeoutMs?: number | undefined;
    /** Timeout for graceful drain during stop(), in milliseconds. */
    readonly drainTimeoutMs?: number | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

const DcmpsrcvOptionsSchema = z
    .object({
        configFile: z.string().min(1),
        receiverId: z.string().min(1).optional(),
        logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
        logConfig: z.string().min(1).optional(),
        startTimeoutMs: z.number().int().positive().optional(),
        drainTimeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict();

// ---------------------------------------------------------------------------
// Argument builder
// ---------------------------------------------------------------------------

/** Builds the CLI arguments array from validated options. */
function buildArgs(options: DcmpsrcvOptions): string[] {
    const args: string[] = ['--verbose'];

    if (options.logLevel !== undefined) {
        args.push('--log-level', options.logLevel);
    }
    if (options.logConfig !== undefined) {
        args.push('--log-config', options.logConfig);
    }

    args.push(options.configFile);

    if (options.receiverId !== undefined) {
        args.push(options.receiverId);
    }

    return args;
}

// ---------------------------------------------------------------------------
// Dcmpsrcv class
// ---------------------------------------------------------------------------

/**
 * DICOM Viewer Network Receiver wrapping the dcmpsrcv binary.
 *
 * Uses a static `create()` factory because binary resolution is fallible
 * and must complete before the constructor runs.
 *
 * The `start()` method resolves when the LISTENING event is detected
 * (i.e., "Receiver <id> on port <port>").
 *
 * @example
 * ```ts
 * const result = Dcmpsrcv.create({ configFile: '/etc/dcmpstat.cfg', receiverId: 'RECEIVE_1' });
 * if (result.ok) {
 *     const server = result.value;
 *     server.onEvent('LISTENING', (data) => console.log(`Listening on port ${data.port}`));
 *     const startResult = await server.start();
 * }
 * ```
 */
class Dcmpsrcv extends DcmtkProcess {
    private readonly parser: LineParser;

    private constructor(config: DcmtkProcessConfig, parser: LineParser, signal?: AbortSignal) {
        super(config);
        this.parser = parser;
        this.wireParser();
        if (signal !== undefined) {
            this.wireAbortSignal(signal);
        }
    }

    /**
     * Registers a typed listener for a dcmpsrcv-specific event.
     *
     * @param event - The event name from DcmpsrcvEventMap
     * @param listener - Callback receiving typed event data
     * @returns this for chaining
     */
    onEvent<K extends keyof DcmpsrcvEventMap>(event: K, listener: (...args: DcmpsrcvEventMap[K]) => void): this {
        return this.on(event as string, listener as never);
    }

    /**
     * Creates a new Dcmpsrcv server instance.
     *
     * @param options - Configuration options for the dcmpsrcv server
     * @returns A Result containing the server instance or a validation/resolution error
     */
    static create(options: DcmpsrcvOptions): Result<Dcmpsrcv> {
        const validation = DcmpsrcvOptionsSchema.safeParse(options);
        if (!validation.success) {
            return err(new Error(`dcmpsrcv: invalid options: ${validation.error.message}`));
        }

        const binaryResult = resolveBinary('dcmpsrcv');
        if (!binaryResult.ok) {
            return err(binaryResult.error);
        }

        const args = buildArgs(options);
        const parser = new LineParser();
        for (const pattern of DCMPSRCV_PATTERNS) {
            parser.addPattern(pattern);
        }

        const config: DcmtkProcessConfig = {
            binary: binaryResult.value,
            args,
            startTimeoutMs: options.startTimeoutMs,
            drainTimeoutMs: options.drainTimeoutMs,
            isStartedPredicate: line => /Receiver\s+\S+\s+on port/i.test(line),
        };

        return ok(new Dcmpsrcv(config, parser, options.signal));
    }

    /** Wires the line parser to the process output. */
    private wireParser(): void {
        this.on('line', ({ text }) => {
            this.parser.feed(text);
        });

        this.parser.on('match', ({ event, data }) => {
            if (DCMPSRCV_FATAL_EVENTS.has(event)) {
                this.emit('error', { error: new Error(`Fatal: ${event}`), fatal: true });
            }
            this.emit(event, ...([data] as never));
        });
    }

    /** Wires an AbortSignal to stop the server. */
    private wireAbortSignal(signal: AbortSignal): void {
        if (signal.aborted) {
            void this.stop();
            return;
        }
        signal.addEventListener(
            'abort',
            () => {
                void this.stop();
            },
            { once: true }
        );
    }
}

export { Dcmpsrcv };
export type { DcmpsrcvOptions, DcmpsrcvEventMap };
