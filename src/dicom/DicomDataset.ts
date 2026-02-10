/**
 * Immutable DICOM dataset wrapper with type-safe accessors.
 *
 * Wraps DICOM JSON Model data (PS3.18 F.2) from dcm2json/dcm2xml with
 * convenient read-only accessors. No setters — mutations go through ChangeSet.
 *
 * @module dicom/DicomDataset
 */

import type { DicomTag, DicomTagPath, SOPClassUID } from '../brands';
import { createSOPClassUID } from '../brands';
import { MAX_TRAVERSAL_DEPTH } from '../constants';
import type { Result } from '../types';
import { ok, err } from '../types';
import type { TagSegment } from './tagPath';
import { tagPathToSegments } from './tagPath';
import type { DicomJsonElement, DicomJsonModel } from '../tools/_xmlToJson';

// ---------------------------------------------------------------------------
// Tag normalization
// ---------------------------------------------------------------------------

const TAG_WITH_PARENS = /^\(([0-9A-Fa-f]{4}),([0-9A-Fa-f]{4})\)$/;
const TAG_HEX_ONLY = /^[0-9A-Fa-f]{8}$/;

/**
 * Normalizes a DICOM tag to 8-char uppercase hex.
 * Accepts `(0010,0010)` or `00100010` formats.
 */
function normalizeTag(tag: DicomTag | string): Result<string> {
    const parenMatch = TAG_WITH_PARENS.exec(tag);
    if (parenMatch !== null) {
        const group = parenMatch[1];
        const element = parenMatch[2];
        /* v8 ignore next */
        if (group === undefined || element === undefined) return err(new Error(`Invalid tag: "${tag}"`));
        return ok(`${group}${element}`.toUpperCase());
    }
    if (TAG_HEX_ONLY.test(tag)) {
        return ok(tag.toUpperCase());
    }
    return err(new Error(`Invalid tag format: "${tag}". Expected (XXXX,XXXX) or XXXXXXXX`));
}

// ---------------------------------------------------------------------------
// Element extraction helpers
// ---------------------------------------------------------------------------

/** Resolves an element from the data by normalized tag key. */
function resolveElement(data: DicomJsonModel, tagKey: string): DicomJsonElement | undefined {
    return data[tagKey];
}

/** Extracts the Alphabetic component from a PN (PersonName) value. */
function extractPNAlphabetic(first: unknown): string {
    if (typeof first !== 'object' || first === null) return '';
    const pn = first as Record<string, unknown>;
    const alphabetic = pn['Alphabetic'];
    return typeof alphabetic === 'string' ? alphabetic : '';
}

/** Converts a primitive value to string. */
function primitiveToString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

/** Extracts a string from a DicomJsonElement, handling PN values. */
function extractString(element: DicomJsonElement): string {
    const values = element.Value;
    if (values === undefined || values.length === 0) return '';

    const first = values[0];
    if (first === undefined || first === null) return '';

    if (element.vr === 'PN') return extractPNAlphabetic(first);
    return primitiveToString(first);
}

/** Extracts a number from a DicomJsonElement with validation. */
function extractNumber(element: DicomJsonElement): Result<number> {
    const values = element.Value;
    if (values === undefined || values.length === 0) {
        return err(new Error('Element has no Value array'));
    }
    const first = values[0];
    if (typeof first === 'number') return ok(first);
    if (typeof first === 'string') {
        const parsed = Number(first);
        if (Number.isNaN(parsed)) {
            return err(new Error(`Cannot convert "${first}" to number`));
        }
        return ok(parsed);
    }
    return err(new Error(`Value is not numeric: ${typeof first}`));
}

