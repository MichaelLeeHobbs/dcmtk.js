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

// Tool wrappers (Phase 3 P0)
export { dcm2xml, Dcm2xmlCharset } from './tools/dcm2xml';
export type { Dcm2xmlOptions, Dcm2xmlResult, Dcm2xmlCharsetValue } from './tools/dcm2xml';

export { dcm2json } from './tools/dcm2json';
export type { Dcm2jsonOptions, Dcm2jsonResult, Dcm2jsonSource, DicomJsonModel } from './tools/dcm2json';

export { dcmdump, DcmdumpFormat } from './tools/dcmdump';
export type { DcmdumpOptions, DcmdumpResult, DcmdumpFormatValue } from './tools/dcmdump';

export { dcmconv, TransferSyntax } from './tools/dcmconv';
export type { DcmconvOptions, DcmconvResult, TransferSyntaxValue } from './tools/dcmconv';

export { dcmodify } from './tools/dcmodify';
export type { DcmodifyOptions, DcmodifyResult, TagModification } from './tools/dcmodify';

export { echoscu } from './tools/echoscu';
export type { EchoscuOptions, EchoscuResult } from './tools/echoscu';

export { dcmsend } from './tools/dcmsend';
export type { DcmsendOptions, DcmsendResult } from './tools/dcmsend';

// Shared tool types
export type { ToolBaseOptions } from './tools/_toolTypes';
export type { DicomJsonElement } from './tools/_xmlToJson';

// DICOM VR definitions (Phase 5.3)
export { VR, VR_CATEGORY, VR_CATEGORY_NAME, VR_META, isStringVR, isNumericVR, isBinaryVR, getVRCategory } from './dicom/vr';
export type { VRValue, VRCategoryName, VRMetadata } from './dicom/vr';

// DICOM dictionary (Phase 5.3)
export { lookupTag, lookupTagByName, lookupTagByKeyword } from './dicom/dictionary';
export type { DictionaryEntry } from './dicom/dictionary';

// SOP Classes (Phase 5.4)
export { SOP_CLASSES, sopClassNameFromUID } from './data/sopClasses';
export type { SOPClassName } from './data/sopClasses';

// Tag path utilities (Phase 5.2)
export { tagPathToSegments, segmentsToModifyPath, segmentsToString } from './dicom/tagPath';
export type { TagSegment } from './dicom/tagPath';

// DICOM dataset (Phase 5.5)
export { DicomDataset } from './dicom/DicomDataset';
