import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readDicomHead } from './_boundedRead';
import { parseDicomBuffer } from './_p10ToJson';
import { TS, evenPad, explicitEl, implicitEl, sqExplicit, encapsulatedPixelData, item, metaGroup, p10, tagBytes } from '../../test/helpers/p10';

/** Forces the bounded path regardless of file size, with small chunks. */
const FORCE = { timeoutMs: 5_000, thresholdBytes: 0, chunkBytes: 256 } as const;

let tempDir: string;
let fileCounter = 0;

beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'bounded-read-test-'));
});

afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
});

/** Writes a buffer to a fresh temp file and returns its path. */
async function writeTemp(buffer: Buffer): Promise<string> {
    fileCounter++;
    const path = join(tempDir, `f${String(fileCounter)}.dcm`);
    await writeFile(path, buffer);
    return path;
}

/** Reads via the bounded reader (forced) and asserts the parse output matches the full file's. */
async function expectEquivalent(file: Buffer): Promise<Buffer> {
    const path = await writeTemp(file);
    const bounded = await readDicomHead(path, FORCE);
    expect(bounded.ok).toBe(true);
    if (!bounded.ok) throw bounded.error;
    const fromBounded = parseDicomBuffer(bounded.value);
    const fromFull = parseDicomBuffer(file);
    expect(fromBounded.ok).toBe(fromFull.ok);
    if (fromBounded.ok && fromFull.ok) {
        expect(fromBounded.value.data).toEqual(fromFull.value.data);
    }
    return bounded.value;
}

describe('readDicomHead — whole-file paths', () => {
    it('reads small files whole (threshold)', async () => {
        const file = p10(TS.explicitLE, [explicitEl('00100020', 'LO', evenPad('PAT001'))]);
        const path = await writeTemp(file);
        const result = await readDicomHead(path, { timeoutMs: 5_000 });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.equals(file)).toBe(true);
    });

    it('reads deflated transfer syntax files whole', async () => {
        const dataset = Buffer.concat([explicitEl('00100020', 'LO', evenPad('PAT001')), explicitEl('7FE00010', 'OB', Buffer.alloc(2_000, 7))]);
        const file = Buffer.concat([Buffer.alloc(128), Buffer.from('DICM', 'latin1'), metaGroup(TS.deflatedLE), deflateRawSync(dataset)]);
        const path = await writeTemp(file);
        const result = await readDicomHead(path, FORCE);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.equals(file)).toBe(true);
    });

    it('errs on a missing file', async () => {
        const result = await readDicomHead(join(tempDir, 'nope.dcm'), FORCE);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('failed to read');
    });

    it('errs when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const file = p10(TS.explicitLE, [explicitEl('00100020', 'LO', evenPad('PAT001'))]);
        const path = await writeTemp(file);
        const result = await readDicomHead(path, { timeoutMs: 5_000, signal: controller.signal });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('aborted');
    });

    it('errs when the deadline has passed', async () => {
        const file = p10(TS.explicitLE, [explicitEl('00100020', 'LO', evenPad('PAT001'))]);
        const path = await writeTemp(file);
        const result = await readDicomHead(path, { timeoutMs: -1 });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('timed out');
    });

    it('falls back to a full read for non-DICOM content', async () => {
        const file = Buffer.from('definitely not dicom '.repeat(100));
        const path = await writeTemp(file);
        const result = await readDicomHead(path, FORCE);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.equals(file)).toBe(true);
    });
});

