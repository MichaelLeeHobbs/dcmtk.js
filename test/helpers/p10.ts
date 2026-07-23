/**
 * Test helper: builds synthetic DICOM Part-10 buffers for parser tests.
 *
 * Supports explicit/implicit VR, little/big endian, defined-length sequences,
 * and encapsulated pixel data — enough surface to exercise _p10ToJson without
 * real files or DCMTK binaries.
 *
 * @module test/helpers/p10
 */

/** Standard transfer syntax UIDs used by the builders. */
const TS = {
    implicitLE: '1.2.840.10008.1.2',
    explicitLE: '1.2.840.10008.1.2.1',
    explicitBE: '1.2.840.10008.1.2.2',
    deflatedLE: '1.2.840.10008.1.2.1.99',
    jpegBaseline: '1.2.840.10008.1.2.4.50',
} as const;

/** VRs encoded with the 12-byte (long) explicit form. */
const LONG_FORM_VRS = new Set(['OB', 'OW', 'OF', 'OD', 'OL', 'OV', 'SQ', 'UC', 'UR', 'UT', 'UN', 'SV', 'UV']);

/** Encodes a 'GGGGEEEE' tag. */
function tagBytes(tag: string, bigEndian = false): Buffer {
    const group = parseInt(tag.slice(0, 4), 16);
    const element = parseInt(tag.slice(4, 8), 16);
    const buf = Buffer.alloc(4);
    if (bigEndian) {
        buf.writeUInt16BE(group, 0);
        buf.writeUInt16BE(element, 2);
    } else {
        buf.writeUInt16LE(group, 0);
        buf.writeUInt16LE(element, 2);
    }
    return buf;
}

/** Pads a string value to even length. UI pads with NUL, text VRs with space. */
function evenPad(value: string, padChar = ' '): Buffer {
    const raw = Buffer.from(value, 'latin1');
    if (raw.length % 2 === 0) return raw;
    return Buffer.concat([raw, Buffer.from(padChar, 'latin1')]);
}

/** Encodes one explicit-VR element. */
function explicitEl(tag: string, vr: string, value: Buffer, bigEndian = false): Buffer {
    const head = tagBytes(tag, bigEndian);
    const vrBytes = Buffer.from(vr, 'latin1');
    if (LONG_FORM_VRS.has(vr)) {
        const len = Buffer.alloc(6);
        if (bigEndian) {
            len.writeUInt32BE(value.length, 2);
        } else {
            len.writeUInt32LE(value.length, 2);
        }
        return Buffer.concat([head, vrBytes, len, value]);
    }
    const len = Buffer.alloc(2);
    if (bigEndian) {
        len.writeUInt16BE(value.length, 0);
    } else {
        len.writeUInt16LE(value.length, 0);
    }
    return Buffer.concat([head, vrBytes, len, value]);
}

/** Encodes one implicit-VR element (always little endian). */
function implicitEl(tag: string, value: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32LE(value.length, 0);
    return Buffer.concat([tagBytes(tag), len, value]);
}

/** Wraps item content in a defined-length item (FFFE,E000). */
function item(content: Buffer, bigEndian = false): Buffer {
    const head = tagBytes('FFFEE000', bigEndian);
    const len = Buffer.alloc(4);
    if (bigEndian) {
        len.writeUInt32BE(content.length, 0);
    } else {
        len.writeUInt32LE(content.length, 0);
    }
    return Buffer.concat([head, len, content]);
}

/** Encodes a defined-length explicit-VR SQ element from item contents. */
function sqExplicit(tag: string, itemContents: readonly Buffer[], bigEndian = false): Buffer {
    const items = Buffer.concat(itemContents.map(c => item(c, bigEndian)));
    return explicitEl(tag, 'SQ', items, bigEndian);
}

/** Encodes a defined-length implicit-VR SQ element. */
function sqImplicit(tag: string, itemContents: readonly Buffer[]): Buffer {
    const items = Buffer.concat(itemContents.map(c => item(c)));
    return implicitEl(tag, items);
}

/** Encodes an encapsulated pixel-data element (undefined length, offset table + one fragment). */
function encapsulatedPixelData(fragment: Buffer): Buffer {
    const head = explicitEl('7FE00010', 'OB', Buffer.alloc(0)).subarray(0, 8);
    const undefinedLen = Buffer.from([0xff, 0xff, 0xff, 0xff]);
    const offsetTable = item(Buffer.alloc(0));
    const frag = item(fragment);
    const delimiter = Buffer.concat([tagBytes('FFFEE0DD'), Buffer.alloc(4)]);
    return Buffer.concat([head, undefinedLen, offsetTable, frag, delimiter]);
}

/** Builds the file meta group (always explicit little endian). */
function metaGroup(transferSyntaxUid: string): Buffer {
    const tsEl = explicitEl('00020010', 'UI', evenPad(transferSyntaxUid, '\0'));
    const sopClassEl = explicitEl('00020002', 'UI', evenPad('1.2.840.10008.5.1.4.1.1.7', '\0'));
    const groupLen = Buffer.alloc(4);
    groupLen.writeUInt32LE(sopClassEl.length + tsEl.length, 0);
    const groupLenEl = explicitEl('00020000', 'UL', groupLen);
    return Buffer.concat([groupLenEl, sopClassEl, tsEl]);
}

/** Builds a complete Part-10 file: preamble + DICM + meta + dataset elements. */
function p10(transferSyntaxUid: string, datasetElements: readonly Buffer[]): Buffer {
    return Buffer.concat([Buffer.alloc(128), Buffer.from('DICM', 'latin1'), metaGroup(transferSyntaxUid), ...datasetElements]);
}

export { TS, tagBytes, evenPad, explicitEl, implicitEl, item, sqExplicit, sqImplicit, encapsulatedPixelData, metaGroup, p10 };
