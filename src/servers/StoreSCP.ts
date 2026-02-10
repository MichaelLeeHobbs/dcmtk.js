/**
 * DICOM Storage SCP server wrapping the storescp binary.
 *
 * Provides a type-safe, event-driven API for receiving DICOM objects
 * via the storescp command-line tool. Supports sorting, exec hooks,
 * custom transfer syntaxes, and all standard storescp options.
 *
 * @module servers/StoreSCP
 */

import { z } from 'zod';
import type { Result } from '../types';
import { ok, err } from '../types';
import { DcmtkProcess } from '../DcmtkProcess';
import type { DcmtkProcessConfig } from '../DcmtkProcess';
import { LineParser } from '../parsers/LineParser';
import { resolveBinary } from '../tools/_resolveBinary';
import { STORESCP_PATTERNS, STORESCP_FATAL_EVENTS } from '../events/storescp';
import type {
    AssociationReceivedData,
    AssociationAcknowledgedData,
    CStoreRequestData,
    StoredFileData,
    RefusingAssociationData,
    CannotStartListenerData,
} from '../events/dcmrecv';
import type { StoringFileData, SubdirectoryCreatedData } from '../events/storescp';

// ---------------------------------------------------------------------------
// Event map type (for documentation — consumers see typed overloads on class)
// ---------------------------------------------------------------------------

