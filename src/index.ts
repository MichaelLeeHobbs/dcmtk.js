// ---------------------------------------------------------------------------
// Core: Result pattern, branded types, validation, constants
// ---------------------------------------------------------------------------

// Result pattern
export { ok, err, assertUnreachable } from './types';
export type { Result, DcmtkProcessResult, ExecOptions, SpawnOptions, LineSource, ProcessLine } from './types';

// Branded types + factories
export { createDicomTag, createAETitle, createDicomTagPath, createSOPClassUID, createTransferSyntaxUID, createDicomFilePath, createPort } from './brands';
export type { Brand, DicomTag, AETitle, DicomTagPath, SOPClassUID, TransferSyntaxUID, DicomFilePath, Port } from './brands';

// Validation schemas + parsers
export { AETitleSchema, PortSchema, DicomTagSchema, DicomTagPathSchema, UIDSchema } from './validation';
export { parseAETitle, parsePort, parseDicomTag, parseDicomTagPath, parseSOPClassUID, parseTransferSyntaxUID } from './validation';

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

// ---------------------------------------------------------------------------
// Infrastructure: path discovery, process execution, output parsing
// ---------------------------------------------------------------------------

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

// Shared tool types
export type { ToolBaseOptions } from './tools/_toolTypes';
export type { DicomJsonElement } from './tools/_xmlToJson';

// ---------------------------------------------------------------------------
// DICOM data layer
// ---------------------------------------------------------------------------

// VR definitions
export { VR, VR_CATEGORY, VR_CATEGORY_NAME, VR_META, isStringVR, isNumericVR, isBinaryVR, getVRCategory } from './dicom/vr';
export type { VRValue, VRCategoryName, VRMetadata } from './dicom/vr';

// Dictionary
export { lookupTag, lookupTagByName, lookupTagByKeyword } from './dicom/dictionary';
export type { DictionaryEntry } from './dicom/dictionary';

// SOP Classes
export { SOP_CLASSES, sopClassNameFromUID } from './data/sopClasses';
export type { SOPClassName } from './data/sopClasses';

// Tag path utilities
export { tagPathToSegments, segmentsToModifyPath, segmentsToString } from './dicom/tagPath';
export type { TagSegment } from './dicom/tagPath';

// Dataset, ChangeSet, File I/O
export { DicomDataset } from './dicom/DicomDataset';
export { ChangeSet } from './dicom/ChangeSet';
export { DicomFile } from './dicom/DicomFile';
export type { DicomFileOptions } from './dicom/DicomFile';
export { xmlToJson } from './dicom/xmlToJson';

// ---------------------------------------------------------------------------
// Short-lived tool wrappers — Data & Metadata
// ---------------------------------------------------------------------------

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

export { dcmftest } from './tools/dcmftest';
export type { DcmftestOptions, DcmftestResult } from './tools/dcmftest';

export { dcmgpdir } from './tools/dcmgpdir';
export type { DcmgpdirOptions, DcmgpdirResult } from './tools/dcmgpdir';

export { dcmmkdir } from './tools/dcmmkdir';
export type { DcmmkdirOptions, DcmmkdirResult } from './tools/dcmmkdir';

export { dcmqridx } from './tools/dcmqridx';
export type { DcmqridxOptions, DcmqridxResult } from './tools/dcmqridx';

// ---------------------------------------------------------------------------
// Short-lived tool wrappers — File Conversion
// ---------------------------------------------------------------------------

export { xml2dcm } from './tools/xml2dcm';
export type { Xml2dcmOptions, Xml2dcmResult } from './tools/xml2dcm';

export { json2dcm } from './tools/json2dcm';
export type { Json2dcmOptions, Json2dcmResult } from './tools/json2dcm';

export { dump2dcm } from './tools/dump2dcm';
export type { Dump2dcmOptions, Dump2dcmResult } from './tools/dump2dcm';

export { img2dcm, Img2dcmInputFormat } from './tools/img2dcm';
export type { Img2dcmOptions, Img2dcmResult, Img2dcmInputFormatValue } from './tools/img2dcm';

export { pdf2dcm } from './tools/pdf2dcm';
export type { Pdf2dcmOptions, Pdf2dcmResult } from './tools/pdf2dcm';

export { dcm2pdf } from './tools/dcm2pdf';
export type { Dcm2pdfOptions, Dcm2pdfResult } from './tools/dcm2pdf';

export { cda2dcm } from './tools/cda2dcm';
export type { Cda2dcmOptions, Cda2dcmResult } from './tools/cda2dcm';

export { dcm2cda } from './tools/dcm2cda';
export type { Dcm2cdaOptions, Dcm2cdaResult } from './tools/dcm2cda';

export { stl2dcm } from './tools/stl2dcm';
export type { Stl2dcmOptions, Stl2dcmResult } from './tools/stl2dcm';

