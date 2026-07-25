/**
 * Pure-JS DICOM Part-10 → DICOM JSON Model (PS3.18 F.2) conversion.
 *
 * Tokenizes with `dicom-parser` and converts elements to the same JSON shape
 * the dcm2xml path produces, with two documented differences:
 * - File meta group 0002 elements are included (the XML path omits them),
 *   which makes `DicomDataset.transferSyntaxUID` functional.
 * - Group length elements (gggg,0000) are always omitted.
 *
 * Bulk binary VRs (OB/OW/OD/OF/OL/OV/UN) are emitted as bare `{ vr }` with no
 * value — matching the XML path, which never loads binary data.
 *
 * Sequence traversal is iterative (explicit work stack, Rule 8.2).
 *
 * @module _p10ToJson
 * @internal
 */

import { inflateRawSync } from 'node:zlib';
import dicomParser from '@ubercode/dicom-parser/compat';
import type { DataSet, Element } from '@ubercode/dicom-parser/compat';
import { stderr } from 'stderr-lib';
import type { Result } from '../types';
import { ok, err } from '../types';
import { lookupTag } from '../dicom/dictionary';
import { decodeDicomText, decodeUtf8, isProbableUtf8Mislabel, resolveCharsetContext } from './_charset';
import type { CharsetContext } from './_charset';
import { coerceNumeric, KNOWN_VR_CODES } from './_xmlToJson';
import type { DicomJsonModel, DicomJsonElement } from './_xmlToJson';

/** Options for {@link parseDicomBuffer}. */
interface P10ParseOptions {
    /** Charset to assume when SpecificCharacterSet (0008,0005) is absent. */
    readonly charsetAssume?: string | undefined;
    /** Charset to fall back to when the specified charset is unsupported. */
    readonly charsetFallback?: string | undefined;
    /** Decode values detected as mislabeled UTF-8 as UTF-8 instead of the declared charset. A warning is pushed either way. */
    readonly utf8MislabelPromote?: boolean | undefined;
}

/** Result of a successful buffer parse. */
interface P10ParseResult {
    /** The DICOM JSON Model. */
    readonly data: DicomJsonModel;
    /** Non-fatal warnings collected by the tokenizer. */
    readonly warnings: readonly string[];
}

/** VRs whose values are bulk binary and are never loaded (bare `{ vr }`). */
const BINARY_VRS = new Set(['OB', 'OW', 'OD', 'OF', 'OL', 'OV', 'UN']);

/** VRs holding text that SpecificCharacterSet applies to. */
const CHARSET_VRS = new Set(['SH', 'LO', 'ST', 'LT', 'UC', 'UT', 'PN']);

/** Text VRs with VM 1 whose value may contain backslashes (never split). */
const NO_SPLIT_VRS = new Set(['ST', 'LT', 'UT', 'UR']);

/** Fixed-width binary numeric VRs → byte size per value. */
const NUMERIC_VR_SIZE: Readonly<Record<string, number>> = { US: 2, SS: 2, UL: 4, SL: 4, FL: 4, FD: 8, SV: 8, UV: 8 };

/** Bound on total datasets (root + sequence items) traversed per file (Rule 8.2). */
const MAX_DATASETS = 100_000;

/** Converts a dicom-parser tag ('x00100010') to a JSON Model tag ('00100010'). */
function toJsonTag(tag: string): string {
    return tag.slice(1).toUpperCase();
}

/**
 * True for elements that are encoding artifacts, not data: group length
 * elements (gggg,0000) and item/sequence delimitation tags (group FFFE),
 * which dicom-parser surfaces inside undefined-length items.
 */
function isEncodingArtifact(tag: string): boolean {
    return (tag.endsWith('0000') && tag.length === 9) || tag.startsWith('xfffe');
}

/** Resolves the effective VR for an element (explicit VR, dictionary result, or UN). */
function resolveVr(element: Element): string {
    const vr = element.vr;
    if (vr !== undefined && KNOWN_VR_CODES.has(vr)) {
        return vr;
    }
    return 'UN';
}

/** Returns the value bytes of an element. */
function valueBytes(element: Element, byteArray: Uint8Array): Uint8Array {
    return byteArray.subarray(element.dataOffset, element.dataOffset + element.length);
}