/** Typed event map for the StoreSCP server. */
interface StoreSCPEventMap {
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
    STORING_FILE: [StoringFileData];
    SUBDIRECTORY_CREATED: [SubdirectoryCreatedData];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Preferred transfer syntax for incoming associations. */
const PreferredTransferSyntax = {
    LITTLE_ENDIAN: 'little-endian',
    BIG_ENDIAN: 'big-endian',
    IMPLICIT: 'implicit',
    ACCEPT_ALL: 'accept-all',
} as const;

type PreferredTransferSyntaxValue = (typeof PreferredTransferSyntax)[keyof typeof PreferredTransferSyntax];

/** Options for creating a StoreSCP server instance. */
interface StoreSCPOptions {
    /** Port to listen on (required). */
    readonly port: number;
    /** Application Entity Title. */
    readonly aeTitle?: string | undefined;
    /** Output directory for received files. */
    readonly outputDirectory?: string | undefined;
    /** Path to a configuration file. */
    readonly configFile?: string | undefined;
    /** Preferred transfer syntax. */
    readonly preferredTransferSyntax?: PreferredTransferSyntaxValue | undefined;
    /** Sort studies into subdirectories. */
    readonly sortByStudy?: boolean | undefined;
    /** Sort by Study Instance UID. */
    readonly sortByStudyUID?: boolean | undefined;
    /** Sort by patient name. */
    readonly sortByPatientName?: boolean | undefined;
    /** Generate unique filenames. */
    readonly uniqueFilenames?: boolean | undefined;
    /** Use bit-preserving mode. */
    readonly bitPreserving?: boolean | undefined;
    /** Execute command on each received file. */
    readonly execOnReception?: string | undefined;
    /** Execute command at end of study. */
    readonly execOnEndOfStudy?: string | undefined;
    /** Timeout (seconds) for end-of-study detection. */
    readonly endOfStudyTimeout?: number | undefined;
    /** Rename files at end of study. */
    readonly renameOnEndOfStudy?: boolean | undefined;
    /** Socket timeout in seconds. */
    readonly socketTimeout?: number | undefined;
    /** ACSE timeout in seconds. */
    readonly acseTimeout?: number | undefined;
    /** DIMSE timeout in seconds. */
    readonly dimseTimeout?: number | undefined;
    /** Maximum PDU receive size. */
    readonly maxPdu?: number | undefined;
    /** Filename extension for received files. */
    readonly filenameExtension?: string | undefined;
    /** Timeout for start() to resolve, in milliseconds. */
    readonly startTimeoutMs?: number | undefined;
    /** Timeout for graceful drain during stop(), in milliseconds. */
    readonly drainTimeoutMs?: number | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

const StoreSCPOptionsSchema = z
    .object({
        port: z.number().int().min(1).max(65535),
        aeTitle: z.string().min(1).max(16).optional(),
        outputDirectory: z.string().min(1).optional(),
        configFile: z.string().min(1).optional(),
        preferredTransferSyntax: z.enum(['little-endian', 'big-endian', 'implicit', 'accept-all']).optional(),
        sortByStudy: z.boolean().optional(),
        sortByStudyUID: z.boolean().optional(),
        sortByPatientName: z.boolean().optional(),
        uniqueFilenames: z.boolean().optional(),
        bitPreserving: z.boolean().optional(),
        execOnReception: z.string().min(1).optional(),
        execOnEndOfStudy: z.string().min(1).optional(),
        endOfStudyTimeout: z.number().int().positive().optional(),
        renameOnEndOfStudy: z.boolean().optional(),
        socketTimeout: z.number().int().positive().optional(),
        acseTimeout: z.number().int().positive().optional(),
        dimseTimeout: z.number().int().positive().optional(),
        maxPdu: z.number().int().min(4096).max(131072).optional(),
        filenameExtension: z.string().min(1).optional(),
        startTimeoutMs: z.number().int().positive().optional(),
        drainTimeoutMs: z.number().int().positive().optional(),
        signal: z.instanceof(AbortSignal).optional(),
    })
    .strict();

// ---------------------------------------------------------------------------
// Argument builders (each <= 40 lines)
// ---------------------------------------------------------------------------

/** Builds the full CLI arguments array. */
function buildArgs(options: StoreSCPOptions): string[] {
    const args: string[] = ['--verbose'];

    if (options.aeTitle !== undefined) {
        args.push('--aetitle', options.aeTitle);
    }
    if (options.configFile !== undefined) {
        args.push('--config-file', options.configFile);
    }

    buildTransferSyntaxArgs(args, options);
    buildSortArgs(args, options);
    buildOutputArgs(args, options);
    buildNetworkArgs(args, options);
    buildExecArgs(args, options);

    args.push(String(options.port));
    return args;
}

/** Appends transfer syntax CLI flags. */
function buildTransferSyntaxArgs(args: string[], options: StoreSCPOptions): void {
    if (options.preferredTransferSyntax === 'little-endian') {
        args.push('+xe');
    } else if (options.preferredTransferSyntax === 'big-endian') {
        args.push('+xb');
    } else if (options.preferredTransferSyntax === 'implicit') {
        args.push('+xi');
    } else if (options.preferredTransferSyntax === 'accept-all') {
        args.push('-xf');
    }
}

/** Appends sorting-related CLI flags. */
function buildSortArgs(args: string[], options: StoreSCPOptions): void {
    if (options.sortByStudy === true) {
        args.push('--sort-conc-studies');
    }
    if (options.sortByStudyUID === true) {
        args.push('--sort-on-study-uid');
    }
    if (options.sortByPatientName === true) {
        args.push('--sort-on-patientsname');
    }
}

/** Appends output-related CLI flags. */
function buildOutputArgs(args: string[], options: StoreSCPOptions): void {
    if (options.outputDirectory !== undefined) {
        args.push('--output-directory', options.outputDirectory);
    }
    if (options.uniqueFilenames === true) {
        args.push('--unique-filenames');
    }
    if (options.bitPreserving === true) {
        args.push('--bit-preserving');
    }
    if (options.filenameExtension !== undefined) {
        args.push('--filename-extension', options.filenameExtension);
    }
}

/** Appends network-related CLI flags. */
function buildNetworkArgs(args: string[], options: StoreSCPOptions): void {
    if (options.socketTimeout !== undefined) {
        args.push('--socket-timeout', String(options.socketTimeout));
    }
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

/** Appends exec-related CLI flags. */
function buildExecArgs(args: string[], options: StoreSCPOptions): void {
    if (options.execOnReception !== undefined) {
        args.push('--exec-on-reception', options.execOnReception);
    }
    if (options.execOnEndOfStudy !== undefined) {
        args.push('--exec-on-eostudy', options.execOnEndOfStudy);
    }
    if (options.endOfStudyTimeout !== undefined) {
        args.push('--eostudy-timeout', String(options.endOfStudyTimeout));
    }
    if (options.renameOnEndOfStudy === true) {
        args.push('--rename-on-eostudy');
    }
}

// ---------------------------------------------------------------------------
// StoreSCP class
// ---------------------------------------------------------------------------

/**
 * DICOM Storage SCP server wrapping the storescp binary.
 *
 * Uses a static `create()` factory because binary resolution is fallible
 * and must complete before the constructor runs.
 *
 * Note: storescp does not print a "listening" message, so `start()` resolves
 * on spawn. If the port is busy, storescp exits immediately and `start()`
 * returns an error via the close handler.
 *
 * Server-specific events are emitted dynamically via the LineParser.
 * Use `onEvent()` for typed listeners on server events.
 *
 * @example
 * ```ts
 * const result = StoreSCP.create({ port: 11112, outputDirectory: '/tmp/received' });
 * if (result.ok) {
 *     const server = result.value;
 *     server.onEvent('STORED_FILE', (data) => console.log('Stored:', data.filePath));
 *     const startResult = await server.start();
 * }
 * ```
 */
class StoreSCP extends DcmtkProcess {
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
     * Registers a typed listener for a storescp-specific event.
     *
     * @param event - The event name from StoreSCPEventMap
     * @param listener - Callback receiving typed event data
     * @returns this for chaining
     */
    onEvent<K extends keyof StoreSCPEventMap>(event: K, listener: (...args: StoreSCPEventMap[K]) => void): this {
        return this.on(event as string, listener as never);
    }

    /**
     * Creates a new StoreSCP server instance.
     *
     * @param options - Configuration options for the storescp server
     * @returns A Result containing the server instance or a validation/resolution error
     */
    static create(options: StoreSCPOptions): Result<StoreSCP> {
        const validation = StoreSCPOptionsSchema.safeParse(options);
        if (!validation.success) {
            return err(new Error(`storescp: invalid options: ${validation.error.message}`));
        }

        const binaryResult = resolveBinary('storescp');
        if (!binaryResult.ok) {
            return err(binaryResult.error);
        }

        const args = buildArgs(options);
        const parser = new LineParser();
        for (const pattern of STORESCP_PATTERNS) {
            parser.addPattern(pattern);
        }

        const config: DcmtkProcessConfig = {
            binary: binaryResult.value,
            args,
            startTimeoutMs: options.startTimeoutMs,
            drainTimeoutMs: options.drainTimeoutMs,
            // storescp doesn't print "listening" — resolve on spawn
        };

        return ok(new StoreSCP(config, parser, options.signal));
    }

    /** Wires the line parser to the process output. */
    private wireParser(): void {
        this.on('line', ({ text }) => {
            this.parser.feed(text);
        });

        this.parser.on('match', ({ event, data }) => {
            if (STORESCP_FATAL_EVENTS.has(event)) {
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

export { StoreSCP, PreferredTransferSyntax };
export type { StoreSCPOptions, StoreSCPEventMap, PreferredTransferSyntaxValue };