// ---------------------------------------------------------------------------
// Short-lived tool wrappers — Compression & Encoding
// ---------------------------------------------------------------------------

export { dcmcrle } from './tools/dcmcrle';
export type { DcmcrleOptions, DcmcrleResult } from './tools/dcmcrle';

export { dcmdrle } from './tools/dcmdrle';
export type { DcmdrleOptions, DcmdrleResult } from './tools/dcmdrle';

export { dcmencap } from './tools/dcmencap';
export type { DcmencapOptions, DcmencapResult } from './tools/dcmencap';

export { dcmdecap } from './tools/dcmdecap';
export type { DcmdecapOptions, DcmdecapResult } from './tools/dcmdecap';

export { dcmcjpeg } from './tools/dcmcjpeg';
export type { DcmcjpegOptions, DcmcjpegResult } from './tools/dcmcjpeg';

export { dcmdjpeg, ColorConversion } from './tools/dcmdjpeg';
export type { DcmdjpegOptions, DcmdjpegResult, ColorConversionValue } from './tools/dcmdjpeg';

export { dcmcjpls } from './tools/dcmcjpls';
export type { DcmcjplsOptions, DcmcjplsResult } from './tools/dcmcjpls';

export { dcmdjpls, JplsColorConversion } from './tools/dcmdjpls';
export type { DcmdjplsOptions, DcmdjplsResult, JplsColorConversionValue } from './tools/dcmdjpls';

// ---------------------------------------------------------------------------
// Short-lived tool wrappers — Image Processing
// ---------------------------------------------------------------------------

export { dcmj2pnm, Dcmj2pnmOutputFormat } from './tools/dcmj2pnm';
export type { Dcmj2pnmOptions, Dcmj2pnmResult, Dcmj2pnmOutputFormatValue } from './tools/dcmj2pnm';

export { dcm2pnm, Dcm2pnmOutputFormat } from './tools/dcm2pnm';
export type { Dcm2pnmOptions, Dcm2pnmResult, Dcm2pnmOutputFormatValue } from './tools/dcm2pnm';

export { dcmscale } from './tools/dcmscale';
export type { DcmscaleOptions, DcmscaleResult } from './tools/dcmscale';

export { dcmquant } from './tools/dcmquant';
export type { DcmquantOptions, DcmquantResult } from './tools/dcmquant';

export { dcmdspfn } from './tools/dcmdspfn';
export type { DcmdspfnOptions, DcmdspfnResult } from './tools/dcmdspfn';

export { dcod2lum } from './tools/dcod2lum';
export type { Dcod2lumOptions, Dcod2lumResult } from './tools/dcod2lum';

export { dconvlum } from './tools/dconvlum';
export type { DconvlumOptions, DconvlumResult } from './tools/dconvlum';

// ---------------------------------------------------------------------------
// Short-lived tool wrappers — Network
// ---------------------------------------------------------------------------

export { echoscu } from './tools/echoscu';
export type { EchoscuOptions, EchoscuResult } from './tools/echoscu';

export { dcmsend } from './tools/dcmsend';
export type { DcmsendOptions, DcmsendResult } from './tools/dcmsend';

export { storescu } from './tools/storescu';
export type { StorescuOptions, StorescuResult } from './tools/storescu';

export { findscu, QueryModel } from './tools/findscu';
export type { FindscuOptions, FindscuResult, QueryModelValue } from './tools/findscu';

export { movescu, MoveQueryModel } from './tools/movescu';
export type { MovescuOptions, MovescuResult, MoveQueryModelValue } from './tools/movescu';

export { getscu, GetQueryModel } from './tools/getscu';
export type { GetscuOptions, GetscuResult, GetQueryModelValue } from './tools/getscu';

export { termscu } from './tools/termscu';
export type { TermscuOptions, TermscuResult } from './tools/termscu';

// ---------------------------------------------------------------------------
// Short-lived tool wrappers — Structured Reports
// ---------------------------------------------------------------------------

export { dsrdump } from './tools/dsrdump';
export type { DsrdumpOptions, DsrdumpResult } from './tools/dsrdump';

export { dsr2xml } from './tools/dsr2xml';
export type { Dsr2xmlOptions, Dsr2xmlResult } from './tools/dsr2xml';

export { xml2dsr } from './tools/xml2dsr';
export type { Xml2dsrOptions, Xml2dsrResult } from './tools/xml2dsr';

export { drtdump } from './tools/drtdump';
export type { DrtdumpOptions, DrtdumpResult } from './tools/drtdump';

// ---------------------------------------------------------------------------
// Short-lived tool wrappers — Presentation State & Print
// ---------------------------------------------------------------------------

export { dcmpsmk } from './tools/dcmpsmk';
export type { DcmpsmkOptions, DcmpsmkResult } from './tools/dcmpsmk';

