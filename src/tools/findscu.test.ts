import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findscu, QueryModel } from './findscu';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/findscu' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('findscu()', () => {
    it('sends C-FIND query to host and port', async () => {
        const result = await findscu({ host: '192.168.1.100', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
        }
    });

    it('passes host and port as arguments', async () => {
        await findscu({ host: '192.168.1.100', port: 11112 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/findscu', ['192.168.1.100', '11112'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes calling AE title', async () => {
        await findscu({ host: 'localhost', port: 104, callingAETitle: 'MYSCU' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/findscu', ['-aet', 'MYSCU', 'localhost', '104'], expect.any(Object));
    });

    it('passes called AE title', async () => {
        await findscu({ host: 'localhost', port: 104, calledAETitle: 'PACS' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/findscu', ['-aec', 'PACS', 'localhost', '104'], expect.any(Object));
    });

    it('passes worklist query model flag', async () => {
        await findscu({ host: 'localhost', port: 104, queryModel: QueryModel.WORKLIST });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/findscu', ['-W', 'localhost', '104'], expect.any(Object));
    });

    it('passes patient query model flag', async () => {
        await findscu({ host: 'localhost', port: 104, queryModel: QueryModel.PATIENT });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/findscu', ['-P', 'localhost', '104'], expect.any(Object));
    });

    it('passes study query model flag', async () => {
        await findscu({ host: 'localhost', port: 104, queryModel: QueryModel.STUDY });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/findscu', ['-S', 'localhost', '104'], expect.any(Object));
    });

    it('passes query keys', async () => {
        await findscu({
            host: 'localhost',
            port: 104,
            keys: ['0008,0050=', '0010,0020=PATIENT1'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/findscu',
            ['-k', '0008,0050=', '-k', '0010,0020=PATIENT1', 'localhost', '104'],
            expect.any(Object)
        );
    });

    it('passes all options combined', async () => {
        await findscu({
            host: 'myhost',
            port: 4242,
            callingAETitle: 'ME',
            calledAETitle: 'THEM',
            queryModel: 'study',
            keys: ['0010,0020=PAT1'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/findscu',
            ['-aet', 'ME', '-aec', 'THEM', '-S', '-k', '0010,0020=PAT1', 'myhost', '4242'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await findscu({ host: 'localhost', port: 104 });

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

        const result = await findscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('findscu failed');
            expect(result.error.message).toContain('association refused');
        }
    });

    it('returns error for empty host', async () => {
        const result = await findscu({ host: '', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for invalid port', async () => {
        const result = await findscu({ host: 'localhost', port: 0 });

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

        const result = await findscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timeout');
        }
    });

    it('uses custom timeout', async () => {
        await findscu({ host: 'localhost', port: 104, timeoutMs: 60000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/findscu', expect.any(Array), expect.objectContaining({ timeoutMs: 60000 }));
    });

    it('includes stderr in successful result', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'I: Requesting Association', exitCode: 0 },
        });

        const result = await findscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stderr).toContain('Requesting Association');
        }
    });
});
