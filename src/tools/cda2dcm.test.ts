import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cda2dcm } from './cda2dcm';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/cda2dcm' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('cda2dcm()', () => {
    it('encapsulates a CDA document into a DICOM file', async () => {
        const result = await cda2dcm('/path/to/input.xml', '/path/to/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.dcm');
        }
    });

    it('passes input and output paths as arguments', async () => {
        await cda2dcm('/path/to/input.xml', '/path/to/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/cda2dcm',
            ['/path/to/input.xml', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await cda2dcm('/path/to/input.xml', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read CDA file', exitCode: 1 },
        });

        const result = await cda2dcm('/path/to/input.xml', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('cda2dcm failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot read CDA file');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await cda2dcm('/path/to/input.xml', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await cda2dcm('/path/to/input.xml', '/path/to/output.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/cda2dcm',
            ['/path/to/input.xml', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 5000 })
        );
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await cda2dcm('/path/to/input.xml', '/path/to/output.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await cda2dcm('/path/to/input.xml', '/path/to/output.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/cda2dcm',
            ['/path/to/input.xml', '/path/to/output.dcm'],
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
