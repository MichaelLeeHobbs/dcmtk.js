import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmpsprt } from './dcmpsprt';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmpsprt' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: 'Print job rendered successfully', stderr: '', exitCode: 0 },
    });
});

describe('dcmpsprt()', () => {
    it('reads a DICOM print job and returns text output', async () => {
        const result = await dcmpsprt('/path/to/printjob.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe('Print job rendered successfully');
        }
    });

    it('passes correct default arguments', async () => {
        await dcmpsprt('/path/to/printjob.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmpsprt', ['/path/to/printjob.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes config file flag', async () => {
        await dcmpsprt('/path/to/printjob.dcm', {
            configFile: '/path/to/config.cfg',
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmpsprt', ['-c', '/path/to/config.cfg', '/path/to/printjob.dcm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmpsprt('/path/to/printjob.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read print job', exitCode: 1 },
        });

        const result = await dcmpsprt('/path/to/printjob.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmpsprt failed');
            expect(result.error.message).toContain('cannot read print job');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmpsprt('/path/to/printjob.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcmpsprt('/path/to/printjob.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmpsprt('/path/to/printjob.dcm', { timeoutMs: 10000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmpsprt', ['/path/to/printjob.dcm'], expect.objectContaining({ timeoutMs: 10000 }));
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcmpsprt('/path/to/printjob.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmpsprt', ['/path/to/printjob.dcm'], expect.objectContaining({ signal: controller.signal }));
    });

    it('returns empty string when stdout is empty', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: '', exitCode: 0 },
        });

        const result = await dcmpsprt('/path/to/printjob.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe('');
        }
    });
});