describe('readDicomHead — bulk skipping', () => {
    it('skips large defined-length pixel data and keeps the output identical', async () => {
        const file = p10(TS.explicitLE, [
            explicitEl('00100010', 'PN', evenPad('Smith^John')),
            explicitEl('00100020', 'LO', evenPad('PAT001')),
            explicitEl('7FE00010', 'OB', Buffer.alloc(10_000, 0xab)),
        ]);
        const assembled = await expectEquivalent(file);
        expect(assembled.length).toBeLessThan(1_000);
    });

    it('preserves elements after the skipped pixel data (trailing tags)', async () => {
        const file = p10(TS.explicitLE, [
            explicitEl('00100020', 'LO', evenPad('PAT001')),
            explicitEl('7FE00010', 'OW', Buffer.alloc(8_192, 1)),
            explicitEl('FFFCFFFC', 'OB', Buffer.alloc(64, 0)),
        ]);
        const assembled = await expectEquivalent(file);
        const parsed = parseDicomBuffer(assembled);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value.data['FFFCFFFC']).toEqual({ vr: 'OB' });
            expect(parsed.value.data['7FE00010']).toEqual({ vr: 'OW' });
        }
    });

    it('skips multiple bulk elements (waveform + pixel data)', async () => {
        const file = p10(TS.explicitLE, [
            explicitEl('00100020', 'LO', evenPad('PAT001')),
            explicitEl('54000910', 'OW', Buffer.alloc(4_096, 2)),
            explicitEl('00204000', 'LT', evenPad('after waveform')),
            explicitEl('7FE00010', 'OB', Buffer.alloc(4_096, 3)),
        ]);
        const assembled = await expectEquivalent(file);
        expect(assembled.length).toBeLessThan(1_500);
        const parsed = parseDicomBuffer(assembled);
        if (parsed.ok) expect(parsed.value.data['00204000']).toEqual({ vr: 'LT', Value: ['after waveform'] });
    });

    it('skips large UN elements with defined length', async () => {
        const file = p10(TS.explicitLE, [explicitEl('00090001', 'UN', Buffer.alloc(6_000, 9)), explicitEl('00100020', 'LO', evenPad('PAT001'))]);
        await expectEquivalent(file);
    });

    it('skips implicit-VR pixel data via dictionary lookup', async () => {
        const file = p10(TS.implicitLE, [implicitEl('00100020', evenPad('PAT001')), implicitEl('7FE00010', Buffer.alloc(10_000, 5))]);
        const assembled = await expectEquivalent(file);
        expect(assembled.length).toBeLessThan(1_000);
    });

    it('skips big-endian explicit pixel data', async () => {
        const file = p10(TS.explicitBE, [explicitEl('00100020', 'LO', evenPad('PAT001'), true), explicitEl('7FE00010', 'OB', Buffer.alloc(10_000, 6), true)]);
        const assembled = await expectEquivalent(file);
        expect(assembled.length).toBeLessThan(1_000);
    });

    it('hops encapsulated pixel data fragments', async () => {
        const file = p10(TS.jpegBaseline, [explicitEl('00100020', 'LO', evenPad('PAT001')), encapsulatedPixelData(Buffer.alloc(9_000, 0xfe))]);
        const assembled = await expectEquivalent(file);
        expect(assembled.length).toBeLessThan(1_000);
        const parsed = parseDicomBuffer(assembled);
        if (parsed.ok) expect(parsed.value.data['7FE00010']).toEqual({ vr: 'OB' });
    });

    it('preserves trailing elements after encapsulated pixel data', async () => {
        const file = p10(TS.jpegBaseline, [
            explicitEl('00100020', 'LO', evenPad('PAT001')),
            encapsulatedPixelData(Buffer.alloc(5_000, 0xfe)),
            explicitEl('FFFCFFFC', 'OB', Buffer.alloc(32, 0)),
        ]);
        const assembled = await expectEquivalent(file);
        const parsed = parseDicomBuffer(assembled);
        if (parsed.ok) expect(parsed.value.data['FFFCFFFC']).toEqual({ vr: 'OB' });
    });
});

