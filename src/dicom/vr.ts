/**
 * DICOM Value Representation (VR) definitions, categories, and metadata.
 *
 * Provides a complete catalogue of all 34 standard DICOM VRs with their
 * constraints (max length, padding, fixed-length) and category classification.
 *
 * @module dicom/vr
 */

// ---------------------------------------------------------------------------
// VR code constants (Rule 3.5: as const, no enums)
// ---------------------------------------------------------------------------

/**
 * All 34 standard DICOM Value Representation codes.
 *
 * @see DICOM PS3.5 Section 6.2
 */
const VR = {
    /** Application Entity — 16 bytes max, leading/trailing spaces significant */
    AE: 'AE',
    /** Age String — 4 bytes fixed, e.g. "032Y" */
    AS: 'AS',
    /** Attribute Tag — 4 bytes fixed */
    AT: 'AT',
    /** Code String — 16 bytes max */
    CS: 'CS',
    /** Date — 8 bytes fixed, YYYYMMDD */
    DA: 'DA',
    /** Decimal String — 16 bytes max per value */
    DS: 'DS',
    /** Date Time — 26 bytes max */
    DT: 'DT',
    /** Floating Point Double — 8 bytes fixed */
    FD: 'FD',
    /** Floating Point Single — 4 bytes fixed */
    FL: 'FL',
    /** Integer String — 12 bytes max */
    IS: 'IS',
    /** Long String — 64 chars max */
    LO: 'LO',
    /** Long Text — 10240 chars max */
    LT: 'LT',
    /** Other Byte — no max */
    OB: 'OB',
    /** Other Double — no max */
    OD: 'OD',
    /** Other Float — no max */
    OF: 'OF',
    /** Other Long — no max */
    OL: 'OL',
    /** Other 64-bit Very Long — no max */
    OV: 'OV',
    /** Other Word — no max */
    OW: 'OW',
    /** Person Name — 64 chars max per component group */
    PN: 'PN',
    /** Short String — 16 chars max */
    SH: 'SH',
    /** Signed Long — 4 bytes fixed */
    SL: 'SL',
    /** Sequence of Items — no max */
    SQ: 'SQ',
    /** Signed Short — 2 bytes fixed */
    SS: 'SS',
    /** Short Text — 1024 chars max */
    ST: 'ST',
    /** Signed 64-bit Very Long — 8 bytes fixed */
    SV: 'SV',
    /** Time — 14 bytes max */
    TM: 'TM',
    /** Unlimited Characters — no max */
    UC: 'UC',
    /** Unique Identifier (UID) — 64 bytes max */
    UI: 'UI',
    /** Unsigned Long — 4 bytes fixed */
    UL: 'UL',
    /** Unknown — no max */
    UN: 'UN',
    /** Universal Resource Identifier/Locator — no max */
    UR: 'UR',
    /** Unsigned Short — 2 bytes fixed */
    US: 'US',
    /** Unlimited Text — no max */
    UT: 'UT',
    /** Unsigned 64-bit Very Long — 8 bytes fixed */
    UV: 'UV',
} as const;

/** A valid DICOM Value Representation code. */
type VRValue = (typeof VR)[keyof typeof VR];

// ---------------------------------------------------------------------------
// VR categories
// ---------------------------------------------------------------------------

/** Names for the five VR categories. */
const VR_CATEGORY_NAME = {
    STRING: 'STRING',
    NUMERIC: 'NUMERIC',
    BINARY: 'BINARY',
    SEQUENCE: 'SEQUENCE',
    TAG: 'TAG',
} as const;

/** A VR category name. */
type VRCategoryName = (typeof VR_CATEGORY_NAME)[keyof typeof VR_CATEGORY_NAME];

/**
 * VR codes grouped by category.
 *
 * - STRING: text-based VRs that hold character data
 * - NUMERIC: VRs that hold numeric data (integer or float)
 * - BINARY: VRs that hold raw binary/byte data
 * - SEQUENCE: the SQ VR for nested datasets
 * - TAG: the AT VR for attribute tag references
 */
