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
import { stderr } from 'stderr-lib';
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
 * The 34 standard DICOM VR codes (PS3.5 Table 6.2-1).
 * Used to validate VR values from DCMTK XML output. Unrecognized VRs
 * (e.g. retired/internal codes like "xs", "ox") fall back to 'UN'.
 */
const KNOWN_VR_CODES = new Set([
    'AE',
    'AS',
    'AT',
    'CS',
    'DA',
    'DS',
    'DT',
    'FD',
    'FL',
    'IS',
    'LO',
    'LT',
    'OB',
    'OD',
    'OF',
    'OL',
    'OV',
    'OW',
    'PN',
    'SH',
    'SL',
    'SQ',
    'SS',
    'ST',
    'SV',
    'TM',
    'UC',
    'UI',
    'UL',
    'UN',
    'UR',
    'US',
    'UT',
    'UV',
]);

/**
 * Decodes the five predefined XML entities back to their literal characters.
 *
 * The parser runs with `processEntities: false` (to avoid fast-xml-parser's
 * 1000-entity expansion limit rejecting large studies), so dcm2xml's escaped
 * output (`&amp; &lt; &gt; &quot; &apos;`) reaches us verbatim and must be
 * decoded here. `&amp;` is decoded last so that an already-escaped sequence
 * such as `&amp;lt;` round-trips to the literal `&lt;` rather than `<`.
 *
 * Only the five predefined entities are decoded — custom DOCTYPE entities
 * (the billion-laughs DoS vector) are deliberately not expanded.
 */
function decodeXmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

/** Decodes XML entities only when the value is a string; passes other types through. */
function decodeIfString(value: unknown): unknown {
    return typeof value === 'string' ? decodeXmlEntities(value) : value;
}

/**
 * Builds a PN string from name components.
 */
function buildPnString(comp: XmlPersonNameComponent): string {
    const parts = [comp.FamilyName ?? '', comp.GivenName ?? '', comp.MiddleName ?? '', comp.NamePrefix ?? '', comp.NameSuffix ?? ''].map(decodeXmlEntities);
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
        element.BulkDataURI = decodeXmlEntities(safeString((firstBulk as Record<string, unknown>)['@_uri']));
    } else {
        element.BulkDataURI = decodeXmlEntities(safeString(firstBulk));
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

/** VRs whose values MUST be JSON numbers per DICOM PS3.18 F.2.3. */
const NUMERIC_JSON_VRS = new Set(['DS', 'FL', 'FD', 'IS', 'SL', 'SS', 'SV', 'UL', 'US', 'UV']);

/**
 * Unwraps fast-xml-parser attribute wrapper objects (e.g., {'#text': 'v', '@_number': '1'}).
 * An attribute-only object is an empty element (`<Value number="1"/>`) and
 * unwraps to the empty string — returning the attribute value here would leak
 * the value ordinal as the element value.
 */
function unwrapValue(v: unknown): unknown {
    if (typeof v !== 'object' || v === null) return v;
    const obj = v as Record<string, unknown>;
    if ('#text' in obj) return obj['#text'];
    const keys = Object.keys(obj);
    if (keys.every(k => k.startsWith('@_'))) {
        return '';
    }
    return v;
}

/** Coerces a value to a number. Returns the original if not parseable. */
function coerceNumeric(value: unknown): unknown {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed.length === 0) return value;
    const num = Number(trimmed);
    return Number.isNaN(num) ? value : num;
}

/** Handles regular Value elements. */
function convertRegularValue(attr: XmlDicomAttribute, element: ElementBuilder, vr: string): void {
    const valArray = toArray(attr.Value);
    const values: unknown[] = [];
    const isNumeric = NUMERIC_JSON_VRS.has(vr);
    for (const v of valArray) {
        const unwrapped = decodeIfString(unwrapValue(v));
        values.push(isNumeric ? coerceNumeric(unwrapped) : unwrapped);
    }
    if (values.length > 0) element.Value = values;
}

/**
 * Converts a single DicomAttribute XML element to its DICOM JSON element.
 */
function convertElement(attr: XmlDicomAttribute): DicomJsonElement {
    const rawVr = attr['@_vr'];
    const vr = KNOWN_VR_CODES.has(rawVr) ? rawVr : 'UN';
    const element: ElementBuilder = { vr };

    if (attr.InlineBinary !== undefined) {
        convertInlineBinary(attr, element);
    } else if (attr.BulkDataURI !== undefined) {
        convertBulkDataURI(attr, element);
    } else if (element.vr === 'PN' && attr.PersonName !== undefined) {
        convertPNValue(attr, element);
    } else if (element.vr === 'SQ' && attr.Item !== undefined) {
        convertSequence(attr, element);
    } else if (attr.Value !== undefined) {
        convertRegularValue(attr, element, vr);
    }

    return Object.freeze(element) as DicomJsonElement;
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
    // DICOM XML does not use XML entities. Disable entity processing to avoid
    // the default expansion limit (1000) which rejects files with >1000 tags.
    // Without this, large studies fall through to dcm2json which hangs on
    // compressed pixel data (DCMTK bug).
    processEntities: false,
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
        return err(new Error(`Failed to parse dcm2xml XML: ${stderr(error).message}`));
    }
}

export { xmlToJson, coerceNumeric, KNOWN_VR_CODES, NUMERIC_JSON_VRS };
export type { DicomJsonModel, DicomJsonElement };
