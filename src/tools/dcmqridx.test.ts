import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmqridx } from './dcmqridx';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmqridx' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmqridx()', () => {
    it('registers DICOM files in database', async () => {
        const result = await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
            inputFiles: ['/path/to/file1.dcm', '/path/to/file2.dcm'],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.mode).toBe('register');
        }
    });

    it('passes index directory and input files as arguments', async () => {
        await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
            inputFiles: ['/path/to/file.dcm'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmqridx',
            ['/var/lib/dcmtk/db', '/path/to/file.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes -p flag for print mode', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: 'DB contents here', stderr: '', exitCode: 0 },
        });

        const result = await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
            print: true,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.mode).toBe('print');
            if (result.value.mode === 'print') {
                expect(result.value.output).toBe('DB contents here');
            }
        }

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmqridx', ['-p', '/var/lib/dcmtk/db'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes -n flag when notNew is true', async () => {
        await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
            inputFiles: ['/path/to/file.dcm'],
            notNew: true,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmqridx',
            ['-n', '/var/lib/dcmtk/db', '/path/to/file.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when neither inputFiles nor print is specified', async () => {
        const result = await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
            inputFiles: ['/path/to/file.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot open index file', exitCode: 1 },
        });

        const result = await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
            inputFiles: ['/path/to/file.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmqridx failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot open index file');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
            inputFiles: ['/path/to/file.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('rejects empty indexDirectory', async () => {
        const result = await dcmqridx({
            indexDirectory: '',
            inputFiles: ['/path/to/file.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('respects custom timeout', async () => {
        await dcmqridx({
            indexDirectory: '/var/lib/dcmtk/db',
            inputFiles: ['/path/to/file.dcm'],
            timeoutMs: 15000,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmqridx',
            ['/var/lib/dcmtk/db', '/path/to/file.dcm'],
            expect.objectContaining({ timeoutMs: 15000 })
        );
    });
});