/** Extracts all values as strings from a DicomJsonElement. */
function extractStrings(element: DicomJsonElement): ReadonlyArray<string> {
    const values = element.Value;
    if (values === undefined) return [];
    const result: string[] = [];
    for (const v of values) {
        if (typeof v === 'string') {
            result.push(v);
        } else if (typeof v === 'number' || typeof v === 'boolean') {
            result.push(String(v));
        } else {
            result.push('');
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Path traversal helpers (iterative, no recursion — Rule 8.2)
// ---------------------------------------------------------------------------

/** Gets the sequence items array from a DicomJsonElement. */
function getSequenceItems(element: DicomJsonElement): ReadonlyArray<unknown> | undefined {
    if (element.vr !== 'SQ' || element.Value === undefined) return undefined;
    return element.Value;
}

/** Descends into a sequence item, returning the nested dataset or an error. */
function descendIntoSequence(element: DicomJsonElement, seg: TagSegment): Result<DicomJsonModel> {
    const items = getSequenceItems(element);
    if (items === undefined) {
        return err(new Error(`Tag ${seg.tag} is not a sequence`));
    }
    const idx = seg.index ?? 0;
    const item = items[idx];
    if (item === undefined || typeof item !== 'object' || item === null) {
        return err(new Error(`Sequence ${seg.tag} has no item at index ${idx}`));
    }
    return ok(item as DicomJsonModel);
}

/** Traverses a non-wildcard path iteratively through nested sequences. */
function traversePath(data: DicomJsonModel, segments: ReadonlyArray<TagSegment>): Result<DicomJsonElement> {
    let current: DicomJsonModel = data;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        /* v8 ignore next */
        if (seg === undefined) return err(new Error('Unexpected undefined segment'));

        const tagResult = normalizeTag(seg.tag);
        if (!tagResult.ok) return err(tagResult.error);

        const element = resolveElement(current, tagResult.value);
        if (element === undefined) return err(new Error(`Tag ${seg.tag} not found`));

        if (i === segments.length - 1) return ok(element);

        const descent = descendIntoSequence(element, seg);
        if (!descent.ok) return err(descent.error);
        current = descent.value;
    }

    /* v8 ignore next */
    return err(new Error('Empty path segments'));
}

// ---------------------------------------------------------------------------
// Wildcard collection (iterative queue — Rule 8.2)
// ---------------------------------------------------------------------------

interface QueueEntry {
    readonly data: DicomJsonModel;
    readonly segmentIndex: number;
}

/** Collects all values matching a wildcard path using an iterative BFS queue. */
function collectWildcard(data: DicomJsonModel, segments: ReadonlyArray<TagSegment>): ReadonlyArray<unknown> {
    const results: unknown[] = [];
    const queue: QueueEntry[] = [{ data, segmentIndex: 0 }];

    for (let iteration = 0; iteration < MAX_TRAVERSAL_DEPTH * 100 && queue.length > 0; iteration++) {
        const entry = queue.shift();
        /* v8 ignore next */
        if (entry === undefined) break;
        processQueueEntry(entry, segments, results, queue);
    }

    return results;
}

/** Processes a single queue entry for wildcard collection. */
function processQueueEntry(entry: QueueEntry, segments: ReadonlyArray<TagSegment>, results: unknown[], queue: QueueEntry[]): void {
    const seg = segments[entry.segmentIndex];
    /* v8 ignore next */
    if (seg === undefined) return;

    const tagResult = normalizeTag(seg.tag);
    if (!tagResult.ok) return;

    const element = resolveElement(entry.data, tagResult.value);
    if (element === undefined) return;

    const isLast = entry.segmentIndex === segments.length - 1;

    if (isLast) {
        collectLeafValues(element, results);
        return;
    }

    enqueueSequenceItems(element, seg, entry.segmentIndex, queue);
}

/** Collects values from a leaf element into the results array. */
function collectLeafValues(element: DicomJsonElement, results: unknown[]): void {
    if (element.Value !== undefined) {
        for (const v of element.Value) {
            results.push(v);
        }
    }
}

/** Enqueues child sequence items for further wildcard processing. */
function enqueueSequenceItems(element: DicomJsonElement, seg: TagSegment, segmentIndex: number, queue: QueueEntry[]): void {
    const items = getSequenceItems(element);
    if (items === undefined) return;

    if (seg.isWildcard === true) {
        for (const item of items) {
            if (typeof item === 'object' && item !== null) {
                queue.push({ data: item as DicomJsonModel, segmentIndex: segmentIndex + 1 });
            }
        }
    } else {
        const idx = seg.index ?? 0;
        const item = items[idx];
        if (typeof item === 'object' && item !== null) {
            queue.push({ data: item as DicomJsonModel, segmentIndex: segmentIndex + 1 });
        }
    }
}

// ---------------------------------------------------------------------------
// Well-known DICOM tag keys (8-char hex, uppercase)
// ---------------------------------------------------------------------------

const TAGS = {
    AccessionNumber: '00080050',
    PatientName: '00100010',
    PatientID: '00100020',
    StudyDate: '00080020',
    Modality: '00080060',
    SOPClassUID: '00080016',
    StudyInstanceUID: '0020000D',
    SeriesInstanceUID: '0020000E',
    SOPInstanceUID: '00080018',
    TransferSyntaxUID: '00020010',
} as const;

// ---------------------------------------------------------------------------
// DicomDataset class
// ---------------------------------------------------------------------------

/**
 * Immutable wrapper around DICOM JSON Model data.
 *
 * Provides type-safe read-only accessors for DICOM tag values.
 * Construct via the static {@link DicomDataset.fromJson} factory.
 *
 * @example
 * ```ts
 * const result = DicomDataset.fromJson(jsonData);
 * if (result.ok) {
 *     const ds = result.value;
 *     console.log(ds.patientName);
 *     console.log(ds.modality);
 * }
 * ```
 */
class DicomDataset {
    private readonly data: DicomJsonModel;

    private constructor(data: DicomJsonModel) {
        this.data = data;
    }

    /**
     * Creates a DicomDataset from a DICOM JSON Model object.
     *
     * Performs structural validation only — verifies the input is a non-null object.
     *
     * @param json - A DICOM JSON Model object (typically from dcm2json)
     * @returns A Result containing the DicomDataset or an error
     */
    static fromJson(json: unknown): Result<DicomDataset> {
        if (json === null || json === undefined || typeof json !== 'object' || Array.isArray(json)) {
            return err(new Error('Invalid DICOM JSON: expected a non-null, non-array object'));
        }
        return ok(new DicomDataset(json as DicomJsonModel));
    }

    /**
     * Gets the full DICOM JSON element for a tag.
     *
     * @param tag - A DicomTag `(0010,0010)` or hex string `00100010`
     * @returns Result containing the element or an error if not found
     */
    getElement(tag: DicomTag | string): Result<DicomJsonElement> {
        const norm = normalizeTag(tag);
        if (!norm.ok) return err(norm.error);
        const element = resolveElement(this.data, norm.value);
        if (element === undefined) return err(new Error(`Tag ${tag} not found`));
        return ok(element);
    }

    /**
     * Gets the Value array for a tag.
     *
     * @param tag - A DicomTag `(0010,0010)` or hex string `00100010`
     * @returns Result containing the readonly Value array or an error
     */
    getValue(tag: DicomTag | string): Result<ReadonlyArray<unknown>> {
        const elemResult = this.getElement(tag);
        if (!elemResult.ok) return err(elemResult.error);
        const values = elemResult.value.Value;
        if (values === undefined) return err(new Error(`Tag ${tag} has no Value`));
        return ok(values);
    }

    /**
     * Gets the first element of the Value array for a tag.
     *
     * @param tag - A DicomTag `(0010,0010)` or hex string `00100010`
     * @returns Result containing the first value or an error
     */
    getFirstValue(tag: DicomTag | string): Result<unknown> {
        const valResult = this.getValue(tag);
        if (!valResult.ok) return err(valResult.error);
        const first = valResult.value[0];
        if (first === undefined) return err(new Error(`Tag ${tag} Value array is empty`));
        return ok(first);
    }

    /**
     * Gets a tag value as a string with optional fallback.
     *
     * Returns the fallback (default empty string) if the tag is missing or has no value.
     * Handles PN (PersonName) values by extracting the Alphabetic component.
     *
     * @param tag - A DicomTag `(0010,0010)` or hex string `00100010`
     * @param fallback - Value to return if tag is missing (default: `''`)
     * @returns The string value or the fallback
     */
    getString(tag: DicomTag | string, fallback = ''): string {
        const elemResult = this.getElement(tag);
        if (!elemResult.ok) return fallback;
        const str = extractString(elemResult.value);
        return str.length > 0 ? str : fallback;
    }

    /**
     * Gets a tag value as a validated number.
     *
     * @param tag - A DicomTag `(0010,0010)` or hex string `00100010`
     * @returns Result containing the number or an error
     */
    getNumber(tag: DicomTag | string): Result<number> {
        const elemResult = this.getElement(tag);
        if (!elemResult.ok) return err(elemResult.error);
        return extractNumber(elemResult.value);
    }

    /**
     * Gets all values of a tag as strings.
     *
     * Useful for multi-valued tags like CS (Code String).
     *
     * @param tag - A DicomTag `(0010,0010)` or hex string `00100010`
     * @returns Result containing the readonly string array or an error
     */
    getStrings(tag: DicomTag | string): Result<ReadonlyArray<string>> {
        const elemResult = this.getElement(tag);
        if (!elemResult.ok) return err(elemResult.error);
        return ok(extractStrings(elemResult.value));
    }

    /**
     * Checks whether a tag exists in the dataset.
     *
     * @param tag - A DicomTag `(0010,0010)` or hex string `00100010`
     * @returns `true` if the tag is present
     */
    hasTag(tag: DicomTag | string): boolean {
        const norm = normalizeTag(tag);
        if (!norm.ok) return false;
        return resolveElement(this.data, norm.value) !== undefined;
    }

    /**
     * Gets an element by traversing a dotted tag path through sequences.
     *
     * @param path - A branded DicomTagPath, e.g. `(0040,A730)[0].(0040,A160)`
     * @returns Result containing the element at the path or an error
     */
    getElementAtPath(path: DicomTagPath): Result<DicomJsonElement> {
        const segments = tagPathToSegments(path);
        return traversePath(this.data, segments);
    }

    /**
     * Finds all values matching a path with wildcard `[*]` indices.
     *
     * Traverses all items in wildcard sequence positions using an iterative BFS queue.
     *
     * @param path - A branded DicomTagPath, e.g. `(0040,A730)[*].(0040,A160)`
     * @returns A readonly array of all matching values (may be empty)
     */
    findValues(path: DicomTagPath): ReadonlyArray<unknown> {
        const segments = tagPathToSegments(path);
        return collectWildcard(this.data, segments);
    }

    // -----------------------------------------------------------------------
    // Convenience readonly getters
    // -----------------------------------------------------------------------

    /** Accession Number (0008,0050). */
    get accession(): string {
        return this.getString(TAGS.AccessionNumber);
    }

    /** Patient's Name (0010,0010). */
    get patientName(): string {
        return this.getString(TAGS.PatientName);
    }

    /** Patient ID (0010,0020). */
    get patientID(): string {
        return this.getString(TAGS.PatientID);
    }

    /** Study Date (0008,0020). */
    get studyDate(): string {
        return this.getString(TAGS.StudyDate);
    }

    /** Modality (0008,0060). */
    get modality(): string {
        return this.getString(TAGS.Modality);
    }

    /** SOP Class UID (0008,0016) as a branded SOPClassUID, or undefined if missing/invalid. */
    get sopClassUID(): SOPClassUID | undefined {
        const uid = this.getString(TAGS.SOPClassUID);
        if (uid.length === 0) return undefined;
        const result = createSOPClassUID(uid);
        return result.ok ? result.value : undefined;
    }

    /** Study Instance UID (0020,000D). */
    get studyInstanceUID(): string {
        return this.getString(TAGS.StudyInstanceUID);
    }

    /** Series Instance UID (0020,000E). */
    get seriesInstanceUID(): string {
        return this.getString(TAGS.SeriesInstanceUID);
    }

    /** SOP Instance UID (0008,0018). */
    get sopInstanceUID(): string {
        return this.getString(TAGS.SOPInstanceUID);
    }

    /** Transfer Syntax UID (0002,0010). */
    get transferSyntaxUID(): string {
        return this.getString(TAGS.TransferSyntaxUID);
    }
}

export { DicomDataset };
