import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmpschk } from './dcmpschk';

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

const SAMPLE_OUTPUT = 'Presentation State check result: 0 errors, 0 warnings';

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmpschk' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: SAMPLE_OUTPUT, stderr: '', exitCode: 0 },
    });
});

describe('dcmpschk()', () => {
    it('checks a presentation state file', async () => {
        const result = await dcmpschk('/path/to/pstate.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe(SAMPLE_OUTPUT);
        }
    });

    it('passes input path as argument', async () => {
        await dcmpschk('/path/to/pstate.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmpschk', ['/path/to/pstate.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmpschk('/path/to/pstate.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read DICOM file', exitCode: 1 },
        });

        const result = await dcmpschk('/path/to/pstate.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmpschk failed');
            expect(result.error.message).toContain('cannot read DICOM file');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcmpschk('/path/to/pstate.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmpschk('/path/to/pstate.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmpschk', ['/path/to/pstate.dcm'], expect.objectContaining({ timeoutMs: 5000 }));
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmpschk('/path/to/pstate.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcmpschk('/path/to/pstate.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmpschk', ['/path/to/pstate.dcm'], expect.objectContaining({ signal: controller.signal }));
    });
});