/** Trims trailing space and null padding from a decoded string value. */
function trimPadding(value: string): string {
    let end = value.length;
    while (end > 0) {
        const ch = value.charCodeAt(end - 1);
        if (ch !== 0x20 && ch !== 0x00) break;
        end--;
    }
    return value.slice(0, end);
}

/** Reads one fixed-width numeric value at the given offset. */
function readNumericAt(view: DataView, offset: number, vr: string, littleEndian: boolean): number {
    switch (vr) {
        case 'US':
            return view.getUint16(offset, littleEndian);
        case 'SS':
            return view.getInt16(offset, littleEndian);
        case 'UL':
            return view.getUint32(offset, littleEndian);
        case 'SL':
            return view.getInt32(offset, littleEndian);
        case 'FL':
            return view.getFloat32(offset, littleEndian);
        case 'FD':
            return view.getFloat64(offset, littleEndian);
        case 'SV':
            return Number(view.getBigInt64(offset, littleEndian));
        /* v8 ignore next 2 -- 'UV' is the only remaining caller-provided VR */
        default:
            return Number(view.getBigUint64(offset, littleEndian));
    }
}

/** Converts a fixed-width binary numeric element. */
function convertNumeric(element: Element, byteArray: Uint8Array, vr: string, littleEndian: boolean): DicomJsonElement {
    const size = NUMERIC_VR_SIZE[vr] as number;
    const count = Math.floor(element.length / size);
    if (count === 0) {
        return { vr };
    }
    const view = new DataView(byteArray.buffer, byteArray.byteOffset + element.dataOffset, element.length);
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
        values.push(readNumericAt(view, i * size, vr, littleEndian));
    }
    return { vr, Value: values };
}

/** Converts an AT (attribute tag) element to 'GGGGEEEE' strings. */
function convertAttributeTag(element: Element, byteArray: Uint8Array, littleEndian: boolean): DicomJsonElement {
    const count = Math.floor(element.length / 4);
    if (count === 0) {
        return { vr: 'AT' };
    }
    const view = new DataView(byteArray.buffer, byteArray.byteOffset + element.dataOffset, element.length);
    const values: string[] = [];
    for (let i = 0; i < count; i++) {
        const group = view.getUint16(i * 4, littleEndian);
        const elem = view.getUint16(i * 4 + 2, littleEndian);
        values.push(group.toString(16).padStart(4, '0').toUpperCase() + elem.toString(16).padStart(4, '0').toUpperCase());
    }
    return { vr: 'AT', Value: values };
}

/** Splits a decoded person-name value into its PS3.18 component-group object. */
function personNameToJson(value: string): Record<string, string> {
    const groups = trimPadding(value).split('=');
    const result: Record<string, string> = {};
    const names: readonly string[] = ['Alphabetic', 'Ideographic', 'Phonetic'];
    for (let i = 0; i < names.length; i++) {
        const group = (groups[i] ?? '').replace(/\^+$/u, '');
        const name = names[i];
        if (group !== '' && name !== undefined) {
            result[name] = group;
        }
    }
    return result;
}

/** Mutable UTF-8 mislabel state shared across one parse (warnings deduped per tag). */
interface MislabelState {
    /** Whether detected mislabels are decoded as UTF-8 instead of the declared charset. */
    readonly promote: boolean;
    /** Warning sink (one entry per distinct tag). */
    readonly warnings: string[];
    /** Tags already warned about. */
    readonly seen: Set<string>;
}

/**
 * Decodes charset-sensitive text bytes, detecting mislabeled UTF-8 under
 * single-byte contexts (#34): bytes with a high byte that form valid UTF-8
 * under a single-byte declared charset are near-certainly mislabeled.
 */
function decodeTextChecked(bytes: Uint8Array, tag: string, settings: ConvertSettings): string {
    const { charset, mislabel } = settings;
    if (charset.singleByte && isProbableUtf8Mislabel(bytes)) {
        if (!mislabel.seen.has(tag)) {
            mislabel.seen.add(tag);
            const action = mislabel.promote ? 'decoded as UTF-8' : `decoded as '${charset.terms.join('\\')}'`;
            mislabel.warnings.push(`possible UTF-8 mislabel: ${tag} (${action})`);
        }
        if (mislabel.promote) {
            return decodeUtf8(bytes);
        }
    }
    return decodeDicomText(bytes, charset);
}

