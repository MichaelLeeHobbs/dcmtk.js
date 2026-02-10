import { describe, it, expect, vi, beforeEach } from 'vitest';
import { echoscu } from './echoscu';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/echoscu' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('echoscu()', () => {
    it('sends C-ECHO to host and port', async () => {
        const result = await echoscu({ host: '192.168.1.100', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
        }
    });

    it('passes host and port as arguments', async () => {
        await echoscu({ host: '192.168.1.100', port: 11112 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/echoscu', ['192.168.1.100', '11112'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes calling AE title', async () => {
        await echoscu({ host: 'localhost', port: 104, callingAETitle: 'MYSCU' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/echoscu', ['-aet', 'MYSCU', 'localhost', '104'], expect.any(Object));
    });

    it('passes called AE title', async () => {
        await echoscu({ host: 'localhost', port: 104, calledAETitle: 'PACS' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/echoscu', ['-aec', 'PACS', 'localhost', '104'], expect.any(Object));
    });

    it('passes both AE titles', async () => {
        await echoscu({
            host: 'localhost',
            port: 104,
            callingAETitle: 'MYSCU',
            calledAETitle: 'PACS',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/echoscu', ['-aet', 'MYSCU', '-aec', 'PACS', 'localhost', '104'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await echoscu({ host: 'localhost', port: 104 });

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

        const result = await echoscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('echoscu failed');
            expect(result.error.message).toContain('association refused');
        }
    });

    it('returns error for invalid port', async () => {
        const result = await echoscu({ host: 'localhost', port: 99999 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for empty host', async () => {
        const result = await echoscu({ host: '', port: 104 });

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

        const result = await echoscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timeout');
        }
    });

    it('includes stderr in successful result for diagnostics', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'I: Requesting Association', exitCode: 0 },
        });

        const result = await echoscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stderr).toContain('Requesting Association');
        }
    });
});
