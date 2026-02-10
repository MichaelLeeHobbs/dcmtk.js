/**
 * Converts dcm2xml "Native DICOM Model" XML into the DICOM JSON Model (PS3.18 F.2).
 *
 * dcm2xml outputs XML in the DCMTK native format:
 * ```xml
 * <NativeDicomModel>
 *   <DicomAttribute tag="00100010" vr="PN" keyword="PatientName">
 *     <PersonName number="1">
 *       <Alphabetic><FamilyName>Smith</FamilyName></Alphabetic>
 *     </PersonName>
 *   </DicomAttribute>
 *   <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
 *     <Value number="1">12345</Value>
 *   </DicomAttribute>
 * </NativeDicomModel>
 * ```
 *
 * The DICOM JSON Model output:
 * ```json
 * {
 *   "00100010": { "vr": "PN", "Value": [{"Alphabetic": "Smith"}] },
 *   "00100020": { "vr": "LO", "Value": ["12345"] }
 * }
 * ```
 *
 * @module _xmlToJson
 * @internal
 */

import { XMLParser } from 'fast-xml-parser';
import type { Result } from '../types';
import { ok, err } from '../types';

/** DICOM JSON Model element. */
interface DicomJsonElement {
    readonly vr: string;
    readonly Value?: ReadonlyArray<unknown>;
    readonly InlineBinary?: string;
    readonly BulkDataURI?: string;
}

/** Mutable builder for DicomJsonElement during conversion. */
interface ElementBuilder {
    vr: string;
    Value?: unknown[];
    InlineBinary?: string;
    BulkDataURI?: string;
}

/** DICOM JSON Model top-level object. */
type DicomJsonModel = Record<string, DicomJsonElement>;

/** Parsed XML attribute node from fast-xml-parser. */
interface XmlDicomAttribute {
    readonly '@_tag': string;
    readonly '@_vr': string;
    readonly '@_keyword'?: string;
    readonly Value?: unknown;
    readonly PersonName?: unknown;
    readonly InlineBinary?: unknown;
    readonly BulkDataURI?: unknown;
    readonly Item?: unknown;
}

/** Person name components from XML. */
interface XmlPersonNameComponent {
    readonly FamilyName?: string;
    readonly GivenName?: string;
    readonly MiddleName?: string;
    readonly NamePrefix?: string;
    readonly NameSuffix?: string;
}

/** PN representation types. */
type PnRepType = 'Alphabetic' | 'Ideographic' | 'Phonetic';
const PN_REPS: readonly PnRepType[] = ['Alphabetic', 'Ideographic', 'Phonetic'];

const ARRAY_TAG_NAMES = new Set(['DicomAttribute', 'Value', 'PersonName', 'Item']);

/**
 * Builds a PN string from name components.
 */
function buildPnString(comp: XmlPersonNameComponent): string {
    const parts = [comp.FamilyName ?? '', comp.GivenName ?? '', comp.MiddleName ?? '', comp.NamePrefix ?? '', comp.NameSuffix ?? ''];
    let last = parts.length - 1;
    for (; last >= 0; last--) {
        if (parts[last] !== '') break;
    }
    return parts.slice(0, last + 1).join('^');
}

/** Ensures a value is an array. */
function toArray(val: unknown): readonly unknown[] {
    if (Array.isArray(val)) return val;
    if (val === undefined || val === null) return [];
    return [val];
}

/**
 * Converts a PersonName XML element to DICOM JSON PN format.
 */
function convertPersonName(pnNode: unknown): Record<string, string> {
    const result: Record<string, string> = {};
    /* v8 ignore next -- defensive guard for malformed XML */
    if (typeof pnNode !== 'object' || pnNode === null) return result;
    const pn = pnNode as Record<string, unknown>;

    for (const rep of PN_REPS) {
        const repNode = pn[rep];
        if (repNode !== undefined && typeof repNode === 'object' && repNode !== null) {
            const str = buildPnString(repNode as XmlPersonNameComponent);
            if (str.length > 0) {
                result[rep] = str;
            }
        }
    }
    return result;
}

/** Safely converts an unknown value to a string without risking [object Object]. */
function safeString(val: unknown): string {
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    /* v8 ignore next */
    return '';
}

/** Handles InlineBinary elements. */
function convertInlineBinary(attr: XmlDicomAttribute, element: ElementBuilder): void {
    element.InlineBinary = safeString(attr.InlineBinary);
}

