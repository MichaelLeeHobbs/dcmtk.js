import { deflateRawSync } from 'node:zlib';
import { describe, it, expect } from 'vitest';
import { parseDicomBuffer } from './_p10ToJson';
import type { DicomJsonModel } from './_xmlToJson';
import { TS, evenPad, explicitEl, implicitEl, sqExplicit, sqImplicit, encapsulatedPixelData, metaGroup, p10 } from '../../test/helpers/p10';

/** Parses or fails the test. */
function parse(buffer: Buffer, options?: { charsetAssume?: string; charsetFallback?: string }): DicomJsonModel {
    const result = parseDicomBuffer(buffer, options);
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    return result.value.data;
}

describe('parseDicomBuffer — strings', () => {
    it('parses single and multi-value string VRs with trailing padding trimmed', () => {
        const data = parse(
            p10(TS.explicitLE, [
                explicitEl('00080060', 'CS', evenPad('CT')),
                explicitEl('00080008', 'CS', evenPad('ORIGINAL\\PRIMARY ')),
                explicitEl('00100020', 'LO', evenPad('PAT001 ')),
            ])
        );
        expect(data['00080060']).toEqual({ vr: 'CS', Value: ['CT'] });
        expect(data['00080008']).toEqual({ vr: 'CS', Value: ['ORIGINAL', 'PRIMARY'] });
        expect(data['00100020']).toEqual({ vr: 'LO', Value: ['PAT001'] });
    });

    it('preserves empty positions in multi-value strings', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00080008', 'CS', evenPad('\\SECONDARY\\INTRAOPERATIVE'))]));
        expect(data['00080008']).toEqual({ vr: 'CS', Value: ['', 'SECONDARY', 'INTRAOPERATIVE'] });
    });

    it('trims trailing NUL padding from UI values', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00080016', 'UI', evenPad('1.2.840.10008.5.1.4.1.1.7', '\0'))]));
        expect(data['00080016']).toEqual({ vr: 'UI', Value: ['1.2.840.10008.5.1.4.1.1.7'] });
    });

    it('emits a bare element for zero-length values', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00100020', 'LO', Buffer.alloc(0))]));
        expect(data['00100020']).toEqual({ vr: 'LO' });
    });

    it('emits a bare element for whitespace-only values', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00100020', 'LO', evenPad('  '))]));
        expect(data['00100020']).toEqual({ vr: 'LO' });
    });

    it('does not split text VRs (ST/LT/UT/UR) on backslash', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00104000', 'LT', evenPad('line1\\line2'))]));
        expect(data['00104000']).toEqual({ vr: 'LT', Value: ['line1\\line2'] });
    });

    it('coerces DS and IS values to numbers, keeping non-numeric strings', () => {
        const data = parse(
            p10(TS.explicitLE, [
                explicitEl('00201041', 'DS', evenPad('-12.5\\+3.25')),
                explicitEl('00200013', 'IS', evenPad('42')),
                explicitEl('00181060', 'DS', evenPad('abc')),
            ])
        );
        expect(data['00201041']).toEqual({ vr: 'DS', Value: [-12.5, 3.25] });
        expect(data['00200013']).toEqual({ vr: 'IS', Value: [42] });
        expect(data['00181060']).toEqual({ vr: 'DS', Value: ['abc'] });
    });
});

describe('parseDicomBuffer — person names', () => {
    it('parses PN component groups', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00100010', 'PN', evenPad('Smith^John^^Dr^'))]));
        expect(data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Smith^John^^Dr' }] });
    });

    it('parses multi-value PN and ideographic/phonetic groups', () => {
        const utf8 = Buffer.from('Wang^XiaoDong=王^小东=', 'utf8');
        const value = utf8.length % 2 === 0 ? utf8 : Buffer.concat([utf8, Buffer.from(' ')]);
        const data = parse(
            p10(TS.explicitLE, [
                explicitEl('00080005', 'CS', evenPad('ISO_IR 192')),
                explicitEl('00100010', 'PN', value),
                explicitEl('00101001', 'PN', evenPad('A\\B')),
            ])
        );
        expect(data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Wang^XiaoDong', Ideographic: '王^小东' }] });
        expect(data['00101001']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'A' }, { Alphabetic: 'B' }] });
    });
});

