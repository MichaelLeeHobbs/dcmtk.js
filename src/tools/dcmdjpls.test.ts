import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmdjpls, JplsColorConversion } from './dcmdjpls';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmdjpls' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmdjpls()', () => {
    it('decompresses a JPEG-LS-compressed DICOM file', async () => {
        const result = await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.dcm');
        }
    });

    it('passes input and output paths as arguments', async () => {
        await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmdjpls',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes +cp flag for photometric color conversion', async () => {
        await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm', {
            colorConversion: JplsColorConversion.PHOTOMETRIC,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmdjpls',
            ['+cp', '/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes +ca flag for always color conversion', async () => {
        await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm', {
            colorConversion: JplsColorConversion.ALWAYS,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmdjpls',
            ['+ca', '/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes +cn flag for never color conversion', async () => {
        await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm', {
            colorConversion: JplsColorConversion.NEVER,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmdjpls',
            ['+cn', '/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot decompress DICOM file', exitCode: 1 },
        });

        const result = await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmdjpls failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot decompress DICOM file');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid color conversion value
        const result = await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm', { colorConversion: 'bogus' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmdjpls('/path/to/input.dcm', '/path/to/output.dcm', { timeoutMs: 8000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmdjpls',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 8000 })
        );
    });
});
