/**
 * High-level PACS client encapsulating DICOM network operations.
 *
 * Wraps findscu, getscu, movescu, storescu, and echoscu with a
 * connection-config-once, call-many pattern. Query results are
 * returned as DicomDataset arrays for immediate use.
 *
 * @module pacs/PacsClient
 */

import { z } from 'zod';

import type { Result } from '../types';
import { ok, err } from '../types';
import { DEFAULT_TIMEOUT_MS } from '../constants';
import type { DicomDataset } from '../dicom/DicomDataset';
import { echoscu } from '../tools/echoscu';
import { findscu } from '../tools/findscu';
import { getscu } from '../tools/getscu';
import { movescu } from '../tools/movescu';
import { storescu } from '../tools/storescu';
import type {
    PacsClientConfig,
    PacsEchoOptions,
    PacsEchoResult,
    PacsQueryOptions,
    PacsRetrieveOptions,
    PacsRetrieveResult,
    PacsStoreOptions,
    PacsStoreResult,
    StudyFilter,
    SeriesFilter,
    ImageFilter,
    WorklistFilter,
    RetrieveModeValue,
} from './types';
import { RetrieveMode } from './types';
import { buildStudyKeys, buildSeriesKeys, buildImageKeys, buildWorklistKeys } from './queryKeys';
import { createTempDir, parseExtractedFiles, cleanupTempDir } from './parseResults';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PacsClientConfigSchema = z
    .object({
        host: z.string().min(1),
        port: z.number().int().min(1).max(65535),
        callingAETitle: z.string().min(1).max(16).optional(),
        calledAETitle: z.string().min(1).max(16).optional(),
        timeoutMs: z.number().int().positive().optional(),
    })
    .strict();

/** Default concurrency for parallel file parsing. */
const DEFAULT_PARSE_CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// PacsClient
// ---------------------------------------------------------------------------

/**
 * High-level PACS client for DICOM network operations.
 *
 * Encapsulates connection configuration and provides friendly methods
 * for Echo (C-ECHO), Query (C-FIND), Retrieve (C-GET/C-MOVE), and
 * Store (C-STORE) operations.
 *
 * @example
 * ```ts
 * const clientResult = PacsClient.create({
 *     host: '192.168.1.100',
 *     port: 104,
 *     calledAETitle: 'PACS',
 * });
 * if (!clientResult.ok) throw clientResult.error;
 * const client = clientResult.value;
 *
 * // Echo
 * const echo = await client.echo();
 *
 * // Query studies
 * const studies = await client.findStudies({ patientId: 'PAT001' });
 *
 * // Retrieve a study
 * const retrieve = await client.retrieveStudy('1.2.3.4', {
 *     outputDirectory: '/tmp/dicom',
 * });
 * ```
 */
class PacsClient {
    private readonly config: Readonly<Required<Pick<PacsClientConfig, 'host' | 'port'>> & PacsClientConfig>;

    private constructor(config: PacsClientConfig) {
        this.config = config as typeof this.config;
    }

    /**
     * Creates a new PacsClient instance with validated configuration.
     *
     * @param config - PACS connection configuration
     * @returns A Result containing the PacsClient or a validation error
     */
    static create(config: PacsClientConfig): Result<PacsClient> {
        const validation = PacsClientConfigSchema.safeParse(config);
        if (!validation.success) {
            return err(new Error(`PacsClient: invalid config: ${validation.error.message}`));
        }
        return ok(new PacsClient(config));
    }

    /** Remote host. */
    get host(): string {
        return this.config.host;
    }

    /** Remote port. */
    get port(): number {
        return this.config.port;
    }

    /** Calling AE Title. */
    get callingAETitle(): string | undefined {
        return this.config.callingAETitle;
    }

    /** Called AE Title. */
    get calledAETitle(): string | undefined {
        return this.config.calledAETitle;
    }

    /**
     * Tests DICOM connectivity using C-ECHO.
     *
     * @param options - Echo options
     * @returns A Result containing the echo result with RTT
     */
    async echo(options?: PacsEchoOptions): Promise<Result<PacsEchoResult>> {
        const timeoutMs = this.resolveTimeout(options?.timeoutMs);
        const start = Date.now();

        const result = await echoscu({
            host: this.config.host,
            port: this.config.port,
            callingAETitle: this.config.callingAETitle,
            calledAETitle: this.config.calledAETitle,
            timeoutMs,
            signal: options?.signal,
        });

        if (!result.ok) {
            return err(result.error);
        }

        return ok({ success: true, rttMs: Date.now() - start });
    }

