import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmprscu } from './dcmprscu';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmprscu' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmprscu()', () => {
    it('sends a DICOM print job to a remote printer', async () => {
        const result = await dcmprscu({ host: '192.168.1.100', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
        }
    });

    it('passes host and port as arguments', async () => {
        await dcmprscu({ host: '192.168.1.100', port: 11112 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmprscu', ['192.168.1.100', '11112'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes calling AE title', async () => {
        await dcmprscu({ host: 'localhost', port: 104, callingAETitle: 'MYSCU' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmprscu', ['-aet', 'MYSCU', 'localhost', '104'], expect.any(Object));
    });

    it('passes called AE title', async () => {
        await dcmprscu({ host: 'localhost', port: 104, calledAETitle: 'PRINTER' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmprscu', ['-aec', 'PRINTER', 'localhost', '104'], expect.any(Object));
    });

    it('passes config file flag', async () => {
        await dcmprscu({ host: 'localhost', port: 104, configFile: '/path/to/config.cfg' });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmprscu', ['-c', '/path/to/config.cfg', 'localhost', '104'], expect.any(Object));
    });

    it('passes all options together', async () => {
        await dcmprscu({
            host: 'localhost',
            port: 104,
            callingAETitle: 'MYSCU',
            calledAETitle: 'PRINTER',
            configFile: '/path/to/config.cfg',
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmprscu',
            ['-aet', 'MYSCU', '-aec', 'PRINTER', '-c', '/path/to/config.cfg', 'localhost', '104'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmprscu({ host: 'localhost', port: 104 });

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

        const result = await dcmprscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmprscu failed');
            expect(result.error.message).toContain('association refused');
        }
    });

    it('returns error for invalid port', async () => {
        const result = await dcmprscu({ host: 'localhost', port: 99999 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for empty host', async () => {
        const result = await dcmprscu({ host: '', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('includes stderr in successful result for diagnostics', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'I: Requesting Association', exitCode: 0 },
        });

        const result = await dcmprscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.stderr).toContain('Requesting Association');
        }
    });
});
