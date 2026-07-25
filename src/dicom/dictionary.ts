/**
 * DICOM tag dictionary with O(1) lookup by tag and lazy reverse lookup by name.
 *
 * Uses the shipped `src/data/dictionary.json` generated from `_configs/dicom.dic`
 * (DCMTK's data dictionary) by `scripts/generateDictionary.ts`.
 *
 * @module dicom/dictionary
 */

import type { DicomTag } from '../brands';
import { createDicomTag } from '../brands';
import { assertUnreachable } from '../types';
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

/** Which values a repeating range covers within its bounds. */
const TagParity = {
    /** Every value in the range. */
    Any: 'any',
    /** Even values only — how standard repeating groups are defined. */
    Even: 'even',
    /** Odd values only. */
    Odd: 'odd',
} as const;

type TagParityValue = (typeof TagParity)[keyof typeof TagParity];

/** A repeating-group entry as stored in `dictionary.json` (hex bounds as strings). */
interface RawRepeatingEntry extends DictionaryEntry {
    readonly groupStart: string;
    readonly groupEnd: string;
    readonly groupParity: TagParityValue;
    readonly elementStart: string;
    readonly elementEnd: string;
    readonly elementParity: TagParityValue;
}

/** A repeating-group entry with numeric bounds, prepared once at module load. */
interface RepeatingRule {
    readonly groupStart: number;
    readonly groupEnd: number;
    readonly groupParity: TagParityValue;
    readonly elementStart: number;
    readonly elementEnd: number;
    readonly elementParity: TagParityValue;
    /** The lowest tag the rule covers, e.g. "60000010" for `(60xx,0010)`. */
    readonly baseTag: string;
    readonly entry: DictionaryEntry;
}

interface DictionaryFile {
    readonly exact: Readonly<Record<string, DictionaryEntry>>;
    readonly repeating: readonly RawRepeatingEntry[];
}

// ---------------------------------------------------------------------------
// Dictionary data (typed)
// ---------------------------------------------------------------------------

/**
 * Generated dictionary: exact tags keyed by 8-char uppercase hex, plus the
 * repeating-group ranges (overlays `(60xx,eeee)`, curves `(50xx,eeee)`, ...)
 * that the standard defines once for a whole family of tags.
 *
 * The double cast (`as unknown as`) is required because TypeScript infers the
 * JSON import as a generic object with `number[]` arrays and `string` parity
 * fields, not the specific tuple/union types this module requires.
 */
const dictionaryFile = dictionaryData as unknown as DictionaryFile;
const dictionary = dictionaryFile.exact;

const HEX_TAG = /^[0-9A-F]{8}$/;

function buildRepeatingRules(): readonly RepeatingRule[] {
    return dictionaryFile.repeating.map(raw => ({
        groupStart: parseInt(raw.groupStart, 16),
        groupEnd: parseInt(raw.groupEnd, 16),
        groupParity: raw.groupParity,
        elementStart: parseInt(raw.elementStart, 16),
        elementEnd: parseInt(raw.elementEnd, 16),
        elementParity: raw.elementParity,
        baseTag: `${raw.groupStart}${raw.elementStart}`,
        entry: { vr: raw.vr, name: raw.name, vm: raw.vm, retired: raw.retired },
    }));
}

const repeatingRules = buildRepeatingRules();

// ---------------------------------------------------------------------------
// Forward lookup (by tag)
// ---------------------------------------------------------------------------

function matchesParity(value: number, parity: TagParityValue): boolean {
    switch (parity) {
        case TagParity.Any:
            return true;
        case TagParity.Even:
            return (value & 1) === 0;
        /* v8 ignore start -- no generated entry carries odd parity today (the odd-group
           PRIVATE/ILLEGAL placeholders are dropped), and default is unreachable */
        case TagParity.Odd:
            return (value & 1) === 1;
        default:
            return assertUnreachable(parity);
        /* v8 ignore stop */
    }
}

function inRange(value: number, start: number, end: number, parity: TagParityValue): boolean {
    return value >= start && value <= end && matchesParity(value, parity);
}

/** Finds the repeating-group rule covering a tag, or undefined when none does. */
function findRepeatingRule(key: string): RepeatingRule | undefined {
    if (!HEX_TAG.test(key)) return undefined;

    const group = parseInt(key.slice(0, 4), 16);
    const element = parseInt(key.slice(4), 16);

    for (const rule of repeatingRules) {
        if (inRange(group, rule.groupStart, rule.groupEnd, rule.groupParity) && inRange(element, rule.elementStart, rule.elementEnd, rule.elementParity)) {
            return rule;
        }
    }
    return undefined;
}

/** Strips parens and comma, then uppercases: `"(0010,0010)"` → `"00100010"`. */
function normalizeKey(tag: DicomTag | string): string {
    const stripped = tag.includes(',') ? tag.replace(/[(),]/g, '') : tag;
    return stripped.toUpperCase();
}

/**
 * Looks up a DICOM tag in the data dictionary.
 *
 * Accepts tags in either branded `DicomTag` format `"(0010,0010)"` or
 * raw 8-char hex format `"00100010"`.
 *
 * Repeating groups resolve through their range definition, so every overlay
 * `(60xx,eeee)` and curve `(50xx,eeee)` tag that can appear in a real file
 * returns the entry the standard defines once for the family. Odd groups in
 * those ranges are private (PS3.5 §7.8.1) and stay unknown.
 *
 * @param tag - A DicomTag or 8-char hex string
 * @returns The dictionary entry, or undefined if the tag is not in the dictionary
 *
 * @example
 * ```ts
 * lookupTag('00100010'); // { vr: 'PN', name: 'PatientName', ... }
 * lookupTag('60020010'); // { vr: 'US', name: 'OverlayRows', ... } — repeating group
 * lookupTag('60010010'); // undefined — odd group, therefore private
 * ```
 */
function lookupTag(tag: DicomTag | string): DictionaryEntry | undefined {
    const key = normalizeKey(tag);
    return dictionary[key] ?? findRepeatingRule(key)?.entry;
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
    // Repeating groups are reported at the first tag they cover — OverlayRows is
    // `(6000,0010)`, not the `(60FF,0010)` upper bound of the range.
    for (const rule of repeatingRules) {
        map.set(rule.entry.name, { tag: rule.baseTag, entry: rule.entry });
    }
    return map;
}

function getNameIndex(): ReadonlyMap<string, { readonly tag: string; readonly entry: DictionaryEntry }> {
    nameIndex ??= buildNameIndex();
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
