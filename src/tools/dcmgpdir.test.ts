import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmgpdir } from './dcmgpdir';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmgpdir' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmgpdir()', () => {
    it('creates DICOMDIR from input files', async () => {
        const result = await dcmgpdir({
            inputFiles: ['/path/to/file1.dcm', '/path/to/file2.dcm'],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('DICOMDIR');
        }
    });

    it('passes correct arguments', async () => {
        await dcmgpdir({
            inputFiles: ['/path/to/file1.dcm', '/path/to/file2.dcm'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmgpdir',
            ['/path/to/file1.dcm', '/path/to/file2.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes outputFile flag', async () => {
        const result = await dcmgpdir({
            inputFiles: ['/path/to/file.dcm'],
            outputFile: '/output/DICOMDIR',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmgpdir', ['+D', '/output/DICOMDIR', '/path/to/file.dcm'], expect.any(Object));
        if (result.ok) {
            expect(result.value.outputPath).toBe('/output/DICOMDIR');
        }
    });

    it('passes filesetId flag', async () => {
        await dcmgpdir({
            inputFiles: ['/path/to/file.dcm'],
            filesetId: 'MY_FILESET',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmgpdir', ['+F', 'MY_FILESET', '/path/to/file.dcm'], expect.any(Object));
    });

    it('passes both outputFile and filesetId', async () => {
        await dcmgpdir({
            inputFiles: ['/path/to/file.dcm'],
            outputFile: '/output/DICOMDIR',
            filesetId: 'STUDY_SET',
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmgpdir',
            ['+D', '/output/DICOMDIR', '+F', 'STUDY_SET', '/path/to/file.dcm'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmgpdir({ inputFiles: ['/path/to/file.dcm'] });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot create DICOMDIR', exitCode: 1 },
        });

        const result = await dcmgpdir({ inputFiles: ['/path/to/file.dcm'] });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmgpdir failed');
        }
    });

    it('returns error for empty inputFiles', async () => {
        const result = await dcmgpdir({ inputFiles: [] });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dcmgpdir({ inputFiles: ['/path/to/file.dcm'] });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmgpdir({ inputFiles: ['/path/to/file.dcm'], timeoutMs: 60000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmgpdir', expect.any(Array), expect.objectContaining({ timeoutMs: 60000 }));
    });
});
