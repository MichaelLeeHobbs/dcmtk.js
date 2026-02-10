import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcm2cda } from './dcm2cda';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2cda' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcm2cda()', () => {
    it('extracts a CDA document from a DICOM file', async () => {
        const result = await dcm2cda('/path/to/input.dcm', '/path/to/output.xml');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.xml');
        }
    });

    it('passes input and output paths as arguments', async () => {
        await dcm2cda('/path/to/input.dcm', '/path/to/output.xml');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcm2cda',
            ['/path/to/input.dcm', '/path/to/output.xml'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcm2cda('/path/to/input.dcm', '/path/to/output.xml');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: no encapsulated CDA found', exitCode: 1 },
        });

        const result = await dcm2cda('/path/to/input.dcm', '/path/to/output.xml');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcm2cda failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('no encapsulated CDA found');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({
            ok: false,
            error: new Error('Process error: spawn ENOENT'),
        });

        const result = await dcm2cda('/path/to/input.dcm', '/path/to/output.xml');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcm2cda('/path/to/input.dcm', '/path/to/output.xml', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcm2cda',
            ['/path/to/input.dcm', '/path/to/output.xml'],
            expect.objectContaining({ timeoutMs: 5000 })
        );
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcm2cda('/path/to/input.dcm', '/path/to/output.xml', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcm2cda('/path/to/input.dcm', '/path/to/output.xml', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcm2cda',
            ['/path/to/input.dcm', '/path/to/output.xml'],
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
