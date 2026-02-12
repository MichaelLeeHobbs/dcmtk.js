import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from '../types';
import { DicomDataset } from '../dicom/DicomDataset';

vi.mock('node:fs/promises', () => ({
    mkdtemp: vi.fn(),
    readdir: vi.fn(),
    rm: vi.fn(),
}));

vi.mock('../tools/dcm2json', () => ({
    dcm2json: vi.fn(),
}));

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { dcm2json } from '../tools/dcm2json';
import { createTempDir, listDcmFiles, cleanupTempDir, parseSingleFile, parseExtractedFiles, MAX_RESPONSE_FILES } from './parseResults';

const mockedMkdtemp = vi.mocked(mkdtemp);
const mockedReaddir = vi.mocked(readdir);
const mockedRm = vi.mocked(rm);
const mockedDcm2json = vi.mocked(dcm2json);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('createTempDir', () => {
    it('returns the created directory path', async () => {
        mockedMkdtemp.mockResolvedValue('/tmp/dcmtk-pacs-abc123');
        const result = await createTempDir();
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBe('/tmp/dcmtk-pacs-abc123');
        }
    });

    it('returns error when mkdtemp fails', async () => {
        mockedMkdtemp.mockRejectedValue(new Error('permission denied'));
        const result = await createTempDir();
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('Failed to create temp directory');
        }
    });

    it('wraps non-Error throws', async () => {
        mockedMkdtemp.mockRejectedValue('string error');
        const result = await createTempDir();
        expect(result.ok).toBe(false);
    });
});

describe('listDcmFiles', () => {
    it('lists only .dcm files sorted', async () => {
        mockedReaddir.mockResolvedValue(['b.dcm', 'a.dcm', 'readme.txt'] as never);
        const result = await listDcmFiles('/tmp/test');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(2);
            // Sorted: a.dcm before b.dcm (full paths)
            expect(result.value[0]).toContain('a.dcm');
            expect(result.value[1]).toContain('b.dcm');
        }
    });

    it('returns empty array for empty directory', async () => {
        mockedReaddir.mockResolvedValue([] as never);
        const result = await listDcmFiles('/tmp/empty');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(0);
        }
    });

    it('bounds file count to MAX_RESPONSE_FILES', async () => {
        const entries: string[] = [];
        for (let i = 0; i < MAX_RESPONSE_FILES + 100; i += 1) {
            entries.push(`file${String(i).padStart(6, '0')}.dcm`);
        }
        mockedReaddir.mockResolvedValue(entries as never);
        const result = await listDcmFiles('/tmp/large');
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(MAX_RESPONSE_FILES);
        }
    });

    it('returns error when readdir fails', async () => {
        mockedReaddir.mockRejectedValue(new Error('ENOENT'));
        const result = await listDcmFiles('/tmp/nonexistent');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('Failed to list directory');
        }
    });
});

describe('cleanupTempDir', () => {
    it('calls rm with recursive and force options', async () => {
        mockedRm.mockResolvedValue();
        await cleanupTempDir('/tmp/test');
        expect(mockedRm).toHaveBeenCalledWith('/tmp/test', { recursive: true, force: true });
    });

    it('silently ignores rm errors', async () => {
        mockedRm.mockRejectedValue(new Error('EPERM'));
        // Should not throw
        await expect(cleanupTempDir('/tmp/test')).resolves.toBeUndefined();
    });
});

describe('parseSingleFile', () => {
    it('parses a DICOM file into a DicomDataset', async () => {
        const mockJson = { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'DOE^JOHN' }] } };
        mockedDcm2json.mockResolvedValue(ok({ data: mockJson, source: 'xml' as const }));
        const result = await parseSingleFile('/tmp/test.dcm', 30000);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBeInstanceOf(DicomDataset);
        }
    });

    it('returns error when dcm2json fails', async () => {
        mockedDcm2json.mockResolvedValue(err(new Error('parse failed')));
        const result = await parseSingleFile('/tmp/bad.dcm', 30000);
        expect(result.ok).toBe(false);
    });

    it('passes timeout and signal to dcm2json', async () => {
        const controller = new AbortController();
        const mockJson = { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'TEST' }] } };
        mockedDcm2json.mockResolvedValue(ok({ data: mockJson, source: 'xml' as const }));
        await parseSingleFile('/tmp/test.dcm', 5000, controller.signal);
        expect(mockedDcm2json).toHaveBeenCalledWith('/tmp/test.dcm', {
            timeoutMs: 5000,
            signal: controller.signal,
        });
    });
});

describe('parseExtractedFiles', () => {
    it('parses all dcm files in the directory', async () => {
        mockedReaddir.mockResolvedValue(['a.dcm', 'b.dcm'] as never);
        const mockJson = { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'TEST' }] } };
        mockedDcm2json.mockResolvedValue(ok({ data: mockJson, source: 'xml' as const }));

        const result = await parseExtractedFiles('/tmp/test', 30000, 5);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(2);
        }
    });

    it('returns empty array for empty directory', async () => {
        mockedReaddir.mockResolvedValue([] as never);
        const result = await parseExtractedFiles('/tmp/empty', 30000, 5);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(0);
        }
    });

    it('skips files that fail to parse', async () => {
        mockedReaddir.mockResolvedValue(['good.dcm', 'bad.dcm'] as never);
        const mockJson = { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'TEST' }] } };
        mockedDcm2json.mockResolvedValueOnce(ok({ data: mockJson, source: 'xml' as const })).mockResolvedValueOnce(err(new Error('corrupt file')));

        const result = await parseExtractedFiles('/tmp/test', 30000, 5);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(1);
        }
    });

    it('returns error when listDcmFiles fails', async () => {
        mockedReaddir.mockRejectedValue(new Error('ENOENT'));
        const result = await parseExtractedFiles('/tmp/bad', 30000, 5);
        expect(result.ok).toBe(false);
    });

    it('throttles when file count exceeds concurrency', async () => {
        const entries: string[] = [];
        for (let i = 0; i < 10; i += 1) {
            entries.push(`file${i}.dcm`);
        }
        mockedReaddir.mockResolvedValue(entries as never);
        const mockJson = { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'TEST' }] } };
        mockedDcm2json.mockResolvedValue(ok({ data: mockJson, source: 'xml' as const }));

        const result = await parseExtractedFiles('/tmp/test', 30000, 2);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toHaveLength(10);
        }
    });

    it('respects abort signal', async () => {
        const entries: string[] = [];
        for (let i = 0; i < 20; i += 1) {
            entries.push(`file${i}.dcm`);
        }
        mockedReaddir.mockResolvedValue(entries as never);

        const controller = new AbortController();
        controller.abort();

        const mockJson = { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'TEST' }] } };
        mockedDcm2json.mockResolvedValue(ok({ data: mockJson, source: 'xml' as const }));

        const result = await parseExtractedFiles('/tmp/test', 30000, 2, controller.signal);
        expect(result.ok).toBe(true);
        // Aborted before any files processed
        if (result.ok) {
            expect(result.value.length).toBeLessThan(20);
        }
    });
});
