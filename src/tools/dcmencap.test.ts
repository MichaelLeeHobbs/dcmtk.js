import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmencap } from './dcmencap';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmencap' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmencap()', () => {
    it('encapsulates a document into a DICOM file', async () => {
        const result = await dcmencap('/path/to/input.pdf', '/path/to/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.dcm');
        }
    });

    it('passes input and output paths as arguments', async () => {
        await dcmencap('/path/to/input.pdf', '/path/to/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmencap',
            ['/path/to/input.pdf', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes --title flag when documentTitle is set', async () => {
        await dcmencap('/path/to/input.pdf', '/path/to/output.dcm', {
            documentTitle: 'My Report',
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmencap',
            ['--title', 'My Report', '/path/to/input.pdf', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmencap('/path/to/input.pdf', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot encapsulate document', exitCode: 1 },
        });

        const result = await dcmencap('/path/to/input.pdf', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmencap failed');
            expect(result.error.message).toContain('exit code 1');
            expect(result.error.message).toContain('cannot encapsulate document');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmencap('/path/to/input.pdf', '/path/to/output.dcm', { bogus: true });

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

        const result = await dcmencap('/path/to/input.pdf', '/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmencap('/path/to/input.pdf', '/path/to/output.dcm', { timeoutMs: 5000 });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmencap',
            ['/path/to/input.pdf', '/path/to/output.dcm'],
            expect.objectContaining({ timeoutMs: 5000 })
        );
    });

    it('forwards AbortSignal', async () => {
        const controller = new AbortController();

        await dcmencap('/path/to/input.pdf', '/path/to/output.dcm', { signal: controller.signal });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmencap',
            ['/path/to/input.pdf', '/path/to/output.dcm'],
            expect.objectContaining({ signal: controller.signal })
        );
    });
});
