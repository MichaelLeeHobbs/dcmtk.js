import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmmkdir } from './dcmmkdir';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmmkdir' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmmkdir()', () => {
    it('creates DICOMDIR from input files', async () => {
        const result = await dcmmkdir({
            inputFiles: ['/path/to/file1.dcm', '/path/to/file2.dcm'],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('DICOMDIR');
        }
    });

    it('passes correct arguments', async () => {
        await dcmmkdir({
            inputFiles: ['/path/to/file1.dcm', '/path/to/file2.dcm'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmmkdir',
            ['/path/to/file1.dcm', '/path/to/file2.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes outputFile flag', async () => {
        const result = await dcmmkdir({
            inputFiles: ['/path/to/file.dcm'],
            outputFile: '/output/DICOMDIR',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmkdir', ['+D', '/output/DICOMDIR', '/path/to/file.dcm'], expect.any(Object));
        if (result.ok) {
            expect(result.value.outputPath).toBe('/output/DICOMDIR');
        }
    });

    it('passes filesetId flag', async () => {
        await dcmmkdir({
            inputFiles: ['/path/to/file.dcm'],
            filesetId: 'MY_FILESET',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmkdir', ['+F', 'MY_FILESET', '/path/to/file.dcm'], expect.any(Object));
    });

    it('passes +A flag for append', async () => {
        await dcmmkdir({
            inputFiles: ['/path/to/file.dcm'],
            append: true,
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmkdir', ['+A', '/path/to/file.dcm'], expect.any(Object));
    });

    it('passes all options together', async () => {
        await dcmmkdir({
            inputFiles: ['/path/to/file.dcm'],
            outputFile: '/output/DICOMDIR',
            filesetId: 'STUDY_SET',
            append: true,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmmkdir',
            ['+D', '/output/DICOMDIR', '+F', 'STUDY_SET', '+A', '/path/to/file.dcm'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmmkdir({ inputFiles: ['/path/to/file.dcm'] });

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

        const result = await dcmmkdir({ inputFiles: ['/path/to/file.dcm'] });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmmkdir failed');
        }
    });

    it('returns error for empty inputFiles', async () => {
        const result = await dcmmkdir({ inputFiles: [] });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dcmmkdir({ inputFiles: ['/path/to/file.dcm'] });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmmkdir({ inputFiles: ['/path/to/file.dcm'], timeoutMs: 60000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmkdir', expect.any(Array), expect.objectContaining({ timeoutMs: 60000 }));
    });
});
