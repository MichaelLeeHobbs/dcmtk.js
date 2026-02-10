import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmdrle } from './dcmdrle';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmdrle' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmdrle()', () => {
    it('decodes RLE-compressed DICOM', async () => {
        const result = await dcmdrle('/path/compressed.dcm', '/path/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/output.dcm');
        }
    });

    it('passes correct arguments', async () => {
        await dcmdrle('/path/compressed.dcm', '/path/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmdrle',
            ['/path/compressed.dcm', '/path/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('passes uidAlways flag', async () => {
        await dcmdrle('/path/compressed.dcm', '/path/output.dcm', { uidAlways: true });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdrle', ['+ua', '/path/compressed.dcm', '/path/output.dcm'], expect.any(Object));
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmdrle('/path/compressed.dcm', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot decode', exitCode: 1 },
        });

        const result = await dcmdrle('/path/compressed.dcm', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmdrle failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option key
        const result = await dcmdrle('/path/compressed.dcm', '/path/output.dcm', { unknownKey: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dcmdrle('/path/compressed.dcm', '/path/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmdrle('/path/compressed.dcm', '/path/output.dcm', { timeoutMs: 10000 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdrle', expect.any(Array), expect.objectContaining({ timeoutMs: 10000 }));
    });

    it('omits uidAlways flag when false', async () => {
        await dcmdrle('/path/compressed.dcm', '/path/output.dcm', { uidAlways: false });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmdrle', ['/path/compressed.dcm', '/path/output.dcm'], expect.any(Object));
    });
});