const VR_CATEGORY = {
    STRING: ['AE', 'AS', 'CS', 'DA', 'DS', 'DT', 'IS', 'LO', 'LT', 'PN', 'SH', 'ST', 'TM', 'UC', 'UI', 'UR', 'UT'] as const,
    NUMERIC: ['FD', 'FL', 'SL', 'SS', 'SV', 'UL', 'US', 'UV'] as const,
    BINARY: ['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'UN'] as const,
    SEQUENCE: ['SQ'] as const,
    TAG: ['AT'] as const,
} as const;

// ---------------------------------------------------------------------------
// VR metadata
// ---------------------------------------------------------------------------

/** Metadata describing the constraints of a single VR. */
interface VRMetadata {
    /** Maximum value length in bytes/chars, or null if unlimited. */
    readonly maxLength: number | null;
    /** Character used for padding to even length, or null if no padding. */
    readonly paddingChar: ' ' | '\0' | null;
    /** Whether this VR has a fixed (non-variable) length. */
    readonly fixed: boolean;
    /** The category this VR belongs to. */
    readonly category: VRCategoryName;
}

/**
 * Complete metadata for all 34 standard DICOM VRs.
 *
 * @see DICOM PS3.5 Table 6.2-1
 */
const VR_META: Readonly<Record<VRValue, VRMetadata>> = {
    AE: { maxLength: 16, paddingChar: ' ', fixed: false, category: 'STRING' },
    AS: { maxLength: 4, paddingChar: ' ', fixed: true, category: 'STRING' },
    AT: { maxLength: 4, paddingChar: '\0', fixed: true, category: 'TAG' },
    CS: { maxLength: 16, paddingChar: ' ', fixed: false, category: 'STRING' },
    DA: { maxLength: 8, paddingChar: ' ', fixed: true, category: 'STRING' },
    DS: { maxLength: 16, paddingChar: ' ', fixed: false, category: 'STRING' },
    DT: { maxLength: 26, paddingChar: ' ', fixed: false, category: 'STRING' },
    FD: { maxLength: 8, paddingChar: '\0', fixed: true, category: 'NUMERIC' },
    FL: { maxLength: 4, paddingChar: '\0', fixed: true, category: 'NUMERIC' },
    IS: { maxLength: 12, paddingChar: ' ', fixed: false, category: 'STRING' },
    LO: { maxLength: 64, paddingChar: ' ', fixed: false, category: 'STRING' },
    LT: { maxLength: 10240, paddingChar: ' ', fixed: false, category: 'STRING' },
    OB: { maxLength: null, paddingChar: '\0', fixed: false, category: 'BINARY' },
    OD: { maxLength: null, paddingChar: null, fixed: false, category: 'BINARY' },
    OF: { maxLength: null, paddingChar: null, fixed: false, category: 'BINARY' },
    OL: { maxLength: null, paddingChar: null, fixed: false, category: 'BINARY' },
    OV: { maxLength: null, paddingChar: null, fixed: false, category: 'BINARY' },
    OW: { maxLength: null, paddingChar: '\0', fixed: false, category: 'BINARY' },
    PN: { maxLength: 64, paddingChar: ' ', fixed: false, category: 'STRING' },
    SH: { maxLength: 16, paddingChar: ' ', fixed: false, category: 'STRING' },
    SL: { maxLength: 4, paddingChar: '\0', fixed: true, category: 'NUMERIC' },
    SQ: { maxLength: null, paddingChar: null, fixed: false, category: 'SEQUENCE' },
    SS: { maxLength: 2, paddingChar: '\0', fixed: true, category: 'NUMERIC' },
    ST: { maxLength: 1024, paddingChar: ' ', fixed: false, category: 'STRING' },
    SV: { maxLength: 8, paddingChar: '\0', fixed: true, category: 'NUMERIC' },
    TM: { maxLength: 14, paddingChar: ' ', fixed: false, category: 'STRING' },
    UC: { maxLength: null, paddingChar: ' ', fixed: false, category: 'STRING' },
    UI: { maxLength: 64, paddingChar: '\0', fixed: false, category: 'STRING' },
    UL: { maxLength: 4, paddingChar: '\0', fixed: true, category: 'NUMERIC' },
    UN: { maxLength: null, paddingChar: '\0', fixed: false, category: 'BINARY' },
    UR: { maxLength: null, paddingChar: ' ', fixed: false, category: 'STRING' },
    US: { maxLength: 2, paddingChar: '\0', fixed: true, category: 'NUMERIC' },
    UT: { maxLength: null, paddingChar: ' ', fixed: false, category: 'STRING' },
    UV: { maxLength: 8, paddingChar: '\0', fixed: true, category: 'NUMERIC' },
} as const;

// ---------------------------------------------------------------------------
// Set for O(1) membership check
// ---------------------------------------------------------------------------

const VR_SET: ReadonlySet<string> = new Set(Object.values(VR));

// Build category lookup from VR_CATEGORY arrays
const vrToCategoryMap: ReadonlyMap<string, VRCategoryName> = ((): ReadonlyMap<string, VRCategoryName> => {
    const map = new Map<string, VRCategoryName>();
    const categories = Object.keys(VR_CATEGORY) as ReadonlyArray<VRCategoryName>;
    for (const cat of categories) {
        const vrs = VR_CATEGORY[cat];
        for (const vr of vrs) {
            map.set(vr, cat);
        }
    }
    return map;
})();

const numericSet: ReadonlySet<string> = new Set(VR_CATEGORY.NUMERIC);
const binarySet: ReadonlySet<string> = new Set(VR_CATEGORY.BINARY);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Type guard: checks whether a string is a valid DICOM VR code.
 *
 * @param vr - The string to check
 * @returns True if `vr` is one of the 34 standard VR codes
 */
function isStringVR(vr: string): vr is VRValue {
    return VR_SET.has(vr);
}

/**
 * Checks whether a VR code represents a numeric value representation.
 *
 * @param vr - The VR code to check
 * @returns True if the VR is FD, FL, SL, SS, SV, UL, US, or UV
 */
function isNumericVR(vr: string): boolean {
    return numericSet.has(vr);
}

/**
 * Checks whether a VR code represents a binary value representation.
 *
 * @param vr - The VR code to check
 * @returns True if the VR is OB, OD, OF, OL, OV, OW, or UN
 */
function isBinaryVR(vr: string): boolean {
    return binarySet.has(vr);
}

/**
 * Returns the category name for a given VR code.
 *
 * @param vr - A valid VR code
 * @returns The category name (STRING, NUMERIC, BINARY, SEQUENCE, or TAG)
 */
function getVRCategory(vr: VRValue): VRCategoryName {
    const cat = vrToCategoryMap.get(vr);
    /* v8 ignore next */
    if (cat === undefined) {
        /* v8 ignore next 2 */
        throw new Error(`Unknown VR: ${vr}`);
    }
    return cat;
}

export { VR, VR_CATEGORY, VR_CATEGORY_NAME, VR_META, isStringVR, isNumericVR, isBinaryVR, getVRCategory };
export type { VRValue, VRCategoryName, VRMetadata };
