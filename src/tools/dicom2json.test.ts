import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { ok, err } from '../types';
import { TS, evenPad, explicitEl, p10 } from '../../test/helpers/p10';

vi.mock('./dcm2json', () => ({
    dcm2json: vi.fn(),
}));

import { dcm2json } from './dcm2json';
import { dicom2json, dicom2jsonFromBuffer } from './dicom2json';

const mockedDcm2json = vi.mocked(dcm2json);

const VALID_FILE = p10(TS.explicitLE, [explicitEl('00100010', 'PN', evenPad('Smith^John')), explicitEl('00100020', 'LO', evenPad('PAT001'))]);

let tempDir: string;
let validPath: string;
let garbagePath: string;

beforeEach(async () => {
    vi.clearAllMocks();
    if (tempDir === undefined) {
        tempDir = await mkdtemp(join(tmpdir(), 'dicom2json-test-'));
        validPath = join(tempDir, 'valid.dcm');
        garbagePath = join(tempDir, 'garbage.dcm');
        await writeFile(validPath, VALID_FILE);
        await writeFile(garbagePath, Buffer.from('not dicom '.repeat(20)));
    }
});

afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
});

describe('dicom2json', () => {
    it('parses a DICOM file to the JSON Model', async () => {
        const result = await dicom2json(validPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.source).toBe('js');
            expect(result.value.data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Smith^John' }] });
            expect(result.value.data['00100020']).toEqual({ vr: 'LO', Value: ['PAT001'] });
            expect(result.value.warnings).toEqual([]);
        }
    });

    it('rejects unknown options', async () => {
        const result = await dicom2json(validPath, { bogus: true } as never);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('invalid options');
    });

    it('rejects invalid option types', async () => {
        const result = await dicom2json(validPath, { timeoutMs: -1 });
        expect(result.ok).toBe(false);
    });

    it('returns a read error for a missing file', async () => {
        const result = await dicom2json(join(tempDir, 'nope.dcm'));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('failed to read');
    });

    it('returns an abort error when the signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        const result = await dicom2json(validPath, { signal: controller.signal });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('aborted');
    });

    it('returns the parse error without fallback by default', async () => {
        const result = await dicom2json(garbagePath);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('Failed to parse DICOM data');
        expect(mockedDcm2json).not.toHaveBeenCalled();
    });

    it('falls back to dcm2json when dcmtkFallback is set', async () => {
        const fallbackData = { '00100020': { vr: 'LO', Value: ['FROM-DCMTK'] } };
        mockedDcm2json.mockResolvedValue(ok({ data: fallbackData, source: 'xml' as const }));
        const result = await dicom2json(garbagePath, { dcmtkFallback: true, charsetAssume: 'latin-1' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.source).toBe('xml');
            expect(result.value.data).toEqual(fallbackData);
        }
        expect(mockedDcm2json).toHaveBeenCalledWith(
            garbagePath,
            expect.objectContaining({
                charsetAssume: 'latin-1',
                timeoutMs: expect.any(Number) as number,
            })
        );
    });

    it('aggregates both errors when the fallback also fails', async () => {
        mockedDcm2json.mockResolvedValue(err(new Error('binary exploded')));
        const result = await dicom2json(garbagePath, { dcmtkFallback: true });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('both engines failed');
            expect(result.error.message).toContain('Failed to parse DICOM data');
            expect(result.error.message).toContain('binary exploded');
        }
    });

    it('skips the fallback when the timeout budget is exhausted', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(30_001);
        const result = await dicom2json(garbagePath, { dcmtkFallback: true });
        nowSpy.mockRestore();
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timeout budget exhausted');
            expect(result.error.message).toContain('Failed to parse DICOM data');
        }
        expect(mockedDcm2json).not.toHaveBeenCalled();
    });

    it('also falls back on file read errors when fallback is enabled', async () => {
        mockedDcm2json.mockResolvedValue(ok({ data: {}, source: 'xml' as const }));
        const result = await dicom2json(join(tempDir, 'nope.dcm'), { dcmtkFallback: true });
        expect(result.ok).toBe(true);
        expect(mockedDcm2json).toHaveBeenCalledOnce();
    });
});

describe('dicom2jsonFromBuffer', () => {
    it('parses an in-memory buffer', () => {
        const result = dicom2jsonFromBuffer(VALID_FILE);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.source).toBe('js');
            expect(result.value.data['00100020']).toEqual({ vr: 'LO', Value: ['PAT001'] });
        }
    });

    it('applies charset options', () => {
        const file = p10(TS.explicitLE, [explicitEl('00100010', 'PN', evenPad('M\xfcller'))]);
        const result = dicom2jsonFromBuffer(file, { charsetAssume: 'latin-1' });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.data['00100010']).toEqual({ vr: 'PN', Value: [{ Alphabetic: 'Müller' }] });
    });

    it('rejects unknown options', () => {
        const result = dicom2jsonFromBuffer(VALID_FILE, { timeoutMs: 5 } as never);
        expect(result.ok).toBe(false);
    });

    it('returns an error for a non-DICOM buffer', () => {
        const result = dicom2jsonFromBuffer(Buffer.from('junk'.repeat(50)));
        expect(result.ok).toBe(false);
    });
});
