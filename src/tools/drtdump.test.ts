import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drtdump } from './drtdump';

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

const SAMPLE_RT = `RT Plan: Treatment Plan
Plan Label: PLAN_1
Number of Beams: 3`;

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/drtdump' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: SAMPLE_RT, stderr: '', exitCode: 0 },
    });
});

describe('drtdump()', () => {
    it('dumps DICOM RT file as text', async () => {
        const result = await drtdump('/path/to/rtplan.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe(SAMPLE_RT);
        }
    });

    it('passes input path as argument', async () => {
        await drtdump('/path/to/rtplan.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/drtdump', ['/path/to/rtplan.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes +Pf flag for printFilename', async () => {
        await drtdump('/path/to/rtplan.dcm', { printFilename: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/drtdump', ['+Pf', '/path/to/rtplan.dcm'], expect.any(Object));
    });

    it('does not pass +Pf when printFilename is false', async () => {
        await drtdump('/path/to/rtplan.dcm', { printFilename: false });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/drtdump', ['/path/to/rtplan.dcm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await drtdump('/path/to/rtplan.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read RT file', exitCode: 1 },
        });

        const result = await drtdump('/path/to/nonexistent.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('drtdump failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await drtdump('/path/to/rtplan.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await drtdump('/path/to/rtplan.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await drtdump('/path/to/rtplan.dcm', { timeoutMs: 15000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/drtdump', expect.any(Array), expect.objectContaining({ timeoutMs: 15000 }));
    });
});