    /**
     * Queries for studies matching the given filter.
     *
     * @param filter - Study-level filter criteria
     * @param options - Query options
     * @returns A Result containing matching DicomDatasets
     */
    async findStudies(filter: StudyFilter, options?: PacsQueryOptions): Promise<Result<readonly DicomDataset[]>> {
        return this.executeQuery('study', buildStudyKeys(filter), options);
    }

    /**
     * Queries for series matching the given filter.
     *
     * @param filter - Series-level filter criteria (studyInstanceUID required)
     * @param options - Query options
     * @returns A Result containing matching DicomDatasets
     */
    async findSeries(filter: SeriesFilter, options?: PacsQueryOptions): Promise<Result<readonly DicomDataset[]>> {
        return this.executeQuery('study', buildSeriesKeys(filter), options);
    }

    /**
     * Queries for images matching the given filter.
     *
     * @param filter - Image-level filter criteria
     * @param options - Query options
     * @returns A Result containing matching DicomDatasets
     */
    async findImages(filter: ImageFilter, options?: PacsQueryOptions): Promise<Result<readonly DicomDataset[]>> {
        return this.executeQuery('study', buildImageKeys(filter), options);
    }

    /**
     * Queries a worklist SCP with raw filter keys.
     *
     * @param filter - Worklist filter with raw key strings
     * @param options - Query options
     * @returns A Result containing matching DicomDatasets
     */
    async findWorklist(filter: WorklistFilter, options?: PacsQueryOptions): Promise<Result<readonly DicomDataset[]>> {
        return this.executeQuery('worklist', buildWorklistKeys(filter), options);
    }

    /**
     * Executes a raw C-FIND query with arbitrary keys.
     *
     * @param keys - Array of -k argument strings
     * @param options - Query options
     * @returns A Result containing matching DicomDatasets
     */
    async find(keys: readonly string[], options?: PacsQueryOptions): Promise<Result<readonly DicomDataset[]>> {
        return this.executeQuery('study', keys, options);
    }

    /**
     * Retrieves a study by Study Instance UID.
     *
     * @param studyInstanceUID - Study Instance UID to retrieve
     * @param options - Retrieval options (outputDirectory required)
     * @returns A Result containing the retrieval result
     */
    async retrieveStudy(studyInstanceUID: string, options: PacsRetrieveOptions): Promise<Result<PacsRetrieveResult>> {
        const keys = [`0008,0052=STUDY`, `0020,000d=${studyInstanceUID}`];
        return this.executeRetrieve(keys, options);
    }

    /**
     * Retrieves a series by Study + Series Instance UIDs.
     *
     * @param studyInstanceUID - Study Instance UID
     * @param seriesInstanceUID - Series Instance UID to retrieve
     * @param options - Retrieval options (outputDirectory required)
     * @returns A Result containing the retrieval result
     */
    async retrieveSeries(studyInstanceUID: string, seriesInstanceUID: string, options: PacsRetrieveOptions): Promise<Result<PacsRetrieveResult>> {
        const keys = [`0008,0052=SERIES`, `0020,000d=${studyInstanceUID}`, `0020,000e=${seriesInstanceUID}`];
        return this.executeRetrieve(keys, options);
    }

