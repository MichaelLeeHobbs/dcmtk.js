/**
 * DICOM receiver server wrapping the dcmrecv binary.
 *
 * Provides a type-safe, event-driven API for receiving DICOM objects
 * via C-STORE. Uses a static factory pattern because binary resolution
 * must happen before the constructor call.
 *
 * @module servers/Dcmrecv
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { DcmtkProcess } from '../DcmtkProcess';
import type { DcmtkProcessConfig } from '../DcmtkProcess';
import { LineParser } from '../parsers/LineParser';
import { resolveBinary } from '../tools/_resolveBinary';
import { DCMRECV_PATTERNS, DCMRECV_FATAL_EVENTS } from '../events/dcmrecv';
import type {
    AssociationReceivedData,
    AssociationAcknowledgedData,
    CStoreRequestData,
    StoredFileData,
    RefusingAssociationData,
    CannotStartListenerData,
} from '../events/dcmrecv';

// ---------------------------------------------------------------------------
// Event map type (for documentation — consumers see typed overloads on class)
// ---------------------------------------------------------------------------

/** Typed event map for the Dcmrecv server. */
interface DcmrecvEventMap {
    LISTENING: [];
    ASSOCIATION_RECEIVED: [AssociationReceivedData];
    ASSOCIATION_ACKNOWLEDGED: [AssociationAcknowledgedData];
    C_STORE_REQUEST: [CStoreRequestData];
    STORED_FILE: [StoredFileData];
    ASSOCIATION_RELEASE: [];
    ASSOCIATION_ABORTED: [];
    ECHO_REQUEST: [];
    CANNOT_START_LISTENER: [CannotStartListenerData];
    REFUSING_ASSOCIATION: [RefusingAssociationData];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Subdirectory generation mode for received files. */
const SubdirectoryMode = {
    NONE: 'none',
    SERIES_DATE: 'series-date',
} as const;

type SubdirectoryModeValue = (typeof SubdirectoryMode)[keyof typeof SubdirectoryMode];

/** Filename generation mode for received files. */
const FilenameMode = {
    DEFAULT: 'default',
    UNIQUE: 'unique',
    SHORT_UNIQUE: 'short-unique',
    SYSTEM_TIME: 'system-time',
} as const;

type FilenameModeValue = (typeof FilenameMode)[keyof typeof FilenameMode];

/** Storage mode for received DICOM objects. */
const StorageMode = {
    NORMAL: 'normal',
    BIT_PRESERVING: 'bit-preserving',
    IGNORE: 'ignore',
} as const;

type StorageModeValue = (typeof StorageMode)[keyof typeof StorageMode];

/** Options for creating a Dcmrecv server instance. */
interface DcmrecvOptions {
    /** Port to listen on (required). */
    readonly port: number;
    /** Application Entity Title. */
    readonly aeTitle?: string | undefined;
    /** Output directory for received files. */
    readonly outputDirectory?: string | undefined;
    /** Path to a configuration file. */
    readonly configFile?: string | undefined;
    /** Subdirectory generation mode. */
    readonly subdirectory?: SubdirectoryModeValue | undefined;
    /** Filename generation mode. */
    readonly filenameMode?: FilenameModeValue | undefined;
    /** File extension for received files. */
    readonly filenameExtension?: string | undefined;
    /** Storage mode for received DICOM objects. */
    readonly storageMode?: StorageModeValue | undefined;
    /** ACSE timeout in seconds. */
    readonly acseTimeout?: number | undefined;
    /** DIMSE timeout in seconds. */
    readonly dimseTimeout?: number | undefined;
    /** Maximum PDU receive size. */
    readonly maxPdu?: number | undefined;
    /** Timeout for start() to resolve, in milliseconds. */
    readonly startTimeoutMs?: number | undefined;
    /** Timeout for graceful drain during stop(), in milliseconds. */
    readonly drainTimeoutMs?: number | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

const DcmrecvOptionsSchema = z
    .object({
        port: z.number().int().min(1).max(65535),
        aeTitle: z.string().min(1).max(16).optional(),
        outputDirectory: z.string().min(1).optional(),
        configFile: z.string().min(1).optional(),
        subdirectory: z.enum(['none', 'series-date']).optional(),
        filenameMode: z.enum(['default', 'unique', 'short-unique', 'system-time']).optional(),
        filenameExtension: z.string().min(1).optional(),
        storageMode: z.enum(['normal', 'bit-preserving', 'ignore']).optional(),
        acseTimeout: z.number().int().positive().optional(),
        dimseTimeout: z.number().int().positive().optional(),
        maxPdu: z.number().int().min(4096).max(131072).optional(),
        startTimeoutMs: z.number().int().positive().optional(),
        drainTimeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict();

// ---------------------------------------------------------------------------
// Argument builders (each <= 40 lines)
// ---------------------------------------------------------------------------

/** Builds the CLI arguments array from validated options. */
function buildArgs(options: DcmrecvOptions): string[] {
    const args: string[] = ['--verbose'];

    if (options.aeTitle !== undefined) {
        args.push('--aetitle', options.aeTitle);
    }
    if (options.outputDirectory !== undefined) {
        args.push('--output-directory', options.outputDirectory);
    }
    if (options.configFile !== undefined) {
        args.push('--config-file', options.configFile);
    }

    addFilenameArgs(args, options);
    addStorageArgs(args, options);
    addNetworkArgs(args, options);

    args.push(String(options.port));
    return args;
}

/** Appends filename-related CLI flags. */
function addFilenameArgs(args: string[], options: DcmrecvOptions): void {
    if (options.subdirectory === 'series-date') {
        args.push('--sort-on-patientsname');
    }
    if (options.filenameMode === 'unique') {
        args.push('--unique-filenames');
    } else if (options.filenameMode === 'short-unique') {
        args.push('--short-unique-filenames');
    } else if (options.filenameMode === 'system-time') {
        args.push('--system-time-filenames');
    }
    if (options.filenameExtension !== undefined) {
        args.push('--filename-extension', options.filenameExtension);
    }
}

/** Appends storage-related CLI flags. */
function addStorageArgs(args: string[], options: DcmrecvOptions): void {
    if (options.storageMode === 'bit-preserving') {
        args.push('--bit-preserving');
    } else if (options.storageMode === 'ignore') {
        args.push('--ignore');
    }
}

/** Appends network-related CLI flags. */
function addNetworkArgs(args: string[], options: DcmrecvOptions): void {
    if (options.acseTimeout !== undefined) {
        args.push('--acse-timeout', String(options.acseTimeout));
    }
    if (options.dimseTimeout !== undefined) {
        args.push('--dimse-timeout', String(options.dimseTimeout));
    }
    if (options.maxPdu !== undefined) {
        args.push('--max-pdu', String(options.maxPdu));
    }
}

// ---------------------------------------------------------------------------
// Dcmrecv class
// ---------------------------------------------------------------------------

/**
 * DICOM receiver server wrapping the dcmrecv binary.
 *
 * Uses a static `create()` factory because binary resolution is fallible
 * and must complete before the constructor runs.
 *
 * Server-specific events (LISTENING, STORED_FILE, etc.) are emitted dynamically
 * via the LineParser. Use `onEvent()` for typed listeners on server events.
 *
 * @example
 * ```ts
 * const result = Dcmrecv.create({ port: 11112, outputDirectory: '/tmp/received' });
 * if (result.ok) {
 *     const server = result.value;
 *     server.onEvent('STORED_FILE', (data) => console.log('Stored:', data.filePath));
 *     const startResult = await server.start();
 * }
 * ```
 */
class Dcmrecv extends DcmtkProcess {
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
     * Registers a typed listener for a dcmrecv-specific event.
     *
     * @param event - The event name from DcmrecvEventMap
     * @param listener - Callback receiving typed event data
     * @returns this for chaining
     */
    onEvent<K extends keyof DcmrecvEventMap>(event: K, listener: (...args: DcmrecvEventMap[K]) => void): this {
        return this.on(event as string, listener as never);
    }

    /**
     * Creates a new Dcmrecv server instance.
     *
     * @param options - Configuration options for the dcmrecv server
     * @returns A Result containing the server instance or a validation/resolution error
     */
    static create(options: DcmrecvOptions): Result<Dcmrecv> {
        const validation = DcmrecvOptionsSchema.safeParse(options);
        if (!validation.success) {
            return err(new Error(`dcmrecv: invalid options: ${validation.error.message}`));
        }

        const binaryResult = resolveBinary('dcmrecv');
        if (!binaryResult.ok) {
            return err(binaryResult.error);
        }

        const args = buildArgs(options);
        const parser = new LineParser();
        for (const pattern of DCMRECV_PATTERNS) {
            parser.addPattern(pattern);
        }

        const config: DcmtkProcessConfig = {
            binary: binaryResult.value,
            args,
            startTimeoutMs: options.startTimeoutMs,
            drainTimeoutMs: options.drainTimeoutMs,
            isStartedPredicate: line => /listening/i.test(line),
        };

        return ok(new Dcmrecv(config, parser, options.signal));
    }

    /** Wires the line parser to the process output. */
    private wireParser(): void {
        this.on('line', ({ text }) => {
            this.parser.feed(text);
        });

        this.parser.on('match', ({ event, data }) => {
            if (DCMRECV_FATAL_EVENTS.has(event)) {
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

export { Dcmrecv, SubdirectoryMode, FilenameMode, StorageMode };
export type { DcmrecvOptions, DcmrecvEventMap, SubdirectoryModeValue, FilenameModeValue, StorageModeValue };
