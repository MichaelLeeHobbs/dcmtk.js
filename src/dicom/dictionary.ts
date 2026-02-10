/**
 * DICOM tag dictionary with O(1) lookup by tag and lazy reverse lookup by name.
 *
 * Uses the shipped `src/data/dictionary.json` generated from `_configs/dicom.dic.json`.
 *
 * @module dicom/dictionary
 */

import type { DicomTag } from '../brands';
import { createDicomTag } from '../brands';
import type { VRValue } from './vr';
import dictionaryData from '../data/dictionary.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry from the DICOM data dictionary. */
interface DictionaryEntry {
    /** The Value Representation code (e.g. "PN", "LO", "US"). */
    readonly vr: VRValue;
    /** The standard keyword name (e.g. "PatientName"). */
    readonly name: string;
    /** Value multiplicity as [min, max], where max is null if unbounded. */
    readonly vm: readonly [number, number | null];
    /** Whether this tag is retired in the current DICOM standard. */
    readonly retired: boolean;
}

// ---------------------------------------------------------------------------
// Dictionary data (typed)
// ---------------------------------------------------------------------------

/** Raw dictionary keyed by 8-char uppercase hex (e.g. "00100010"). */
const dictionary = dictionaryData as unknown as Readonly<Record<string, DictionaryEntry>>;

// ---------------------------------------------------------------------------
// Forward lookup (by tag)
// ---------------------------------------------------------------------------

/**
 * Looks up a DICOM tag in the data dictionary.
 *
 * Accepts tags in either branded `DicomTag` format `"(0010,0010)"` or
 * raw 8-char hex format `"00100010"`.
 *
 * @param tag - A DicomTag or 8-char hex string
 * @returns The dictionary entry, or undefined if the tag is not in the dictionary
 */
function lookupTag(tag: DicomTag | string): DictionaryEntry | undefined {
    // Strip parens and comma: "(0010,0010)" → "00100010"
    const key = tag.includes(',') ? tag.replace(/[(),]/g, '') : tag;
    return dictionary[key.toUpperCase()];
}

// ---------------------------------------------------------------------------
// Reverse lookup (by name — lazily built)
// ---------------------------------------------------------------------------

let nameIndex: ReadonlyMap<string, { readonly tag: string; readonly entry: DictionaryEntry }> | undefined;

function buildNameIndex(): ReadonlyMap<string, { readonly tag: string; readonly entry: DictionaryEntry }> {
    const map = new Map<string, { readonly tag: string; readonly entry: DictionaryEntry }>();
    const keys = Object.keys(dictionary);
    for (const key of keys) {
        const entry = dictionary[key];
        /* v8 ignore next */
        if (entry === undefined) continue;
        map.set(entry.name, { tag: key, entry });
    }
    return map;
}

function getNameIndex(): ReadonlyMap<string, { readonly tag: string; readonly entry: DictionaryEntry }> {
    if (nameIndex === undefined) {
        nameIndex = buildNameIndex();
    }
    return nameIndex;
}

/**
 * Looks up a DICOM tag by its standard keyword name.
 *
 * @param name - The standard keyword (e.g. "PatientName", "Modality")
 * @returns An object with the 8-char hex tag and dictionary entry, or undefined
 */
function lookupTagByName(name: string): { readonly tag: string; readonly entry: DictionaryEntry } | undefined {
    return getNameIndex().get(name);
}

/**
 * Looks up a DICOM tag by its standard keyword, returning just the branded DicomTag.
 *
 * @param keyword - The standard keyword (e.g. "PatientName")
 * @returns The DicomTag in `(XXXX,XXXX)` format, or undefined if not found
 */
function lookupTagByKeyword(keyword: string): DicomTag | undefined {
    const found = getNameIndex().get(keyword);
    if (found === undefined) return undefined;

    const hex = found.tag;
    const group = hex.slice(0, 4);
    const element = hex.slice(4, 8);
    const result = createDicomTag(`(${group},${element})`);
    /* v8 ignore next */
    if (!result.ok) return undefined;
    return result.value;
}

export { lookupTag, lookupTagByName, lookupTagByKeyword };
export type { DictionaryEntry };
