import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmdump } from './dcmdump';

vi.mock('../exec', () => ({
    execCommand: vi.fn(),
}));

vi.mock('./_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { execCommand } from '../exec';
import { resolveBinary } from './_resolveBinary';

const mockedExec = vi.mocked(execCommand);
const mockedResolve = vi.mocked(resolveBinary);

const SAMPLE_DUMP = `(0008,0060) CS [CT]           # 2, 1 Modality
(0010,0010) PN [Smith^John]   # 10, 1 PatientName
(0010,0020) LO [12345]        # 6, 1 PatientID`;

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmdump' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: SAMPLE_DUMP, stderr: '', exitCode: 0 },
    });
});

describe('dcmdump()', () => {
    it('dumps DICOM metadata as text', async () => {
        const result = await dcmdump('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe(SAMPLE_DUMP);
        }
    });

    it('passes input path as argument', async () => {
        await dcmdump('/path/to/test.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdump', ['/path/to/test.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes +L flag for short format', async () => {
        await dcmdump('/path/to/test.dcm', { format: 'short' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdump', ['+L', '/path/to/test.dcm'], expect.any(Object));
    });

    it('passes search tag flag', async () => {
        await dcmdump('/path/to/test.dcm', { searchTag: '(0010,0010)' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdump', ['+P', '(0010,0010)', '/path/to/test.dcm'], expect.any(Object));
    });

    it('passes allTags flag', async () => {
        await dcmdump('/path/to/test.dcm', { allTags: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdump', ['+P', 'all', '/path/to/test.dcm'], expect.any(Object));
    });

    it('passes printValues flag', async () => {
        await dcmdump('/path/to/test.dcm', { printValues: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdump', ['+Vr', '/path/to/test.dcm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmdump('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot open file', exitCode: 1 },
        });

        const result = await dcmdump('/path/to/nonexistent.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmdump failed');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dcmdump('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmdump('/path/to/test.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for invalid search tag', async () => {
        const result = await dcmdump('/path/to/test.dcm', { searchTag: 'bad-tag' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });
});
