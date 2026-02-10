import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmpsmk } from './dcmpsmk';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmpsmk' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmpsmk()', () => {
    it('creates a presentation state from an image', async () => {
        const result = await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/pstate.dcm');
        }
    });

    it('passes input and output paths as arguments', async () => {
        await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmpsmk',
            ['/path/to/image.dcm', '/path/to/pstate.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm');

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

        const result = await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmpsmk failed');
            expect(result.error.message).toContain('cannot read DICOM file');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmpsmk',
            ['/path/to/image.dcm', '/path/to/pstate.dcm'],
            expect.objectContaining({ timeoutMs: 5000 })
        );
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcmpsmk('/path/to/image.dcm', '/path/to/pstate.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmpsmk',
            ['/path/to/image.dcm', '/path/to/pstate.dcm'],
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
