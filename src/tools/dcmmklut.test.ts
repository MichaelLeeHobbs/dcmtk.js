import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmmklut, LutType } from './dcmmklut';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmmklut' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmmklut()', () => {
    it('creates a DICOM LUT file', async () => {
        const result = await dcmmklut('/path/to/output.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/to/output.dcm');
        }
    });

    it('passes correct default arguments', async () => {
        await dcmmklut('/path/to/output.dcm');

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmklut', ['/path/to/output.dcm'], expect.objectContaining({ timeoutMs: 30000 }));
    });

    it('supports all LUT type presets', async () => {
        const expectedFlags: Record<string, string> = {
            modality: '+Tm',
            presentation: '+Tp',
            voi: '+Tv',
        };

        for (const [type, flag] of Object.entries(expectedFlags)) {
            vi.clearAllMocks();
            mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmmklut' });
            mockedExec.mockResolvedValue({
                ok: true,
                value: { stdout: '', stderr: '', exitCode: 0 },
            });

            await dcmmklut('/out.dcm', {
                lutType: type as 'modality' | 'presentation' | 'voi',
            });

            expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmklut', [flag, '/out.dcm'], expect.any(Object));
        }
    });

    it('passes gamma flag', async () => {
        await dcmmklut('/path/to/output.dcm', { gamma: 2.2 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmklut', ['+Cg', '2.2', '/path/to/output.dcm'], expect.any(Object));
    });

    it('passes entries flag', async () => {
        await dcmmklut('/path/to/output.dcm', { entries: 256 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmklut', ['-e', '256', '/path/to/output.dcm'], expect.any(Object));
    });

    it('passes bits flag', async () => {
        await dcmmklut('/path/to/output.dcm', { bits: 12 });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmmklut', ['-b', '12', '/path/to/output.dcm'], expect.any(Object));
    });

    it('passes all options together', async () => {
        await dcmmklut('/path/to/output.dcm', {
            lutType: LutType.VOI,
            gamma: 1.8,
            entries: 4096,
            bits: 16,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmmklut',
            ['+Tv', '+Cg', '1.8', '-e', '4096', '-b', '16', '/path/to/output.dcm'],
            expect.any(Object)
        );
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmmklut('/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot create LUT', exitCode: 1 },
        });

        const result = await dcmmklut('/path/to/output.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmmklut failed');
            expect(result.error.message).toContain('cannot create LUT');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid option
        const result = await dcmmklut('/path/to/output.dcm', { bogus: true });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error for invalid bits range', async () => {
        const result = await dcmmklut('/path/to/output.dcm', { bits: 4 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });
});