/** Converts a PN element. */
function convertPersonName(element: Element, byteArray: Uint8Array, settings: ConvertSettings): DicomJsonElement {
    const decoded = decodeTextChecked(valueBytes(element, byteArray), toJsonTag(element.tag), settings);
    const values = decoded.split('\\').map(personNameToJson);
    return { vr: 'PN', Value: values };
}

/** Converts a text/string element (everything except SQ, PN, AT, binary, and fixed-width numerics). */
function convertString(element: Element, byteArray: Uint8Array, vr: string, settings: ConvertSettings): DicomJsonElement {
    const bytes = valueBytes(element, byteArray);
    const decoded = CHARSET_VRS.has(vr)
        ? decodeTextChecked(bytes, toJsonTag(element.tag), settings)
        : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
    const rawValues = NO_SPLIT_VRS.has(vr) ? [decoded] : decoded.split('\\');
    const values: unknown[] = rawValues.map(v => {
        const trimmed = trimPadding(v);
        return vr === 'DS' || vr === 'IS' ? coerceNumeric(trimmed.trim()) : trimmed;
    });
    if (values.length === 1 && values[0] === '') {
        return { vr };
    }
    return { vr, Value: values };
}

/** Per-dataset conversion settings threaded through element conversion. */
interface ConvertSettings {
    readonly charset: CharsetContext;
    readonly littleEndian: boolean;
    readonly mislabel: MislabelState;
}

/** Converts a non-sequence element to its DICOM JSON representation. */
function convertLeaf(element: Element, byteArray: Uint8Array, vr: string, settings: ConvertSettings): DicomJsonElement {
    if (element.fragments !== undefined) {
        // Encapsulated pixel data is OB by definition (PS3.5 A.4); DCMTK
        // applies the same correction to files carrying a wrong explicit VR.
        return { vr: 'OB' };
    }
    if (BINARY_VRS.has(vr)) {
        return { vr };
    }
    if (element.length === 0) {
        return { vr };
    }
    if (NUMERIC_VR_SIZE[vr] !== undefined) {
        return convertNumeric(element, byteArray, vr, settings.littleEndian);
    }
    if (vr === 'AT') {
        return convertAttributeTag(element, byteArray, settings.littleEndian);
    }
    if (vr === 'PN') {
        return convertPersonName(element, byteArray, settings);
    }
    return convertString(element, byteArray, vr, settings);
}

/** A pending dataset conversion unit for the iterative sequence walk. */
interface WorkUnit {
    readonly src: DataSet;
    readonly out: Record<string, DicomJsonElement>;
    readonly parentCharset: CharsetContext;
}

/** Resolves the charset context for a dataset, inheriting from the parent when 0008,0005 is absent. */
function datasetCharset(src: DataSet, parent: CharsetContext, options: P10ParseOptions | undefined): Result<CharsetContext> {
    const raw = src.string('x00080005');
    if (raw === undefined) {
        return ok(parent);
    }
    return resolveCharsetContext(raw, undefined, options?.charsetFallback);
}

/** Converts a sequence element, queueing item datasets onto the work stack. */
function convertSequence(element: Element, stack: WorkUnit[], charset: CharsetContext): DicomJsonElement {
    const items = element.items ?? [];
    const values: Record<string, DicomJsonElement>[] = [];
    for (const item of items) {
        const model: Record<string, DicomJsonElement> = {};
        values.push(model);
        if (item.dataSet !== undefined) {
            stack.push({ src: item.dataSet, out: model, parentCharset: charset });
        }
    }
    if (values.length === 0) {
        return { vr: 'SQ' };
    }
    return { vr: 'SQ', Value: values };
}

/** True when the element should be converted as a sequence. */
function isSequence(element: Element, vr: string): boolean {
    if (element.fragments !== undefined) {
        return false;
    }
    return vr === 'SQ' || (element.vr === undefined && element.items !== undefined);
}

