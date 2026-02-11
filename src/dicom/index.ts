// ---------------------------------------------------------------------------
// DICOM data layer barrel export
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// VR definitions
// ---------------------------------------------------------------------------

export { VR, VR_CATEGORY, VR_CATEGORY_NAME, VR_META, isStringVR, isNumericVR, isBinaryVR, getVRCategory } from './vr';
export type { VRValue, VRCategoryName, VRMetadata } from './vr';

// ---------------------------------------------------------------------------
// Dictionary
// ---------------------------------------------------------------------------

export { lookupTag, lookupTagByName, lookupTagByKeyword } from './dictionary';
export type { DictionaryEntry } from './dictionary';

// ---------------------------------------------------------------------------
// Tag path utilities
// ---------------------------------------------------------------------------

export { tagPathToSegments, segmentsToModifyPath, segmentsToString } from './tagPath';
export type { TagSegment } from './tagPath';

// ---------------------------------------------------------------------------
// Dataset, ChangeSet, File I/O
// ---------------------------------------------------------------------------

export { DicomDataset } from './DicomDataset';
export { ChangeSet } from './ChangeSet';
export { DicomFile } from './DicomFile';
export type { DicomFileOptions } from './DicomFile';
export { xmlToJson } from './xmlToJson';

// ---------------------------------------------------------------------------
// SOP Classes
// ---------------------------------------------------------------------------

export { SOP_CLASSES, sopClassNameFromUID } from '../data/sopClasses';
export type { SOPClassName } from '../data/sopClasses';
