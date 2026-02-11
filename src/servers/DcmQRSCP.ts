/**
 * DICOM Query/Retrieve SCP server wrapping the dcmqrscp binary.
 *
 * Provides a type-safe, event-driven API for the Q/R SCP that supports
 * C-FIND, C-MOVE, C-GET, and C-STORE operations. Uses a static factory
 * pattern because binary resolution and validation must happen before
 * the constructor call.
 *
 * @module servers/DcmQRSCP
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { DcmtkProcess } from '../DcmtkProcess';
import type { DcmtkProcessConfig } from '../DcmtkProcess';
import { LineParser } from '../parsers/LineParser';
import { resolveBinary } from '../tools/_resolveBinary';
import { isSafePath } from '../patterns';
import { DCMQRSCP_PATTERNS, DCMQRSCP_FATAL_EVENTS } from '../events/dcmqrscp';
import type {
    QRListeningData,
    QRAssociationReceivedData,
    QRAssociationAcknowledgedData,
    QRCFindRequestData,
    QRCMoveRequestData,
    QRCGetRequestData,
    QRCStoreRequestData,
    QRCannotStartListenerData,
} from '../events/dcmqrscp';

// ---------------------------------------------------------------------------
// Event map type
// ---------------------------------------------------------------------------

/** Typed event map for the DcmQRSCP server. */
interface DcmQRSCPEventMap {
    LISTENING: [QRListeningData];
    ASSOCIATION_RECEIVED: [QRAssociationReceivedData];
    ASSOCIATION_ACKNOWLEDGED: [QRAssociationAcknowledgedData];
    C_FIND_REQUEST: [QRCFindRequestData];
    C_MOVE_REQUEST: [QRCMoveRequestData];
    C_GET_REQUEST: [QRCGetRequestData];
    C_STORE_REQUEST: [QRCStoreRequestData];
    ASSOCIATION_RELEASE: [];
    ASSOCIATION_ABORTED: [];
    CANNOT_START_LISTENER: [QRCannotStartListenerData];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a DcmQRSCP server instance. */
interface DcmQRSCPOptions {
    /** Path to the dcmqrscp configuration file (required). */
    readonly configFile: string;
    /** Override port from config (positional arg). */
    readonly port?: number | undefined;
    /** Single-process mode (-s flag, recommended on Windows). */
    readonly singleProcess?: boolean | undefined;
    /** Check Find responses (-XF). */
    readonly checkFind?: boolean | undefined;
    /** Check Move responses (-XM). */
    readonly checkMove?: boolean | undefined;
    /** Disable C-GET support (--disable-get). */
    readonly disableGet?: boolean | undefined;
    /** Maximum PDU receive size. */
    readonly maxPdu?: number | undefined;
    /** ACSE timeout in seconds (passed to DCMTK as-is). */
    readonly acseTimeout?: number | undefined;
    /** DIMSE timeout in seconds (passed to DCMTK as-is). */
    readonly dimseTimeout?: number | undefined;
    /** Enable verbose mode (default true for event detection). */
    readonly verbose?: boolean | undefined;
    /** Timeout for start() to resolve (milliseconds). */
    readonly startTimeoutMs?: number | undefined;
    /** Timeout for graceful drain during stop() (milliseconds). */
    readonly drainTimeoutMs?: number | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

const DcmQRSCPOptionsSchema = z
    .object({
        configFile: z.string().min(1).refine(isSafePath, { message: 'path traversal detected in configFile' }),
        port: z.number().int().min(1).max(65535).optional(),
        singleProcess: z.boolean().optional(),
        checkFind: z.boolean().optional(),
        checkMove: z.boolean().optional(),
        disableGet: z.boolean().optional(),
        maxPdu: z.number().int().min(4096).max(131072).optional(),
        acseTimeout: z.number().int().positive().optional(),
        dimseTimeout: z.number().int().positive().optional(),
        verbose: z.boolean().optional(),
        startTimeoutMs: z.number().int().positive().optional(),
        drainTimeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict();

// ---------------------------------------------------------------------------
// Argument builder
// ---------------------------------------------------------------------------

/** Builds the CLI arguments array from validated options. */
function buildArgs(options: DcmQRSCPOptions): string[] {
    const args: string[] = [];

    if (options.verbose !== false) {
        args.push('--verbose');
    }

    args.push('--config', options.configFile);

    if (options.singleProcess === true) {
        args.push('-s');
    }
    if (options.checkFind === true) {
        args.push('-XF');
    }
    if (options.checkMove === true) {
        args.push('-XM');
    }
    if (options.disableGet === true) {
        args.push('--disable-get');
    }

    buildNetworkArgs(args, options);

    if (options.port !== undefined) {
        args.push(String(options.port));
    }

    return args;
}

/** Appends network-related CLI flags. */
function buildNetworkArgs(args: string[], options: DcmQRSCPOptions): void {
    if (options.maxPdu !== undefined) {
        args.push('--max-pdu', String(options.maxPdu));
    }
    if (options.acseTimeout !== undefined) {
        args.push('--acse-timeout', String(options.acseTimeout));
    }
    if (options.dimseTimeout !== undefined) {
        args.push('--dimse-timeout', String(options.dimseTimeout));
    }
}

// ---------------------------------------------------------------------------
// DcmQRSCP class
// ---------------------------------------------------------------------------

/**
 * DICOM Query/Retrieve SCP server wrapping the dcmqrscp binary.
 *
 * Uses a static `create()` factory because binary resolution is fallible
 * and must complete before the constructor runs.
 *
 * @example
 * ```ts
 * const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg', port: 11112 });
 * if (result.ok) {
 *     const server = result.value;
 *     server.onEvent('C_FIND_REQUEST', (data) => console.log('Find:', data.raw));
 *     const startResult = await server.start();
 * }
 * ```
 */
class DcmQRSCP extends DcmtkProcess {
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
     * Registers a typed listener for a dcmqrscp-specific event.
     *
     * @param event - The event name from DcmQRSCPEventMap
     * @param listener - Callback receiving typed event data
     * @returns this for chaining
     */
    onEvent<K extends keyof DcmQRSCPEventMap>(event: K, listener: (...args: DcmQRSCPEventMap[K]) => void): this {
        return this.on(event as string, listener as never);
    }

    /**
     * Registers a listener for incoming C-FIND requests.
     *
     * @param listener - Callback receiving C-FIND request data
     * @returns this for chaining
     */
    onCFindRequest(listener: (...args: DcmQRSCPEventMap['C_FIND_REQUEST']) => void): this {
        return this.onEvent('C_FIND_REQUEST', listener);
    }

    /**
     * Registers a listener for incoming C-MOVE requests.
     *
     * @param listener - Callback receiving C-MOVE request data
     * @returns this for chaining
     */
    onCMoveRequest(listener: (...args: DcmQRSCPEventMap['C_MOVE_REQUEST']) => void): this {
        return this.onEvent('C_MOVE_REQUEST', listener);
    }

    /**
     * Creates a new DcmQRSCP server instance.
     *
     * @param options - Configuration options for the dcmqrscp server
     * @returns A Result containing the server instance or a validation/resolution error
     */
    static create(options: DcmQRSCPOptions): Result<DcmQRSCP> {
        const validation = DcmQRSCPOptionsSchema.safeParse(options);
        if (!validation.success) {
            return err(new Error(`dcmqrscp: invalid options: ${validation.error.message}`));
        }

        const binaryResult = resolveBinary('dcmqrscp');
        if (!binaryResult.ok) {
            return err(binaryResult.error);
        }

        const args = buildArgs(options);
        const parser = new LineParser();
        for (const pattern of DCMQRSCP_PATTERNS) {
            const addResult = parser.addPattern(pattern);
            if (!addResult.ok) {
                return err(addResult.error);
            }
        }

        const config: DcmtkProcessConfig = {
            binary: binaryResult.value,
            args,
            startTimeoutMs: options.startTimeoutMs,
            drainTimeoutMs: options.drainTimeoutMs,
            isStartedPredicate: line => /listening on port/i.test(line),
        };

        return ok(new DcmQRSCP(config, parser, options.signal));
    }

    /** Wires the line parser to the process output. */
    private wireParser(): void {
        this.on('line', ({ text }) => {
            this.parser.feed(text);
        });

        this.parser.on('match', ({ event, data }) => {
            if (DCMQRSCP_FATAL_EVENTS.has(event)) {
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

export { DcmQRSCP };
export type { DcmQRSCPOptions, DcmQRSCPEventMap };