describe('readDicomHead — growth (never skips non-bulk data)', () => {
    it('grows through large text elements instead of skipping them', async () => {
        const bigText = 'x'.repeat(5_000);
        const file = p10(TS.explicitLE, [explicitEl('00104000', 'LT', evenPad(bigText)), explicitEl('00100020', 'LO', evenPad('PAT001'))]);
        const assembled = await expectEquivalent(file);
        const parsed = parseDicomBuffer(assembled);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.value.data['00104000']).toEqual({ vr: 'LT', Value: [bigText] });
    });

    it('grows through large sequences instead of skipping them', async () => {
        const items = Array.from({ length: 40 }, (_, i) => explicitEl('00081090', 'LO', evenPad(`Model-${String(i)}-${'y'.repeat(80)}`)));
        const file = p10(TS.explicitLE, [sqExplicit('00081140', items), explicitEl('7FE00010', 'OB', Buffer.alloc(5_000, 4))]);
        const assembled = await expectEquivalent(file);
        const parsed = parseDicomBuffer(assembled);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            const sq = parsed.value.data['00081140'];
            expect(sq?.Value).toHaveLength(40);
        }
    });

    it('handles a truncated file (declared pixel length beyond EOF) like the full path', async () => {
        const complete = p10(TS.explicitLE, [explicitEl('00100020', 'LO', evenPad('PAT001')), explicitEl('7FE00010', 'OB', Buffer.alloc(10_000, 1))]);
        const truncated = complete.subarray(0, complete.length - 4_000);
        await expectEquivalent(Buffer.from(truncated));
    });

    it('handles a file truncated inside an element header', async () => {
        const complete = p10(TS.explicitLE, [explicitEl('00104000', 'LT', evenPad('t'.repeat(400))), explicitEl('7FE00010', 'OB', Buffer.alloc(2_000, 1))]);
        const pixelTagAt = complete.indexOf(Buffer.from([0xe0, 0x7f, 0x10, 0x00]));
        expect(pixelTagAt).toBeGreaterThan(0);
        await expectEquivalent(Buffer.from(complete.subarray(0, pixelTagAt + 6)));
    });

    it('grows through non-pixel undefined-length OW elements, preserving the VR', async () => {
        // dicom-parser consumes such elements to EOF (no fragment semantics
        // outside 7FE0,0010) — the bounded path must mirror that exactly
        // rather than hopping, so the element grows and keeps its OW VR.
        const head12 = Buffer.concat([explicitEl('54001010', 'OW', Buffer.alloc(0)).subarray(0, 8), Buffer.from([0xff, 0xff, 0xff, 0xff])]);
        const payload = item(Buffer.alloc(3_000, 3));
        const delimiter = Buffer.concat([tagBytes('FFFEE0DD'), Buffer.alloc(4)]);
        const file = p10(TS.explicitLE, [Buffer.concat([head12, payload, delimiter])]);
        const assembled = await expectEquivalent(file);
        const parsed = parseDicomBuffer(assembled);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.value.data['54001010']).toEqual({ vr: 'OW' });
    });

    it('stays equivalent when the pixel header straddles a chunk boundary (explicit sweep)', async () => {
        // Meta ends near byte 206 and the chunk size is 256 — pads 0..40
        // walk the pixel-data header across the first chunk boundary,
        // covering partially-visible headers and exact-boundary stalls.
        for (let pad = 0; pad <= 40; pad += 2) {
            const file = p10(TS.explicitLE, [
                explicitEl('00104000', 'LT', evenPad('p'.repeat(pad))),
                explicitEl('7FE00010', 'OB', Buffer.alloc(2_000, 1)),
                explicitEl('FFFCFFFC', 'OB', Buffer.alloc(10, 0)),
            ]);
            await expectEquivalent(file);
        }
    });

    it('stays equivalent when the pixel header straddles a chunk boundary (implicit sweep)', async () => {
        for (let pad = 0; pad <= 40; pad += 2) {
            const file = p10(TS.implicitLE, [implicitEl('00104000', evenPad('p'.repeat(pad))), implicitEl('7FE00010', Buffer.alloc(2_000, 1))]);
            await expectEquivalent(file);
        }
    });

    it('stays equivalent when the encapsulated header straddles a chunk boundary (sweep)', async () => {
        for (let pad = 0; pad <= 40; pad += 2) {
            const file = p10(TS.jpegBaseline, [
                explicitEl('00104000', 'LT', evenPad('p'.repeat(pad))),
                encapsulatedPixelData(Buffer.alloc(2_000, 0xfe)),
                explicitEl('FFFCFFFC', 'OB', Buffer.alloc(10, 0)),
            ]);
            await expectEquivalent(file);
        }
    });

    it('grows through a truncated undefined-length sequence at a chunk boundary', async () => {
        const items = Array.from({ length: 20 }, (_, i) => item(explicitEl('00081090', 'LO', evenPad(`M-${String(i)}-${'z'.repeat(60)}`))));
        const sqHead = Buffer.concat([explicitEl('00081140', 'SQ', Buffer.alloc(0)).subarray(0, 8), Buffer.from([0xff, 0xff, 0xff, 0xff])]);
        const sqDelimiter = Buffer.concat([tagBytes('FFFEE0DD'), Buffer.alloc(4)]);
        const file = p10(TS.explicitLE, [Buffer.concat([sqHead, ...items, sqDelimiter]), explicitEl('7FE00010', 'OB', Buffer.alloc(2_000, 1))]);
        const assembled = await expectEquivalent(file);
        const parsed = parseDicomBuffer(assembled);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.value.data['00081140']?.Value).toHaveLength(20);
    });

    it('errs when the deadline passes during the bounded loop', async () => {
        const file = p10(TS.explicitLE, [explicitEl('00100020', 'LO', evenPad('PAT001')), explicitEl('7FE00010', 'OB', Buffer.alloc(2_000, 1))]);
        const path = await writeTemp(file);
        const result = await readDicomHead(path, { ...FORCE, timeoutMs: -1 });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('timed out');
    });
});