export { dcmpschk } from './tools/dcmpschk';
export type { DcmpschkOptions, DcmpschkResult } from './tools/dcmpschk';

export { dcmprscu } from './tools/dcmprscu';
export type { DcmprscuOptions, DcmprscuResult } from './tools/dcmprscu';

export { dcmpsprt } from './tools/dcmpsprt';
export type { DcmpsprtOptions, DcmpsprtResult } from './tools/dcmpsprt';

export { dcmp2pgm } from './tools/dcmp2pgm';
export type { Dcmp2pgmOptions, Dcmp2pgmResult } from './tools/dcmp2pgm';

export { dcmmkcrv } from './tools/dcmmkcrv';
export type { DcmmkcrvOptions, DcmmkcrvResult } from './tools/dcmmkcrv';

export { dcmmklut, LutType } from './tools/dcmmklut';
export type { DcmmklutOptions, DcmmklutResult, LutTypeValue } from './tools/dcmmklut';

// ---------------------------------------------------------------------------
// Event definitions (for long-lived servers)
// ---------------------------------------------------------------------------

export { DcmrecvEvent, DCMRECV_PATTERNS, DCMRECV_FATAL_EVENTS } from './events/dcmrecv';
export type {
    DcmrecvEventValue,
    AssociationReceivedData,
    AssociationAcknowledgedData,
    CStoreRequestData,
    StoredFileData,
    RefusingAssociationData,
    CannotStartListenerData,
} from './events/dcmrecv';

export { StorescpEvent, STORESCP_PATTERNS, STORESCP_FATAL_EVENTS } from './events/storescp';
export type { StorescpEventValue, StoringFileData, SubdirectoryCreatedData } from './events/storescp';

export { DcmprscpEvent, DCMPRSCP_PATTERNS, DCMPRSCP_FATAL_EVENTS } from './events/dcmprscp';
export type {
    DcmprscpEventValue,
    DatabaseReadyData,
    PrintAssociationReceivedData,
    PrintAssociationAcknowledgedData,
    PrintCannotStartListenerData,
    ConfigErrorData,
} from './events/dcmprscp';

export { DcmpsrcvEvent, DCMPSRCV_PATTERNS, DCMPSRCV_FATAL_EVENTS } from './events/dcmpsrcv';
export type {
    DcmpsrcvEventValue,
    ReceiverListeningData,
    ReceiverDatabaseReadyData,
    ReceiverAssociationReceivedData,
    ReceiverAssociationAcknowledgedData,
    ReceiverEchoRequestData,
    ReceiverCStoreRequestData,
    FileDeletedData,
    ReceiverCannotStartListenerData,
    ReceiverConfigErrorData,
} from './events/dcmpsrcv';

export { DcmqrscpEvent, DCMQRSCP_PATTERNS, DCMQRSCP_FATAL_EVENTS } from './events/dcmqrscp';
export type {
    DcmqrscpEventValue,
    QRListeningData,
    QRAssociationReceivedData,
    QRAssociationAcknowledgedData,
    QRCFindRequestData,
    QRCMoveRequestData,
    QRCGetRequestData,
    QRCStoreRequestData,
    QRCannotStartListenerData,
} from './events/dcmqrscp';

export { WlmscpfsEvent, WLMSCPFS_PATTERNS, WLMSCPFS_FATAL_EVENTS } from './events/wlmscpfs';
export type {
    WlmscpfsEventValue,
    WlmListeningData,
    WlmAssociationReceivedData,
    WlmAssociationAcknowledgedData,
    WlmCFindRequestData,
    WlmCannotStartListenerData,
} from './events/wlmscpfs';

// ---------------------------------------------------------------------------
// Long-lived server classes
// ---------------------------------------------------------------------------

export { Dcmrecv, SubdirectoryMode, FilenameMode, StorageMode } from './servers/Dcmrecv';
export type { DcmrecvOptions, DcmrecvEventMap, SubdirectoryModeValue, FilenameModeValue, StorageModeValue } from './servers/Dcmrecv';

export { StoreSCP, PreferredTransferSyntax } from './servers/StoreSCP';
export type { StoreSCPOptions, StoreSCPEventMap, PreferredTransferSyntaxValue } from './servers/StoreSCP';

export { DcmprsCP } from './servers/DcmprsCP';
export type { DcmprsCPOptions, DcmprsCPEventMap } from './servers/DcmprsCP';

export { Dcmpsrcv } from './servers/Dcmpsrcv';
export type { DcmpsrcvOptions, DcmpsrcvEventMap } from './servers/Dcmpsrcv';

export { DcmQRSCP } from './servers/DcmQRSCP';
export type { DcmQRSCPOptions, DcmQRSCPEventMap } from './servers/DcmQRSCP';

export { Wlmscpfs } from './servers/Wlmscpfs';
export type { WlmscpfsOptions, WlmscpfsEventMap } from './servers/Wlmscpfs';
