import { describe, it, expect, vi, beforeEach } from 'vitest';
import { movescu, MoveQueryModel } from './movescu';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/movescu' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('movescu()', () => {
    it('sends C-MOVE request to host and port', async () => {
        const result = await movescu({ host: '192.168.1.100', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
        }
    });

    it('passes host and port as arguments', async () => {
        await movescu({ host: '192.168.1.100', port: 11112 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/movescu', ['192.168.1.100', '11112'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes calling AE title', async () => {
        await movescu({ host: 'localhost', port: 104, callingAETitle: 'MYSCU' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/movescu', ['-aet', 'MYSCU', 'localhost', '104'], expect.any(Object));
    });

    it('passes called AE title', async () => {
        await movescu({ host: 'localhost', port: 104, calledAETitle: 'PACS' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/movescu', ['-aec', 'PACS', 'localhost', '104'], expect.any(Object));
    });

    it('passes patient query model flag', async () => {
        await movescu({ host: 'localhost', port: 104, queryModel: MoveQueryModel.PATIENT });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/movescu', ['-P', 'localhost', '104'], expect.any(Object));
    });

    it('passes study query model flag', async () => {
        await movescu({ host: 'localhost', port: 104, queryModel: MoveQueryModel.STUDY });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/movescu', ['-S', 'localhost', '104'], expect.any(Object));
    });

    it('passes move destination', async () => {
        await movescu({ host: 'localhost', port: 104, moveDestination: 'LOCALAE' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/movescu', ['-aem', 'LOCALAE', 'localhost', '104'], expect.any(Object));
    });

    it('passes output directory', async () => {
        await movescu({ host: 'localhost', port: 104, outputDirectory: '/tmp/dicom' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/movescu', ['-od', '/tmp/dicom', 'localhost', '104'], expect.any(Object));
    });

    it('passes query keys', async () => {
        await movescu({
            host: 'localhost',
            port: 104,
            keys: ['0020,000D=1.2.3.4', '0008,0052=STUDY'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/movescu',
            ['-k', '0020,000D=1.2.3.4', '-k', '0008,0052=STUDY', 'localhost', '104'],
            expect.any(Object)
        );
    });

    it('passes all options combined', async () => {
        await movescu({
            host: 'myhost',
            port: 4242,
            callingAETitle: 'ME',
            calledAETitle: 'THEM',
            queryModel: 'study',
            moveDestination: 'DEST',
            outputDirectory: '/out',
            keys: ['0020,000D=1.2.3'],
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/movescu',
            ['-aet', 'ME', '-aec', 'THEM', '-S', '-aem', 'DEST', '-od', '/out', '-k', '0020,000D=1.2.3', 'myhost', '4242'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await movescu({ host: 'localhost', port: 104 });

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

        const result = await movescu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('movescu failed');
            expect(result.error.message).toContain('association refused');
        }
    });

    it('returns error for empty host', async () => {
        const result = await movescu({ host: '', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for invalid port', async () => {
        const result = await movescu({ host: 'localhost', port: 99999 });

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

        const result = await movescu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timeout');
        }
    });

    it('uses custom timeout', async () => {
        await movescu({ host: 'localhost', port: 104, timeoutMs: 60000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/movescu', expect.any(Array), expect.objectContaining({ timeoutMs: 60000 }));
    });

    it('includes stderr in successful result', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'I: Requesting Association', exitCode: 0 },
        });

        const result = await movescu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stderr).toContain('Requesting Association');
        }
    });
});
