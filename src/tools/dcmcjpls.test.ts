import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmcjpls } from './dcmcjpls';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmcjpls' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmcjpls()', () => {
    it('compresses a DICOM file with JPEG-LS encoding', async () => {
        const result = await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.dcm');
        }
    });

    it('passes input and output paths as arguments', async () => {
        await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmcjpls',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes +el flag when lossless is true', async () => {
        await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm', { lossless: true });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmcjpls',
            ['+el', '/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes +en flag when lossless is false (near-lossless)', async () => {
        await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm', { lossless: false });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmcjpls',
            ['+en', '/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes +md flag with maxDeviation value', async () => {
        await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm', { maxDeviation: 5 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmcjpls',
            ['+md', '5', '/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot compress DICOM file', exitCode: 1 },
        });

        const result = await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmcjpls failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot compress DICOM file');
        }
    });

    it('returns error for invalid maxDeviation value', async () => {
        const result = await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm', { maxDeviation: -1 });

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

        const result = await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmcjpls('/path/to/input.dcm', '/path/to/output.dcm', { timeoutMs: 10000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmcjpls',
            ['/path/to/input.dcm', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 10000 })
        );
    });
});