/** Per-parse state shared across all datasets of one file. */
interface ParseState {
    readonly littleEndian: boolean;
    readonly options: P10ParseOptions | undefined;
    readonly mislabel: MislabelState;
}

/** Converts all elements of one dataset into its output model. */
function convertDataset(unit: WorkUnit, stack: WorkUnit[], state: ParseState): Result<void> {
    const charsetResult = datasetCharset(unit.src, unit.parentCharset, state.options);
    if (!charsetResult.ok) {
        return err(charsetResult.error);
    }
    const charset = charsetResult.value;
    const keys = Object.keys(unit.src.elements).sort();
    for (const key of keys) {
        const element = unit.src.elements[key];
        /* v8 ignore next -- keys come from the object itself */
        if (element === undefined) continue;
        if (isEncodingArtifact(element.tag)) continue;
        const tag = toJsonTag(element.tag);
        const vr = resolveVr(element);
        if (isSequence(element, vr)) {
            unit.out[tag] = convertSequence(element, stack, charset);
        } else {
            unit.out[tag] = convertLeaf(element, unit.src.byteArray, vr, { charset, littleEndian: state.littleEndian, mislabel: state.mislabel });
        }
    }
    return ok(undefined);
}

/** Inflater for the deflated transfer syntax, backed by node:zlib. */
function inflateDeflated(byteArray: Uint8Array, position: number): Uint8Array {
    const inflated = inflateRawSync(byteArray.subarray(position));
    const combined = new Uint8Array(position + inflated.byteLength);
    combined.set(byteArray.subarray(0, position), 0);
    combined.set(inflated, position);
    return combined;
}

/** VR resolver for implicit transfer syntaxes, backed by the tag dictionary. */
function implicitVrLookup(tag: string): string | undefined {
    return lookupTag(tag.slice(1))?.vr;
}

/**
 * Parses a DICOM Part-10 buffer (or raw dataset) into the DICOM JSON Model.
 *
 * @param buffer - The file bytes
 * @param options - Charset handling options
 * @returns A Result with the JSON Model and tokenizer warnings
 */
function parseDicomBuffer(buffer: Uint8Array, options?: P10ParseOptions): Result<P10ParseResult> {
    let dataSet: DataSet;
    try {
        dataSet = dicomParser.parseDicom(buffer, { vrCallback: implicitVrLookup, inflater: inflateDeflated });
    } catch (error: unknown) {
        return err(new Error(`Failed to parse DICOM data: ${stderr(error).message}`));
    }

    const littleEndian = dataSet.string('x00020010') !== '1.2.840.10008.1.2.2';
    const rootCharset = resolveCharsetContext(undefined, options?.charsetAssume, options?.charsetFallback);
    if (!rootCharset.ok) {
        return err(rootCharset.error);
    }

    const data: Record<string, DicomJsonElement> = {};
    const stack: WorkUnit[] = [{ src: dataSet, out: data, parentCharset: rootCharset.value }];
    const mislabel: MislabelState = { promote: options?.utf8MislabelPromote === true, warnings: [], seen: new Set() };
    const state: ParseState = { littleEndian, options, mislabel };
    let processed = 0;
    while (stack.length > 0) {
        processed++;
        if (processed > MAX_DATASETS) {
            return err(new Error(`Failed to parse DICOM data: more than ${String(MAX_DATASETS)} nested datasets`));
        }
        const unit = stack.pop();
        /* v8 ignore next -- stack.length > 0 guarantees an entry */
        if (unit === undefined) break;
        const converted = convertDataset(unit, stack, state);
        if (!converted.ok) {
            return err(converted.error);
        }
    }
    // The fork's core carries its own UTF-8 mislabel detection (its C4, ported
    // from our #34) with 'x'-prefixed lowercase tags. Ours is the documented
    // format on this API and honors utf8MislabelPromote — drop the duplicates.
    const tokenizerWarnings = dataSet.warnings.filter(w => !w.startsWith('possible UTF-8 mislabel: x'));
    return ok({ data, warnings: [...tokenizerWarnings, ...mislabel.warnings] });
}

export { parseDicomBuffer, implicitVrLookup };
export type { P10ParseOptions, P10ParseResult };
