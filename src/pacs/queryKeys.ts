/**
 * Maps high-level filter objects to findscu -k arguments.
 *
 * Each builder adds the appropriate QueryRetrieveLevel, filter keys with
 * values, and return keys with empty values for requesting data back.
 *
 * @module pacs/queryKeys
 */

import type { StudyFilter, SeriesFilter, ImageFilter, WorklistFilter } from './types';

// ---------------------------------------------------------------------------
// Tag constant map: filter field name → DICOM tag
// ---------------------------------------------------------------------------

/** Maps filter property names to their DICOM tag strings. */
const FILTER_TAG_MAP: Readonly<Record<string, string>> = {
    patientId: '0010,0020',
    patientName: '0010,0010',
    studyDate: '0008,0020',
    accessionNumber: '0008,0050',
    modality: '0008,0060',
    studyInstanceUID: '0020,000d',
    studyDescription: '0008,1030',
    seriesNumber: '0020,0011',
    seriesInstanceUID: '0020,000e',
    seriesDescription: '0008,103e',
    instanceNumber: '0020,0013',
    sopInstanceUID: '0008,0018',
    sopClassUID: '0008,0016',
};

// ---------------------------------------------------------------------------
// Return key sets per query level
// ---------------------------------------------------------------------------

/** Tags requested back for study-level queries (empty value = return key). */
const STUDY_RETURN_KEYS: readonly string[] = [
    '0010,0010', // PatientName
    '0010,0020', // PatientID
    '0008,0020', // StudyDate
    '0008,0030', // StudyTime
    '0008,0050', // AccessionNumber
    '0008,0060', // ModalitiesInStudy
    '0008,1030', // StudyDescription
    '0020,000d', // StudyInstanceUID
    '0020,0010', // StudyID
    '0020,1206', // NumberOfStudyRelatedSeries
    '0020,1208', // NumberOfStudyRelatedInstances
];

/** Tags requested back for series-level queries. */
const SERIES_RETURN_KEYS: readonly string[] = [
    '0020,000e', // SeriesInstanceUID
    '0008,0060', // Modality
    '0020,0011', // SeriesNumber
    '0008,103e', // SeriesDescription
    '0020,1209', // NumberOfSeriesRelatedInstances
];

/** Tags requested back for image-level queries. */
const IMAGE_RETURN_KEYS: readonly string[] = [
    '0008,0018', // SOPInstanceUID
    '0008,0016', // SOPClassUID
    '0020,0013', // InstanceNumber
    '0028,0010', // Rows
    '0028,0011', // Columns
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Adds filter keys with values from a filter object.
 * Only adds keys for defined, non-undefined filter fields.
 */
function addFilterKeys(keys: string[], filter: object): void {
    const fields = Object.keys(filter);
    for (let i = 0; i < fields.length; i += 1) {
        const field = fields[i];
        /* v8 ignore next */
        if (field === undefined) continue;
        const tag = FILTER_TAG_MAP[field];
        /* v8 ignore next */
        if (tag === undefined) continue;
        const value = (filter as Record<string, unknown>)[field];
        /* v8 ignore next */
        if (typeof value !== 'string') continue;
        keys.push(`${tag}=${value}`);
    }
}

/**
 * Adds return keys that are not already present as filter keys.
 * Uses tag prefix matching to avoid duplicating tags.
 */
function addReturnKeys(keys: string[], returnKeys: readonly string[]): void {
    for (let i = 0; i < returnKeys.length; i += 1) {
        const tag = returnKeys[i];
        /* v8 ignore next */
        if (tag === undefined) continue;
        const alreadyPresent = keys.some(k => k.startsWith(tag));
        if (!alreadyPresent) {
            keys.push(`${tag}=`);
        }
    }
}

// ---------------------------------------------------------------------------
// Public builders
// ---------------------------------------------------------------------------

/**
 * Builds C-FIND keys for a study-level query.
 *
 * @param filter - Study filter criteria
 * @returns Array of -k argument strings for findscu
 */
function buildStudyKeys(filter: StudyFilter): readonly string[] {
    const keys: string[] = ['0008,0052=STUDY'];
    addFilterKeys(keys, filter);
    addReturnKeys(keys, STUDY_RETURN_KEYS);
    return keys;
}

/**
 * Builds C-FIND keys for a series-level query.
 *
 * @param filter - Series filter criteria (studyInstanceUID required)
 * @returns Array of -k argument strings for findscu
 */
function buildSeriesKeys(filter: SeriesFilter): readonly string[] {
    const keys: string[] = ['0008,0052=SERIES'];
    addFilterKeys(keys, filter);
    addReturnKeys(keys, SERIES_RETURN_KEYS);
    return keys;
}

/**
 * Builds C-FIND keys for an image-level query.
 *
 * @param filter - Image filter criteria (studyInstanceUID + seriesInstanceUID required)
 * @returns Array of -k argument strings for findscu
 */
function buildImageKeys(filter: ImageFilter): readonly string[] {
    const keys: string[] = ['0008,0052=IMAGE'];
    addFilterKeys(keys, filter);
    addReturnKeys(keys, IMAGE_RETURN_KEYS);
    return keys;
}

/**
 * Builds C-FIND keys for a worklist query. Pass-through of raw keys.
 *
 * @param filter - Worklist filter with raw key strings
 * @returns Array of -k argument strings for findscu
 */
function buildWorklistKeys(filter: WorklistFilter): readonly string[] {
    return [...filter.keys];
}

export { FILTER_TAG_MAP, STUDY_RETURN_KEYS, SERIES_RETURN_KEYS, IMAGE_RETURN_KEYS, buildStudyKeys, buildSeriesKeys, buildImageKeys, buildWorklistKeys };