describe('parseDicomBuffer — binary numeric VRs', () => {
    it('parses US, SS, UL, SL, FL, FD arrays', () => {
        const us = Buffer.alloc(4);
        us.writeUInt16LE(1, 0);
        us.writeUInt16LE(65535, 2);
        const ss = Buffer.alloc(2);
        ss.writeInt16LE(-5, 0);
        const ul = Buffer.alloc(4);
        ul.writeUInt32LE(4000000000, 0);
        const sl = Buffer.alloc(4);
        sl.writeInt32LE(-123456, 0);
        const fl = Buffer.alloc(4);
        fl.writeFloatLE(1.5, 0);
        const fd = Buffer.alloc(8);
        fd.writeDoubleLE(3.14159, 0);
        const data = parse(
            p10(TS.explicitLE, [
                explicitEl('00280010', 'US', us),
                explicitEl('00189219', 'SS', ss),
                explicitEl('00081161', 'UL', ul),
                explicitEl('0040A162', 'SL', sl),
                explicitEl('00089459', 'FL', fl),
                explicitEl('00189352', 'FD', fd),
            ])
        );
        expect(data['00280010']).toEqual({ vr: 'US', Value: [1, 65535] });
        expect(data['00189219']).toEqual({ vr: 'SS', Value: [-5] });
        expect(data['00081161']).toEqual({ vr: 'UL', Value: [4000000000] });
        expect(data['0040A162']).toEqual({ vr: 'SL', Value: [-123456] });
        expect(data['00089459']).toEqual({ vr: 'FL', Value: [1.5] });
        expect(data['00189352']).toEqual({ vr: 'FD', Value: [3.14159] });
    });

    it('parses SV and UV 64-bit values (implicit VR)', () => {
        // dicom-parser mis-tokenizes explicit-VR SV/UV/OV (post-2019 VRs use
        // the 12-byte form it doesn't know); implicit VR encodes lengths
        // uniformly, so the 64-bit read path is exercised via implicit files.
        const sv = Buffer.alloc(8);
        sv.writeBigInt64LE(-42n, 0);
        const uv = Buffer.alloc(8);
        uv.writeBigUInt64LE(42n, 0);
        const data = parse(p10(TS.implicitLE, [implicitEl('00720082', sv), implicitEl('00720083', uv)]));
        expect(data['00720082']).toEqual({ vr: 'SV', Value: [-42] });
        expect(data['00720083']).toEqual({ vr: 'UV', Value: [42] });
    });

    it('parses explicit-VR SV values (fixed by @ubercode/dicom-parser — was a dicom-parser@1.8 limitation)', () => {
        const sv = Buffer.alloc(8);
        sv.writeBigInt64LE(-42n, 0);
        const data = parse(p10(TS.explicitLE, [explicitEl('00720082', 'SV', sv)]));
        expect(data['00720082']).toEqual({ vr: 'SV', Value: [-42] });
    });

    it('parses AT values as GGGGEEEE strings', () => {
        const at = Buffer.alloc(8);
        at.writeUInt16LE(0x0018, 0);
        at.writeUInt16LE(0x1063, 2);
        at.writeUInt16LE(0x0028, 4);
        at.writeUInt16LE(0x0010, 6);
        const data = parse(p10(TS.explicitLE, [explicitEl('00280009', 'AT', at)]));
        expect(data['00280009']).toEqual({ vr: 'AT', Value: ['00181063', '00280010'] });
    });

    it('emits bare elements for truncated numeric and AT values', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00280010', 'US', Buffer.alloc(1)), explicitEl('00280009', 'AT', Buffer.alloc(2))]));
        expect(data['00280010']).toEqual({ vr: 'US' });
        expect(data['00280009']).toEqual({ vr: 'AT' });
    });
});

