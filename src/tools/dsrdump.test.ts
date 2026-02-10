import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dsrdump } from './dsrdump';

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

const SAMPLE_SR = `Document Title: Chest X-Ray Report
Completion Flag: COMPLETE
Verification Flag: VERIFIED`;

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dsrdump' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: SAMPLE_SR, stderr: '', exitCode: 0 },
    });
});

describe('dsrdump()', () => {
    it('dumps DICOM structured report as text', async () => {
        const result = await dsrdump('/path/to/report.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe(SAMPLE_SR);
        }
    });

    it('passes input path as argument', async () => {
        await dsrdump('/path/to/report.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsrdump', ['/path/to/report.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('passes +Pf flag for printFilename', async () => {
        await dsrdump('/path/to/report.dcm', { printFilename: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsrdump', ['+Pf', '/path/to/report.dcm'], expect.any(Object));
    });

    it('passes +Pl flag for printLong', async () => {
        await dsrdump('/path/to/report.dcm', { printLong: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsrdump', ['+Pl', '/path/to/report.dcm'], expect.any(Object));
    });

    it('passes +Pc flag for printCodes', async () => {
        await dsrdump('/path/to/report.dcm', { printCodes: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsrdump', ['+Pc', '/path/to/report.dcm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dsrdump('/path/to/report.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read SR document', exitCode: 1 },
        });

        const result = await dsrdump('/path/to/nonexistent.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dsrdump failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dsrdump('/path/to/report.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dsrdump('/path/to/report.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dsrdump('/path/to/report.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dsrdump', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });
});
