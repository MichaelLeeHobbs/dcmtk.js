import { describe, it, expect, vi, beforeEach } from 'vitest';
import { img2dcm, Img2dcmInputFormat } from './img2dcm';

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

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/img2dcm' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('img2dcm()', () => {
    it('converts image to DICOM', async () => {
        const result = await img2dcm('/path/photo.jpg', '/path/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/output.dcm');
        }
    });

    it('passes correct arguments', async () => {
        await img2dcm('/path/photo.jpg', '/path/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/img2dcm',
            ['/path/photo.jpg', '/path/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes -i jp flag for jpeg inputFormat', async () => {
        await img2dcm('/path/photo.jpg', '/path/output.dcm', { inputFormat: Img2dcmInputFormat.JPEG });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/img2dcm', ['-i', 'jp', '/path/photo.jpg', '/path/output.dcm'], expect.any(Object));
    });

    it('passes -i bmp flag for bmp inputFormat', async () => {
        await img2dcm('/path/photo.bmp', '/path/output.dcm', { inputFormat: Img2dcmInputFormat.BMP });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/img2dcm', ['-i', 'bmp', '/path/photo.bmp', '/path/output.dcm'], expect.any(Object));
    });

    it('passes -df flag for datasetFrom', async () => {
        await img2dcm('/path/photo.jpg', '/path/output.dcm', { datasetFrom: '/path/template.dcm' });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/img2dcm',
            ['-df', '/path/template.dcm', '/path/photo.jpg', '/path/output.dcm'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await img2dcm('/path/photo.jpg', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot convert', exitCode: 1 },
        });

        const result = await img2dcm('/path/photo.jpg', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('img2dcm failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await img2dcm('/path/photo.jpg', '/path/output.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await img2dcm('/path/photo.jpg', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await img2dcm('/path/photo.jpg', '/path/output.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/img2dcm', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });
});
