import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getscu, GetQueryModel } from './getscu';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/getscu' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('getscu()', () => {
    it('sends C-GET request to host and port', async () => {
        const result = await getscu({ host: '192.168.1.100', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
        }
    });

    it('passes host and port as arguments', async () => {
        await getscu({ host: '192.168.1.100', port: 11112 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/getscu', ['192.168.1.100', '11112'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes calling AE title', async () => {
        await getscu({ host: 'localhost', port: 104, callingAETitle: 'MYSCU' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/getscu', ['-aet', 'MYSCU', 'localhost', '104'], expect.any(Object));
    });

    it('passes called AE title', async () => {
        await getscu({ host: 'localhost', port: 104, calledAETitle: 'PACS' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/getscu', ['-aec', 'PACS', 'localhost', '104'], expect.any(Object));
    });

    it('passes patient query model flag', async () => {
        await getscu({ host: 'localhost', port: 104, queryModel: GetQueryModel.PATIENT });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/getscu', ['-P', 'localhost', '104'], expect.any(Object));
    });

    it('passes study query model flag', async () => {
        await getscu({ host: 'localhost', port: 104, queryModel: GetQueryModel.STUDY });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/getscu', ['-S', 'localhost', '104'], expect.any(Object));
    });

    it('passes output directory', async () => {
        await getscu({ host: 'localhost', port: 104, outputDirectory: '/tmp/dicom' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/getscu', ['-od', '/tmp/dicom', 'localhost', '104'], expect.any(Object));
    });

    it('passes query keys', async () => {
        await getscu({
            host: 'localhost',
            port: 104,
            keys: ['0020,000D=1.2.3.4', '0008,0052=STUDY'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/getscu',
            ['-k', '0020,000D=1.2.3.4', '-k', '0008,0052=STUDY', 'localhost', '104'],
            expect.any(Object)
        );
    });

    it('passes all options combined', async () => {
        await getscu({
            host: 'myhost',
            port: 4242,
            callingAETitle: 'ME',
            calledAETitle: 'THEM',
            queryModel: 'study',
            outputDirectory: '/out',
            keys: ['0020,000D=1.2.3'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/getscu',
            ['-aet', 'ME', '-aec', 'THEM', '-S', '-od', '/out', '-k', '0020,000D=1.2.3', 'myhost', '4242'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await getscu({ host: 'localhost', port: 104 });

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

        const result = await getscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('getscu failed');
            expect(result.error.message).toContain('association refused');
        }
    });

    it('returns error for empty host', async () => {
        const result = await getscu({ host: '', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for invalid port', async () => {
        const result = await getscu({ host: 'localhost', port: 99999 });

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

        const result = await getscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timeout');
        }
    });

    it('uses custom timeout', async () => {
        await getscu({ host: 'localhost', port: 104, timeoutMs: 60000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/getscu', expect.any(Array), expect.objectContaining({ timeoutMs: 60000 }));
    });

    it('includes stderr in successful result', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'I: Requesting Association', exitCode: 0 },
        });

        const result = await getscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stderr).toContain('Requesting Association');
        }
    });
});
