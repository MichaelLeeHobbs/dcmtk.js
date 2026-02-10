import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmmkcrv } from './dcmmkcrv';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmmkcrv' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmmkcrv()', () => {
    it('adds curve data to a DICOM image', async () => {
        const result = await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.dcm');
        }
    });

    it('passes correct arguments', async () => {
        await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmmkcrv',
            ['/path/to/curves.txt', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot write curve data', exitCode: 1 },
        });

        const result = await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmmkcrv failed');
            expect(result.error.message).toContain('cannot write curve data');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm', { bogus: true });

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

        const result = await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm', { timeoutMs: 10000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmmkcrv',
            ['/path/to/curves.txt', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 10000 })
        );
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmmkcrv',
            ['/path/to/curves.txt', '/path/to/output.dcm'],
            expect.objectContaining({ signal: controller.signal })
        );
    });

    it('works with no options provided', async () => {
        const result = await dcmmkcrv('/path/to/curves.txt', '/path/to/output.dcm');

        expect(result.ok).toBe(true);
        expect(mockedExec).toHaveBeenCalledOnce();
    });
});
