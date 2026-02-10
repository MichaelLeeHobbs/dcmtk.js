import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmftest } from './dcmftest';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmftest' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: 'yes: /path/to/file.dcm', stderr: '', exitCode: 0 },
    });
});

describe('dcmftest()', () => {
    it('detects DICOM file', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: 'yes: /path/to/file.dcm', stderr: '', exitCode: 0 },
        });

        const result = await dcmftest('/path/to/file.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.isDicom).toBe(true);
        }
    });

    it('detects non-DICOM file', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: 'no: /path/to/file.txt', stderr: '', exitCode: 0 },
        });

        const result = await dcmftest('/path/to/file.txt');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.isDicom).toBe(false);
        }
    });

    it('passes correct arguments', async () => {
        await dcmftest('/path/to/file.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmftest', ['/path/to/file.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmftest('/path/to/file.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: unexpected error', exitCode: 1 },
        });

        const result = await dcmftest('/path/to/file.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmftest failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option key
        const result = await dcmftest('/path/to/file.dcm', { unknownKey: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dcmftest('/path/to/file.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmftest('/path/to/file.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmftest', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });
});