describe('parseDicomBuffer — binary and pixel data', () => {
    it('emits bare elements for bulk binary VRs', () => {
        const data = parse(
            p10(TS.explicitLE, [
                explicitEl('7FE00010', 'OW', Buffer.alloc(16)),
                explicitEl('00291002', 'OB', Buffer.alloc(4)),
                explicitEl('00291004', 'UN', Buffer.alloc(4)),
            ])
        );
        expect(data['7FE00010']).toEqual({ vr: 'OW' });
        expect(data['00291002']).toEqual({ vr: 'OB' });
        expect(data['00291004']).toEqual({ vr: 'UN' });
    });

    it('normalizes encapsulated pixel data to OB', () => {
        const data = parse(p10(TS.jpegBaseline, [encapsulatedPixelData(Buffer.alloc(8))]));
        expect(data['7FE00010']).toEqual({ vr: 'OB' });
    });
});

describe('parseDicomBuffer — sequences', () => {
    it('parses nested defined-length sequences', () => {
        const itemContent = Buffer.concat([
            explicitEl('00081150', 'UI', evenPad('1.2.840.10008.5.1.4.1.1.4', '\0')),
            explicitEl('00081155', 'UI', evenPad('1.2.3.4', '\0')),
        ]);
        const outer = sqExplicit('00081140', [itemContent, itemContent]);
        const data = parse(p10(TS.explicitLE, [outer]));
        expect(data['00081140']?.vr).toBe('SQ');
        const items = data['00081140']?.Value as readonly DicomJsonModel[];
        expect(items).toHaveLength(2);
        expect(items[0]?.['00081155']).toEqual({ vr: 'UI', Value: ['1.2.3.4'] });
    });

    it('parses two-level nesting', () => {
        const level2 = Buffer.concat([explicitEl('00080100', 'SH', evenPad('CODE'))]);
        const level1 = Buffer.concat([explicitEl('00081032', 'SQ', Buffer.alloc(0)), sqExplicit('00080096', [level2])]);
        const data = parse(p10(TS.explicitLE, [sqExplicit('00081110', [level1])]));
        const item0 = (data['00081110']?.Value as readonly DicomJsonModel[])[0];
        expect(item0?.['00081032']).toEqual({ vr: 'SQ' });
        const nested = (item0?.['00080096']?.Value as readonly DicomJsonModel[])[0];
        expect(nested?.['00080100']).toEqual({ vr: 'SH', Value: ['CODE'] });
    });

    it('emits a bare SQ for zero-length sequences', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00081140', 'SQ', Buffer.alloc(0))]));
        expect(data['00081140']).toEqual({ vr: 'SQ' });
    });

    it('represents empty items as empty objects', () => {
        const data = parse(p10(TS.explicitLE, [sqExplicit('00081140', [Buffer.alloc(0)])]));
        expect(data['00081140']).toEqual({ vr: 'SQ', Value: [{}] });
    });
});

