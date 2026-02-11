/**
 * DICOM Worklist Management SCP server wrapping the wlmscpfs binary.
 *
 * Provides a type-safe, event-driven API for serving worklist data
 * from a file-system based database. Uses a static factory pattern
 * because binary resolution and validation must happen before the
 * constructor call.
 *
 * @module servers/Wlmscpfs
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { DcmtkProcess } from '../DcmtkProcess';
import type { DcmtkProcessConfig } from '../DcmtkProcess';
import { LineParser } from '../parsers/LineParser';
import { resolveBinary } from '../tools/_resolveBinary';
import { WLMSCPFS_PATTERNS, WLMSCPFS_FATAL_EVENTS } from '../events/wlmscpfs';
import type {
    WlmListeningData,
    WlmAssociationReceivedData,
    WlmAssociationAcknowledgedData,
    WlmCFindRequestData,
    WlmCannotStartListenerData,
} from '../events/wlmscpfs';

// ---------------------------------------------------------------------------
// Event map type
// ---------------------------------------------------------------------------

/** Typed event map for the Wlmscpfs server. */
interface WlmscpfsEventMap {
    LISTENING: [WlmListeningData];
    ASSOCIATION_RECEIVED: [WlmAssociationReceivedData];
    ASSOCIATION_ACKNOWLEDGED: [WlmAssociationAcknowledgedData];
    C_FIND_REQUEST: [WlmCFindRequestData];
    ASSOCIATION_RELEASE: [];
    ASSOCIATION_ABORTED: [];
    ECHO_REQUEST: [];
    CANNOT_START_LISTENER: [WlmCannotStartListenerData];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a Wlmscpfs server instance. */
interface WlmscpfsOptions {
    /** Port to listen on (required, positional arg). */
    readonly port: number;
    /** Worklist data directory (required, -dfp flag). */
    readonly worklistDirectory: string;
    /** Enable file rejection (default true). Maps to -efr / -dfr. */
    readonly enableFileRejection?: boolean | undefined;
    /** Maximum PDU receive size. */
    readonly maxPdu?: number | undefined;
    /** ACSE timeout in seconds. */
    readonly acseTimeout?: number | undefined;
    /** DIMSE timeout in seconds. */
    readonly dimseTimeout?: number | undefined;
    /** Maximum simultaneous associations. */
    readonly maxAssociations?: number | undefined;
    /** Enable verbose mode (default true for event detection). */
    readonly verbose?: boolean | undefined;
    /** Timeout for start() to resolve, in milliseconds. */
    readonly startTimeoutMs?: number | undefined;
    /** Timeout for graceful drain during stop(), in milliseconds. */
    readonly drainTimeoutMs?: number | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

/** Pattern matching `..` as a path segment (between separators, or at start/end). */
const PATH_TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/** Returns true if the path does not contain traversal sequences. */
function isSafePath(p: string): boolean {
    return !PATH_TRAVERSAL_PATTERN.test(p);
}

const WlmscpfsOptionsSchema = z
    .object({
        port: z.number().int().min(1).max(65535),
        worklistDirectory: z.string().min(1).refine(isSafePath, { message: 'path traversal detected in worklistDirectory' }),
        enableFileRejection: z.boolean().optional(),
        maxPdu: z.number().int().min(4096).max(131072).optional(),
        acseTimeout: z.number().int().positive().optional(),
        dimseTimeout: z.number().int().positive().optional(),
        maxAssociations: z.number().int().positive().optional(),
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
function buildArgs(options: WlmscpfsOptions): string[] {
    const args: string[] = [];

    if (options.verbose !== false) {
        args.push('--verbose');
    }

    args.push('-dfp', options.worklistDirectory);

    if (options.enableFileRejection === false) {
        args.push('-dfr');
    } else {
        args.push('-efr');
    }

    buildNetworkArgs(args, options);

    args.push(String(options.port));

    return args;
}

/** Appends network-related CLI flags. */
function buildNetworkArgs(args: string[], options: WlmscpfsOptions): void {
    if (options.maxPdu !== undefined) {
        args.push('--max-pdu', String(options.maxPdu));
    }
    if (options.acseTimeout !== undefined) {
        args.push('--acse-timeout', String(options.acseTimeout));
    }
    if (options.dimseTimeout !== undefined) {
        args.push('--dimse-timeout', String(options.dimseTimeout));
    }
    if (options.maxAssociations !== undefined) {
        args.push('--max-associations', String(options.maxAssociations));
    }
}

// ---------------------------------------------------------------------------
// Wlmscpfs class
// ---------------------------------------------------------------------------

/**
 * DICOM Worklist Management SCP server wrapping the wlmscpfs binary.
 *
 * Uses a static `create()` factory because binary resolution is fallible
 * and must complete before the constructor runs.
 *
 * Note: wlmscpfs does not print a reliable "listening" message in all
 * DCMTK versions, so `start()` resolves on spawn (like StoreSCP).
 *
 * @example
 * ```ts
 * const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });
 * if (result.ok) {
 *     const server = result.value;
 *     server.onEvent('C_FIND_REQUEST', (data) => console.log('Find:', data.raw));
 *     const startResult = await server.start();
 * }
 * ```
 */
class Wlmscpfs extends DcmtkProcess {
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
     * Registers a typed listener for a wlmscpfs-specific event.
     *
     * @param event - The event name from WlmscpfsEventMap
     * @param listener - Callback receiving typed event data
     * @returns this for chaining
     */
    onEvent<K extends keyof WlmscpfsEventMap>(event: K, listener: (...args: WlmscpfsEventMap[K]) => void): this {
        return this.on(event as string, listener as never);
    }

    /**
     * Registers a listener for incoming C-FIND requests.
     *
     * @param listener - Callback receiving C-FIND request data
     * @returns this for chaining
     */
    onCFindRequest(listener: (...args: WlmscpfsEventMap['C_FIND_REQUEST']) => void): this {
        return this.onEvent('C_FIND_REQUEST', listener);
    }

    /**
     * Registers a listener for when the server starts listening.
     *
     * @param listener - Callback receiving listening data (port)
     * @returns this for chaining
     */
    onListening(listener: (...args: WlmscpfsEventMap['LISTENING']) => void): this {
        return this.onEvent('LISTENING', listener);
    }

    /**
     * Creates a new Wlmscpfs server instance.
     *
     * @param options - Configuration options for the wlmscpfs server
     * @returns A Result containing the server instance or a validation/resolution error
     */
    static create(options: WlmscpfsOptions): Result<Wlmscpfs> {
        const validation = WlmscpfsOptionsSchema.safeParse(options);
        if (!validation.success) {
            return err(new Error(`wlmscpfs: invalid options: ${validation.error.message}`));
        }

        const binaryResult = resolveBinary('wlmscpfs');
        if (!binaryResult.ok) {
            return err(binaryResult.error);
        }

        const args = buildArgs(options);
        const parser = new LineParser();
        for (const pattern of WLMSCPFS_PATTERNS) {
            parser.addPattern(pattern);
        }

        const config: DcmtkProcessConfig = {
            binary: binaryResult.value,
            args,
            startTimeoutMs: options.startTimeoutMs,
            drainTimeoutMs: options.drainTimeoutMs,
            // wlmscpfs doesn't reliably print "listening" — resolve on spawn
        };

        return ok(new Wlmscpfs(config, parser, options.signal));
    }

    /** Wires the line parser to the process output. */
    private wireParser(): void {
        this.on('line', ({ text }) => {
            this.parser.feed(text);
        });

        this.parser.on('match', ({ event, data }) => {
            if (WLMSCPFS_FATAL_EVENTS.has(event)) {
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

export { Wlmscpfs };
export type { WlmscpfsOptions, WlmscpfsEventMap };
