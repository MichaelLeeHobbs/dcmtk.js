/**
 * Type definitions for the high-level PACS client API.
 *
 * @module pacs/types
 */

import type { DicomDataset } from '../dicom/DicomDataset';

// ---------------------------------------------------------------------------
// Const objects (Rule 3.5: no enums)
// ---------------------------------------------------------------------------

/** Query levels supported by C-FIND. */
const QueryLevel = {
    STUDY: 'STUDY',
    SERIES: 'SERIES',
    IMAGE: 'IMAGE',
    WORKLIST: 'WORKLIST',
} as const;

/** Union of valid query level values. */
type QueryLevelValue = (typeof QueryLevel)[keyof typeof QueryLevel];

/** Retrieval modes for C-GET and C-MOVE. */
const RetrieveMode = {
    C_GET: 'C_GET',
    C_MOVE: 'C_MOVE',
} as const;

/** Union of valid retrieve mode values. */
type RetrieveModeValue = (typeof RetrieveMode)[keyof typeof RetrieveMode];

// ---------------------------------------------------------------------------
// Base options
// ---------------------------------------------------------------------------

/** Base options shared by all PacsClient methods. */
interface PacsMethodOptions {
    /** Timeout in milliseconds for this operation. Overrides client default. */
    readonly timeoutMs?: number | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Connection configuration for a PACS node. */
interface PacsClientConfig {
    /** Remote host or IP address. */
    readonly host: string;
    /** Remote port number (1-65535). */
    readonly port: number;
    /** Calling AE Title (local). Defaults to 'DCMTK'. */
    readonly callingAETitle?: string | undefined;
    /** Called AE Title (remote). Defaults to 'ANY-SCP'. */
    readonly calledAETitle?: string | undefined;
    /** Default timeout in milliseconds for all operations. */
    readonly timeoutMs?: number | undefined;
}

// ---------------------------------------------------------------------------
// Method-specific options
// ---------------------------------------------------------------------------

/** Options for {@link PacsClient.echo}. */
type PacsEchoOptions = PacsMethodOptions;

/** Options for {@link PacsClient.findStudies} and related query methods. */
interface PacsQueryOptions extends PacsMethodOptions {
    /** Maximum number of concurrent file parse operations. Defaults to 5. */
    readonly parseConcurrency?: number | undefined;
}

/** Options for {@link PacsClient.retrieveStudy} and related retrieval methods. */
interface PacsRetrieveOptions extends PacsMethodOptions {
    /** Directory to write retrieved files into. */
    readonly outputDirectory: string;
    /** Retrieval mode. Defaults to C_GET. */
    readonly mode?: RetrieveModeValue | undefined;
    /** Move destination AE Title (required when mode is C_MOVE). */
    readonly moveDestination?: string | undefined;
}

/** Options for {@link PacsClient.store}. */
interface PacsStoreOptions extends PacsMethodOptions {
    /** Scan directories for DICOM files. */
    readonly scanDirectories?: boolean | undefined;
    /** Recurse into subdirectories (requires scanDirectories). */
    readonly recurse?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** Filter criteria for study-level C-FIND queries. */
interface StudyFilter {
    /** Patient ID (0010,0020). */
    readonly patientId?: string | undefined;
    /** Patient Name (0010,0010). Supports wildcards. */
    readonly patientName?: string | undefined;
    /** Study Date (0008,0020). Supports ranges like '20240101-20241231'. */
    readonly studyDate?: string | undefined;
    /** Accession Number (0008,0050). */
    readonly accessionNumber?: string | undefined;
    /** Modality (0008,0060). */
    readonly modality?: string | undefined;
    /** Study Instance UID (0020,000d). */
    readonly studyInstanceUID?: string | undefined;
    /** Study Description (0008,1030). */
    readonly studyDescription?: string | undefined;
}

/** Filter criteria for series-level C-FIND queries. */
interface SeriesFilter {
    /** Study Instance UID (required for series-level queries). */
    readonly studyInstanceUID: string;
    /** Modality (0008,0060). */
    readonly modality?: string | undefined;
    /** Series Number (0020,0011). */
    readonly seriesNumber?: string | undefined;
    /** Series Instance UID (0020,000e). */
    readonly seriesInstanceUID?: string | undefined;
    /** Series Description (0008,103e). */
    readonly seriesDescription?: string | undefined;
}

/** Filter criteria for image-level C-FIND queries. */
interface ImageFilter {
    /** Study Instance UID (required for image-level queries). */
    readonly studyInstanceUID: string;
    /** Series Instance UID (required for image-level queries). */
    readonly seriesInstanceUID: string;
    /** Instance Number (0020,0013). */
    readonly instanceNumber?: string | undefined;
    /** SOP Instance UID (0008,0018). */
    readonly sopInstanceUID?: string | undefined;
    /** SOP Class UID (0008,0016). */
    readonly sopClassUID?: string | undefined;
}

/** Filter criteria for worklist C-FIND queries. Raw key pass-through. */
interface WorklistFilter {
    /** Raw DICOM key strings (e.g., '0040,0100.0008,0060=CT'). */
    readonly keys: readonly string[];
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** Result of a PACS echo (C-ECHO) operation. */
interface PacsEchoResult {
    /** Whether the echo succeeded. */
    readonly success: boolean;
    /** Round-trip time in milliseconds. */
    readonly rttMs: number;
}

/** Result of a PACS store (C-STORE) operation. */
interface PacsStoreResult {
    /** Whether the store completed successfully. */
    readonly success: boolean;
    /** Number of files sent. */
    readonly fileCount: number;
}

/** Result of a PACS retrieve (C-GET/C-MOVE) operation. */
interface PacsRetrieveResult {
    /** Whether the retrieval completed successfully. */
    readonly success: boolean;
    /** Directory containing the retrieved files. */
    readonly outputDirectory: string;
}

/** Result of a PACS query (C-FIND) operation. */
type PacsQueryResult = readonly DicomDataset[];

export { QueryLevel, RetrieveMode };
export type {
    QueryLevelValue,
    RetrieveModeValue,
    PacsMethodOptions,
    PacsClientConfig,
    PacsEchoOptions,
    PacsQueryOptions,
    PacsRetrieveOptions,
    PacsStoreOptions,
    StudyFilter,
    SeriesFilter,
    ImageFilter,
    WorklistFilter,
    PacsEchoResult,
    PacsStoreResult,
    PacsRetrieveResult,
    PacsQueryResult,
};
