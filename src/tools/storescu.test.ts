import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storescu } from './storescu';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/storescu' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('storescu()', () => {
    it('sends DICOM files to remote host', async () => {
        const result = await storescu({
            host: '192.168.1.100',
            port: 104,
            files: ['/path/to/study.dcm'],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
        }
    });

    it('passes host, port, and files as arguments', async () => {
        await storescu({
            host: '192.168.1.100',
            port: 11112,
            files: ['/path/to/a.dcm', '/path/to/b.dcm'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/storescu',
            ['192.168.1.100', '11112', '/path/to/a.dcm', '/path/to/b.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes calling AE title', async () => {
        await storescu({
            host: 'localhost',
            port: 104,
            files: ['/test.dcm'],
            callingAETitle: 'MYSCU',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/storescu', ['-aet', 'MYSCU', 'localhost', '104', '/test.dcm'], expect.any(Object));
    });

    it('passes called AE title', async () => {
        await storescu({
            host: 'localhost',
            port: 104,
            files: ['/test.dcm'],
            calledAETitle: 'PACS',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/storescu', ['-aec', 'PACS', 'localhost', '104', '/test.dcm'], expect.any(Object));
    });

    it('passes scan directories flag', async () => {
        await storescu({
            host: 'localhost',
            port: 104,
            files: ['/dicom/folder'],
            scanDirectories: true,
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/storescu', ['+sd', 'localhost', '104', '/dicom/folder'], expect.any(Object));
    });

    it('passes recurse flag', async () => {
        await storescu({
            host: 'localhost',
            port: 104,
            files: ['/dicom/folder'],
            recurse: true,
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/storescu', ['+r', 'localhost', '104', '/dicom/folder'], expect.any(Object));
    });

    it('passes all options combined', async () => {
        await storescu({
            host: 'myhost',
            port: 4242,
            files: ['/a.dcm'],
            callingAETitle: 'ME',
            calledAETitle: 'THEM',
            scanDirectories: true,
            recurse: true,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/storescu',
            ['-aet', 'ME', '-aec', 'THEM', '+sd', '+r', 'myhost', '4242', '/a.dcm'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await storescu({
            host: 'localhost',
            port: 104,
            files: ['/test.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: association refused', exitCode: 1 },
        });

        const result = await storescu({
            host: 'localhost',
            port: 104,
            files: ['/test.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('storescu failed');
            expect(result.error.message).toContain('association refused');
        }
    });

    it('returns error for empty host', async () => {
        const result = await storescu({
            host: '',
            port: 104,
            files: ['/test.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for invalid port', async () => {
        const result = await storescu({
            host: 'localhost',
            port: 99999,
            files: ['/test.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for empty files array', async () => {
        const result = await storescu({
            host: 'localhost',
            port: 104,
            files: [],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: timeout'),
        });

        const result = await storescu({
            host: 'localhost',
            port: 104,
            files: ['/test.dcm'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timeout');
        }
    });

    it('uses custom timeout', async () => {
        await storescu({
            host: 'localhost',
            port: 104,
            files: ['/test.dcm'],
            timeoutMs: 60000,
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/storescu', expect.any(Array), expect.objectContaining({ timeoutMs: 60000 }));
    });

    it('includes stderr in successful result', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'I: Sending file', exitCode: 0 },
        });

        const result = await storescu({
            host: 'localhost',
            port: 104,
            files: ['/test.dcm'],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stderr).toContain('Sending file');
        }
    });
});
