import { describe, it, expect, vi, beforeEach } from 'vitest';
import { termscu } from './termscu';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/termscu' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('termscu()', () => {
    it('terminates association with host and port', async () => {
        const result = await termscu({ host: '192.168.1.100', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
        }
    });

    it('passes host and port as arguments', async () => {
        await termscu({ host: '192.168.1.100', port: 11112 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/termscu', ['192.168.1.100', '11112'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes calling and called AE titles', async () => {
        await termscu({
            host: 'localhost',
            port: 104,
            callingAETitle: 'MYSCU',
            calledAETitle: 'PACS',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/termscu', ['-aet', 'MYSCU', '-aec', 'PACS', 'localhost', '104'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await termscu({ host: 'localhost', port: 104 });

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

        const result = await termscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('termscu failed');
            expect(result.error.message).toContain('association refused');
        }
    });

    it('returns error for invalid port', async () => {
        const result = await termscu({ host: 'localhost', port: 99999 });

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

        const result = await termscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('timeout');
        }
    });

    it('respects custom timeout', async () => {
        await termscu({ host: 'localhost', port: 104, timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/termscu', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });
});