describe('parseDicomBuffer — transfer syntaxes', () => {
    it('parses implicit VR little endian using the dictionary', () => {
        const data = parse(p10(TS.implicitLE, [implicitEl('00100010', evenPad('Smith^John')), implicitEl('00100020', evenPad('PAT001'))]));
        expect(data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Smith^John' }] });
        expect(data['00100020']).toEqual({ vr: 'LO', Value: ['PAT001'] });
    });

    it('parses implicit VR sequences using the dictionary', () => {
        const itemContent = implicitEl('00081155', evenPad('1.2.3.4', '\0'));
        const data = parse(p10(TS.implicitLE, [sqImplicit('00081140', [itemContent])]));
        expect(data['00081140']?.vr).toBe('SQ');
        const items = data['00081140']?.Value as readonly DicomJsonModel[];
        expect(items[0]?.['00081155']).toEqual({ vr: 'UI', Value: ['1.2.3.4'] });
    });

    it('maps unknown private implicit elements to UN', () => {
        const data = parse(p10(TS.implicitLE, [implicitEl('00990001', evenPad('mystery'))]));
        expect(data['00990001']).toEqual({ vr: 'UN' });
    });

    it('resolves implicit VR for repeating overlay groups from the dictionary', () => {
        const rows = Buffer.alloc(2);
        rows.writeUInt16LE(512, 0);
        const overlayBits = Buffer.from([0x0f, 0xf0]);
        const data = parse(p10(TS.implicitLE, [implicitEl('60020010', rows), implicitEl('60023000', overlayBits)]));
        // (60xx,0010) OverlayRows is US and (60xx,3000) OverlayData is OW — both
        // reached through the repeating-group range, not an exact dictionary hit.
        expect(data['60020010']).toEqual({ vr: 'US', Value: [512] });
        expect(data['60023000']?.vr).toBe('OW');
    });

    it('parses explicit VR big endian', () => {
        const us = Buffer.alloc(2);
        us.writeUInt16BE(256, 0);
        const data = parse(p10(TS.explicitBE, [explicitEl('00280010', 'US', us, true), explicitEl('00100020', 'LO', evenPad('PAT001'), true)]));
        expect(data['00280010']).toEqual({ vr: 'US', Value: [256] });
        expect(data['00100020']).toEqual({ vr: 'LO', Value: ['PAT001'] });
    });

    it('parses the deflated transfer syntax via node:zlib', () => {
        const dataset = Buffer.concat([explicitEl('00100020', 'LO', evenPad('PAT001'))]);
        const deflated = deflateRawSync(dataset);
        const buffer = Buffer.concat([Buffer.alloc(128), Buffer.from('DICM', 'latin1'), metaGroup(TS.deflatedLE), deflated]);
        const data = parse(buffer);
        expect(data['00100020']).toEqual({ vr: 'LO', Value: ['PAT001'] });
    });
});

describe('parseDicomBuffer — charset integration', () => {
    it('decodes charset-sensitive VRs using SpecificCharacterSet', () => {
        const cyrillic = Buffer.from('\xbb\xee\xda\xe1\xd5\xdc\xd1\xe3\xe0\xd3', 'latin1');
        const data = parse(p10(TS.explicitLE, [explicitEl('00080005', 'CS', evenPad('ISO_IR 144')), explicitEl('00100010', 'PN', cyrillic)]));
        expect(data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Люксембург' }] });
    });

    it('applies charsetAssume when 0008,0005 is absent', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00100010', 'PN', evenPad('M\xfcller'))]), { charsetAssume: 'latin-1' });
        expect(data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Müller' }] });
    });

    it('lets a nested item override the charset', () => {
        const utf8Name = Buffer.from('王', 'utf8');
        const padded = utf8Name.length % 2 === 0 ? utf8Name : Buffer.concat([utf8Name, Buffer.from(' ')]);
        const itemContent = Buffer.concat([explicitEl('00080005', 'CS', evenPad('ISO_IR 192')), explicitEl('00100010', 'PN', padded)]);
        const data = parse(p10(TS.explicitLE, [explicitEl('00080005', 'CS', evenPad('ISO_IR 100')), sqExplicit('00081140', [itemContent])]));
        const item0 = (data['00081140']?.Value as readonly DicomJsonModel[])[0];
        expect(item0?.['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: '王' }] });
    });

    it('errors on unsupported charsets without a fallback and succeeds with one', () => {
        const file = p10(TS.explicitLE, [explicitEl('00080005', 'CS', evenPad('ISO_IR 999')), explicitEl('00100010', 'PN', evenPad('X'))]);
        const failed = parseDicomBuffer(file);
        expect(failed.ok).toBe(false);
        const data = parse(file, { charsetFallback: 'latin-1' });
        expect(data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'X' }] });
    });
});

describe('parseDicomBuffer — UTF-8 mislabel detection (#34)', () => {
    const utf8Name = evenPad(Buffer.from('Müller^José', 'utf-8').toString('latin1'));

    it('warns when UTF-8 bytes appear under the ASCII default (no 0008,0005)', () => {
        const result = parseDicomBuffer(p10(TS.explicitLE, [explicitEl('00100010', 'PN', utf8Name)]));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'MÃ¼ller^JosÃ©' }] });
        expect(result.value.warnings).toContain("possible UTF-8 mislabel: 00100010 (decoded as 'ISO_IR 6')");
    });

    it('warns when UTF-8 bytes appear under a declared single-byte charset', () => {
        const result = parseDicomBuffer(p10(TS.explicitLE, [explicitEl('00080005', 'CS', evenPad('ISO_IR 100')), explicitEl('00100010', 'PN', utf8Name)]));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.warnings).toContain("possible UTF-8 mislabel: 00100010 (decoded as 'ISO_IR 100')");
    });

    it('decodes as UTF-8 when utf8MislabelPromote is set, still warning', () => {
        const result = parseDicomBuffer(p10(TS.explicitLE, [explicitEl('00100010', 'PN', utf8Name)]), { utf8MislabelPromote: true });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Müller^José' }] });
        expect(result.value.warnings).toContain('possible UTF-8 mislabel: 00100010 (decoded as UTF-8)');
    });

    it('does not warn for correctly-labeled UTF-8 (ISO_IR 192)', () => {
        const result = parseDicomBuffer(p10(TS.explicitLE, [explicitEl('00080005', 'CS', evenPad('ISO_IR 192')), explicitEl('00100010', 'PN', utf8Name)]));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Müller^José' }] });
        expect(result.value.warnings).toHaveLength(0);
    });

    it('does not warn for genuine Latin-1 high bytes (invalid as UTF-8)', () => {
        const result = parseDicomBuffer(
            p10(TS.explicitLE, [explicitEl('00080005', 'CS', evenPad('ISO_IR 100')), explicitEl('00100010', 'PN', evenPad('M\xfcller'))])
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Müller' }] });
        expect(result.value.warnings).toHaveLength(0);
    });

    it('applies detection to charset-sensitive VRs and warns once per tag', () => {
        const utf8Lo = evenPad(Buffer.from('José', 'utf-8').toString('latin1'));
        const itemContent = Buffer.concat([explicitEl('00081090', 'LO', utf8Lo)]);
        const result = parseDicomBuffer(
            p10(TS.explicitLE, [
                explicitEl('00081090', 'LO', utf8Lo),
                sqExplicit('00081140', [itemContent, itemContent]),
                explicitEl('00100010', 'PN', utf8Name),
            ])
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const mislabels = result.value.warnings.filter(w => w.includes('mislabel'));
        expect(mislabels).toHaveLength(2);
        expect(mislabels.some(w => w.includes('00081090'))).toBe(true);
        expect(mislabels.some(w => w.includes('00100010'))).toBe(true);
    });

    it('does not apply detection to non-charset VRs', () => {
        const utf8Cs = evenPad(Buffer.from('Aé', 'utf-8').toString('latin1'));
        const result = parseDicomBuffer(p10(TS.explicitLE, [explicitEl('00080060', 'CS', utf8Cs)]));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.warnings).toHaveLength(0);
    });
});