describe('readDicomHead — malformed structures fall back to full reads', () => {
    it('falls back when the meta group lacks a transfer syntax element', async () => {
        const sopClassEl = explicitEl('00020002', 'UI', evenPad('1.2.840.10008.5.1.4.1.1.7', '\0'));
        const groupLen = Buffer.alloc(4);
        groupLen.writeUInt32LE(sopClassEl.length, 0);
        const meta = Buffer.concat([explicitEl('00020000', 'UL', groupLen), sopClassEl]);
        const file = Buffer.concat([Buffer.alloc(128), Buffer.from('DICM', 'latin1'), meta, Buffer.alloc(2_000, 0x20)]);
        const path = await writeTemp(file);
        const result = await readDicomHead(path, FORCE);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.equals(file)).toBe(true);
    });

    /** Builds an encapsulated pixel-data element (undefined length) from raw item-stream bytes. */
    function encapsulatedRaw(itemStream: Buffer): Buffer {
        const head12 = Buffer.concat([explicitEl('7FE00010', 'OB', Buffer.alloc(0)).subarray(0, 8), Buffer.from([0xff, 0xff, 0xff, 0xff])]);
        return Buffer.concat([head12, itemStream]);
    }

    it('falls back when a fragment item overruns the file', async () => {
        const fragmentHeader = Buffer.concat([
            tagBytes('FFFEE000'),
            (() => {
                const b = Buffer.alloc(4);
                b.writeUInt32LE(50_000, 0);
                return b;
            })(),
        ]);
        const file = p10(TS.jpegBaseline, [
            explicitEl('00100020', 'LO', evenPad('PAT001')),
            encapsulatedRaw(Buffer.concat([item(Buffer.alloc(0)), fragmentHeader, Buffer.alloc(2_000, 1)])),
        ]);
        await expectEquivalent(file);
    });

    it('falls back on a non-item tag between fragments', async () => {
        const garbage = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x00, 0x00, 0x00, 0x00]);
        const file = p10(TS.jpegBaseline, [
            explicitEl('00100020', 'LO', evenPad('PAT001')),
            encapsulatedRaw(Buffer.concat([item(Buffer.alloc(0)), item(Buffer.alloc(2_000, 1)), garbage, Buffer.alloc(600, 0)])),
        ]);
        await expectEquivalent(file);
    });

    it('falls back on a fragment item with undefined length', async () => {
        const badItem = Buffer.concat([tagBytes('FFFEE000'), Buffer.from([0xff, 0xff, 0xff, 0xff])]);
        const file = p10(TS.jpegBaseline, [
            explicitEl('00100020', 'LO', evenPad('PAT001')),
            encapsulatedRaw(Buffer.concat([item(Buffer.alloc(0)), item(Buffer.alloc(2_000, 1)), badItem, Buffer.alloc(600, 0)])),
        ]);
        await expectEquivalent(file);
    });
});