    /**
     * Sends DICOM files to the remote SCP using C-STORE.
     *
     * @param files - File paths to send
     * @param options - Store options
     * @returns A Result containing the store result
     */
    async store(files: readonly string[], options?: PacsStoreOptions): Promise<Result<PacsStoreResult>> {
        const timeoutMs = this.resolveTimeout(options?.timeoutMs);

        const result = await storescu({
            host: this.config.host,
            port: this.config.port,
            files: [...files],
            callingAETitle: this.config.callingAETitle,
            calledAETitle: this.config.calledAETitle,
            scanDirectories: options?.scanDirectories,
            recurse: options?.recurse,
            timeoutMs,
            signal: options?.signal,
        });

        if (!result.ok) {
            return err(result.error);
        }

        return ok({ success: true, fileCount: files.length });
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Resolves the effective timeout: method override > client config > default.
     */
    private resolveTimeout(methodTimeout?: number): number {
        return methodTimeout ?? this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }

    /**
     * Executes a C-FIND query: creates temp dir, runs findscu --extract,
     * parses extracted files, cleans up temp dir.
     */
    private async executeQuery(
        queryModel: 'study' | 'worklist',
        keys: readonly string[],
        options?: PacsQueryOptions
    ): Promise<Result<readonly DicomDataset[]>> {
        const timeoutMs = this.resolveTimeout(options?.timeoutMs);
        const concurrency = options?.parseConcurrency ?? DEFAULT_PARSE_CONCURRENCY;

        const tempDirResult = await createTempDir();
        if (!tempDirResult.ok) {
            return err(tempDirResult.error);
        }

        const tempDir = tempDirResult.value;
        try {
            return await this.runFindAndParse({ queryModel, keys, tempDir, timeoutMs, concurrency, signal: options?.signal });
        } finally {
            await cleanupTempDir(tempDir);
        }
    }

    /**
     * Runs findscu --extract and parses the results from the temp directory.
     */
    private async runFindAndParse(params: {
        readonly queryModel: 'study' | 'worklist';
        readonly keys: readonly string[];
        readonly tempDir: string;
        readonly timeoutMs: number;
        readonly concurrency: number;
        readonly signal?: AbortSignal | undefined;
    }): Promise<Result<readonly DicomDataset[]>> {
        const findResult = await findscu({
            host: this.config.host,
            port: this.config.port,
            callingAETitle: this.config.callingAETitle,
            calledAETitle: this.config.calledAETitle,
            queryModel: params.queryModel,
            keys: [...params.keys],
            extract: true,
            outputDirectory: params.tempDir,
            timeoutMs: params.timeoutMs,
            signal: params.signal,
        });

        if (!findResult.ok) {
            return err(findResult.error);
        }

        return parseExtractedFiles(params.tempDir, params.timeoutMs, params.concurrency, params.signal);
    }

    /**
     * Dispatches retrieval to C-GET or C-MOVE based on the mode option.
     */
    private async executeRetrieve(keys: readonly string[], options: PacsRetrieveOptions): Promise<Result<PacsRetrieveResult>> {
        const mode: RetrieveModeValue = options.mode ?? RetrieveMode.C_GET;
        const timeoutMs = this.resolveTimeout(options.timeoutMs);

        if (mode === RetrieveMode.C_MOVE) {
            return this.executeCMove(keys, options, timeoutMs);
        }
        return this.executeCGet(keys, options, timeoutMs);
    }

    /**
     * Executes a C-GET retrieval via getscu.
     */
    private async executeCGet(keys: readonly string[], options: PacsRetrieveOptions, timeoutMs: number): Promise<Result<PacsRetrieveResult>> {
        const result = await getscu({
            host: this.config.host,
            port: this.config.port,
            callingAETitle: this.config.callingAETitle,
            calledAETitle: this.config.calledAETitle,
            queryModel: 'study',
            keys: [...keys],
            outputDirectory: options.outputDirectory,
            timeoutMs,
            signal: options.signal,
        });

        if (!result.ok) {
            return err(result.error);
        }

        return ok({ success: true, outputDirectory: options.outputDirectory });
    }

    /**
     * Executes a C-MOVE retrieval via movescu.
     */
    private async executeCMove(keys: readonly string[], options: PacsRetrieveOptions, timeoutMs: number): Promise<Result<PacsRetrieveResult>> {
        if (options.moveDestination === undefined) {
            return err(new Error('PacsClient: moveDestination is required when mode is C_MOVE'));
        }

        const result = await movescu({
            host: this.config.host,
            port: this.config.port,
            callingAETitle: this.config.callingAETitle,
            calledAETitle: this.config.calledAETitle,
            queryModel: 'study',
            keys: [...keys],
            moveDestination: options.moveDestination,
            outputDirectory: options.outputDirectory,
            timeoutMs,
            signal: options.signal,
        });

        if (!result.ok) {
            return err(result.error);
        }

        return ok({ success: true, outputDirectory: options.outputDirectory });
    }
}

export { PacsClient };
