// Result pattern
export { ok, err, assertUnreachable } from './types';
export type { Result, DcmtkProcessResult, ExecOptions, SpawnOptions, LineSource, ProcessLine } from './types';

// Branded types
export { createDicomTag, createAETitle, createDicomTagPath, createSOPClassUID, createTransferSyntaxUID, createDicomFilePath, createPort } from './brands';
export type { Brand, DicomTag, AETitle, DicomTagPath, SOPClassUID, TransferSyntaxUID, DicomFilePath, Port } from './brands';

// Constants
export {
    DEFAULT_TIMEOUT_MS,
    DEFAULT_START_TIMEOUT_MS,
    DEFAULT_DRAIN_TIMEOUT_MS,
    DEFAULT_BLOCK_TIMEOUT_MS,
    PDU_SIZE,
    DEFAULT_DICOM_PORT,
    WINDOWS_SEARCH_PATHS,
    UNIX_SEARCH_PATHS,
    REQUIRED_BINARIES,
    MAX_BUFFER_BYTES,
    MAX_BLOCK_LINES,
    MAX_EVENT_PATTERNS,
    MAX_TRAVERSAL_DEPTH,
} from './constants';

// Validation
export { AETitleSchema, PortSchema, DicomTagSchema, DicomTagPathSchema, UIDSchema } from './validation';
export { parseAETitle, parsePort, parseDicomTag, parseDicomTagPath, parseSOPClassUID, parseTransferSyntaxUID } from './validation';

// Path discovery
export { findDcmtkPath, clearDcmtkPathCache } from './findDcmtkPath';
export type { FindDcmtkPathOptions } from './findDcmtkPath';

// Process execution
export { execCommand, spawnCommand } from './exec';

// Long-lived process manager
export { DcmtkProcess, ProcessState } from './DcmtkProcess';
export type { DcmtkProcessEventMap, DcmtkProcessConfig, ProcessStateValue } from './DcmtkProcess';

// Output parsing
export { LineParser } from './parsers/LineParser';
export type { LineParserEventMap } from './parsers/LineParser';
export type { EventPattern, MultiLineConfig } from './parsers/EventPattern';
