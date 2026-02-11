/**
 * DICOM Print Management SCP server wrapping the dcmprscp binary.
 *
 * Provides a type-safe, event-driven API for the Basic Grayscale Print
 * Management SCP. Uses a static factory pattern because binary resolution
 * and validation must happen before the constructor call.
 *
 * @module servers/DcmprsCP
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { DcmtkProcess } from '../DcmtkProcess';
import type { DcmtkProcessConfig } from '../DcmtkProcess';
import { LineParser } from '../parsers/LineParser';
import { resolveBinary } from '../tools/_resolveBinary';
import { DCMPRSCP_PATTERNS, DCMPRSCP_FATAL_EVENTS } from '../events/dcmprscp';
import type {
    DatabaseReadyData,
    PrintAssociationReceivedData,
    PrintAssociationAcknowledgedData,
    PrintCannotStartListenerData,
    ConfigErrorData,
} from '../events/dcmprscp';

// ---------------------------------------------------------------------------
// Event map type
// ---------------------------------------------------------------------------

/** Typed event map for the DcmprsCP server. */
interface DcmprsCPEventMap {
    DATABASE_READY: [DatabaseReadyData];
    ASSOCIATION_RECEIVED: [PrintAssociationReceivedData];
    ASSOCIATION_ACKNOWLEDGED: [PrintAssociationAcknowledgedData];
    ASSOCIATION_RELEASE: [];
    ASSOCIATION_ABORTED: [];
    CANNOT_START_LISTENER: [PrintCannotStartListenerData];
    CONFIG_ERROR: [ConfigErrorData];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for creating a DcmprsCP server instance. */
interface DcmprsCPOptions {
    /** Path to the dcmpstat configuration file (required). */
    readonly configFile: string;
    /** Printer identifier from the config file (optional, defaults to first printer). */
    readonly printer?: string | undefined;
    /** Enable DIMSE message dumping. */
    readonly dump?: boolean | undefined;
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

/** Pattern matching `..` as a path segment (between separators, or at start/end). */
const PATH_TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/** Returns true if the path does not contain traversal sequences. */
function isSafePath(p: string): boolean {
    return !PATH_TRAVERSAL_PATTERN.test(p);
}

const DcmprsCPOptionsSchema = z
    .object({
        configFile: z.string().min(1).refine(isSafePath, { message: 'path traversal detected in configFile' }),
        printer: z.string().min(1).optional(),
        dump: z.boolean().optional(),
        logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
        logConfig: z.string().min(1).refine(isSafePath, { message: 'path traversal detected in logConfig' }).optional(),
        startTimeoutMs: z.number().int().positive().optional(),
        drainTimeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict();

// ---------------------------------------------------------------------------
// Argument builder
// ---------------------------------------------------------------------------

/** Builds the CLI arguments array from validated options. */
function buildArgs(options: DcmprsCPOptions): string[] {
    const args: string[] = ['--verbose', '--config', options.configFile];

    if (options.printer !== undefined) {
        args.push('--printer', options.printer);
    }
    if (options.dump === true) {
        args.push('--dump');
    }
    if (options.logLevel !== undefined) {
        args.push('--log-level', options.logLevel);
    }
    if (options.logConfig !== undefined) {
        args.push('--log-config', options.logConfig);
    }

    return args;
}

// ---------------------------------------------------------------------------
// DcmprsCP class
// ---------------------------------------------------------------------------

/**
 * DICOM Print Management SCP server wrapping the dcmprscp binary.
 *
 * Uses a static `create()` factory because binary resolution is fallible
 * and must complete before the constructor runs.
 *
 * Note: dcmprscp does not print a "listening" message. The `start()` method
 * resolves either when the DATABASE_READY event is detected or on spawn.
 *
 * @example
 * ```ts
 * const result = DcmprsCP.create({ configFile: '/etc/dcmpstat.cfg' });
 * if (result.ok) {
 *     const server = result.value;
 *     server.onEvent('DATABASE_READY', (data) => console.log('DB:', data.directory));
 *     const startResult = await server.start();
 * }
 * ```
 */
class DcmprsCP extends DcmtkProcess {
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
     * Registers a typed listener for a dcmprscp-specific event.
     *
     * @param event - The event name from DcmprsCPEventMap
     * @param listener - Callback receiving typed event data
     * @returns this for chaining
     */
    onEvent<K extends keyof DcmprsCPEventMap>(event: K, listener: (...args: DcmprsCPEventMap[K]) => void): this {
        return this.on(event as string, listener as never);
    }

    /**
     * Registers a listener for when the database is ready.
     *
     * @param listener - Callback receiving database ready data
     * @returns this for chaining
     */
    onDatabaseReady(listener: (...args: DcmprsCPEventMap['DATABASE_READY']) => void): this {
        return this.onEvent('DATABASE_READY', listener);
    }

    /**
     * Registers a listener for incoming associations.
     *
     * @param listener - Callback receiving association data
     * @returns this for chaining
     */
    onAssociationReceived(listener: (...args: DcmprsCPEventMap['ASSOCIATION_RECEIVED']) => void): this {
        return this.onEvent('ASSOCIATION_RECEIVED', listener);
    }

    /**
     * Creates a new DcmprsCP server instance.
     *
     * @param options - Configuration options for the dcmprscp server
     * @returns A Result containing the server instance or a validation/resolution error
     */
    static create(options: DcmprsCPOptions): Result<DcmprsCP> {
        const validation = DcmprsCPOptionsSchema.safeParse(options);
        if (!validation.success) {
            return err(new Error(`dcmprscp: invalid options: ${validation.error.message}`));
        }

        const binaryResult = resolveBinary('dcmprscp');
        if (!binaryResult.ok) {
            return err(binaryResult.error);
        }

        const args = buildArgs(options);
        const parser = new LineParser();
        for (const pattern of DCMPRSCP_PATTERNS) {
            parser.addPattern(pattern);
        }

        const config: DcmtkProcessConfig = {
            binary: binaryResult.value,
            args,
            startTimeoutMs: options.startTimeoutMs,
            drainTimeoutMs: options.drainTimeoutMs,
            isStartedPredicate: line => /Using database in directory/i.test(line),
        };

        return ok(new DcmprsCP(config, parser, options.signal));
    }

    /** Wires the line parser to the process output. */
    private wireParser(): void {
        this.on('line', ({ text }) => {
            this.parser.feed(text);
        });

        this.parser.on('match', ({ event, data }) => {
            if (DCMPRSCP_FATAL_EVENTS.has(event)) {
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

export { DcmprsCP };
export type { DcmprsCPOptions, DcmprsCPEventMap };