describe('parseDicomBuffer — structure and errors', () => {
    it('includes file meta group 0002 and omits group lengths', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00100020', 'LO', evenPad('PAT001'))]));
        expect(data['00020010']).toEqual({ vr: 'UI', Value: [TS.explicitLE] });
        expect(data['00020000']).toBeUndefined();
    });

    it('resolves unknown explicit VR codes to UN', () => {
        const data = parse(p10(TS.explicitLE, [explicitEl('00090001', 'ZZ', evenPad('what'))]));
        expect(data['00090001']).toEqual({ vr: 'UN' });
    });

    it('returns an error for non-DICOM input', () => {
        const result = parseDicomBuffer(Buffer.from('this is not dicom at all, definitely longer than 132 bytes'.repeat(4)));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('Failed to parse DICOM data');
    });

    it('returns an error for an empty buffer', () => {
        const result = parseDicomBuffer(Buffer.alloc(0));
        expect(result.ok).toBe(false);
    });

    it('surfaces tokenizer warnings', () => {
        const result = parseDicomBuffer(p10(TS.explicitLE, [explicitEl('00100020', 'LO', evenPad('PAT001'))]));
        expect(result.ok).toBe(true);
        if (result.ok) expect(Array.isArray(result.value.warnings)).toBe(true);
    });
});