/** Handles BulkDataURI elements. */
function convertBulkDataURI(attr: XmlDicomAttribute, element: ElementBuilder): void {
    const bulkArray = toArray(attr.BulkDataURI);
    const firstBulk = bulkArray[0];
    if (typeof firstBulk === 'object' && firstBulk !== null && '@_uri' in firstBulk) {
        element.BulkDataURI = safeString((firstBulk as Record<string, unknown>)['@_uri']);
    } else {
        element.BulkDataURI = safeString(firstBulk);
    }
}

/** Handles PersonName (PN VR) elements. */
function convertPNValue(attr: XmlDicomAttribute, element: ElementBuilder): void {
    const pnArray = toArray(attr.PersonName);
    const values: Record<string, string>[] = [];
    for (const pn of pnArray) {
        values.push(convertPersonName(pn));
    }
    if (values.length > 0) element.Value = values;
}

/** Handles Sequence (SQ) elements. */
function convertSequence(attr: XmlDicomAttribute, element: ElementBuilder): void {
    const items = toArray(attr.Item);
    const values: DicomJsonModel[] = [];
    for (const item of items) {
        /* v8 ignore next -- defensive guard for malformed XML */
        if (typeof item !== 'object' || item === null) continue;
        values.push(convertAttributes(item as Record<string, unknown>));
    }
    if (values.length > 0) element.Value = values;
}

/** Handles regular Value elements. */
function convertRegularValue(attr: XmlDicomAttribute, element: ElementBuilder): void {
    const valArray = toArray(attr.Value);
    const values: unknown[] = [];
    for (const v of valArray) {
        if (typeof v === 'object' && v !== null && '#text' in v) {
            values.push((v as Record<string, unknown>)['#text']);
        } else {
            values.push(v);
        }
    }
    if (values.length > 0) element.Value = values;
}

/**
 * Converts a single DicomAttribute XML element to its DICOM JSON element.
 */
function convertElement(attr: XmlDicomAttribute): DicomJsonElement {
    const element: ElementBuilder = { vr: attr['@_vr'] };

    if (attr.InlineBinary !== undefined) {
        convertInlineBinary(attr, element);
    } else if (attr.BulkDataURI !== undefined) {
        convertBulkDataURI(attr, element);
    } else if (element.vr === 'PN' && attr.PersonName !== undefined) {
        convertPNValue(attr, element);
    } else if (element.vr === 'SQ' && attr.Item !== undefined) {
        convertSequence(attr, element);
    } else if (attr.Value !== undefined) {
        convertRegularValue(attr, element);
    }

    return element;
}

/**
 * Converts an object containing DicomAttribute children into a DICOM JSON Model object.
 */
function convertAttributes(obj: Record<string, unknown>): DicomJsonModel {
    const result: Record<string, DicomJsonElement> = {};
    const attrs = toArray(obj['DicomAttribute']);

    for (const attr of attrs) {
        if (typeof attr !== 'object' || attr === null) continue;
        const xmlAttr = attr as XmlDicomAttribute;
        const tag = xmlAttr['@_tag'];
        if (tag === undefined) continue;
        result[tag] = convertElement(xmlAttr);
    }

    return result;
}

/** XML parser configured for the DCMTK Native DICOM Model. */
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    isArray: (name: string): boolean => ARRAY_TAG_NAMES.has(name),
});

/**
 * Converts dcm2xml XML output to DICOM JSON Model.
 *
 * @param xml - The XML string from dcm2xml
 * @returns A Result containing the DICOM JSON Model or an error
 */
function xmlToJson(xml: string): Result<DicomJsonModel> {
    try {
        const parsed = parser.parse(xml) as Record<string, unknown>;
        const root = parsed['NativeDicomModel'];
        if (root === undefined) {
            return err(new Error('Invalid dcm2xml output: missing NativeDicomModel root element'));
        }
        // Empty NativeDicomModel produces an empty string from the parser
        if (typeof root !== 'object' || root === null) {
            return ok({});
        }
        return ok(convertAttributes(root as Record<string, unknown>));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown XML parse error';
        return err(new Error(`Failed to parse dcm2xml XML: ${message}`));
    }
}

export { xmlToJson };
export type { DicomJsonModel, DicomJsonElement };
