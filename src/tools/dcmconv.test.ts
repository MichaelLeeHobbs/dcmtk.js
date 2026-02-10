import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcmconv, TransferSyntax } from './dcmconv';

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
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmconv' });
    mockedExec.mockResolvedValue({
        ok: true,
        value: { stdout: '', stderr: '', exitCode: 0 },
    });
});

describe('dcmconv()', () => {
    it('converts transfer syntax', async () => {
        const result = await dcmconv('/path/input.dcm', '/path/output.dcm', {
            transferSyntax: TransferSyntax.EXPLICIT_LITTLE,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe('/path/output.dcm');
        }
    });

    it('passes correct arguments', async () => {
        await dcmconv('/path/input.dcm', '/path/output.dcm', {
            transferSyntax: TransferSyntax.IMPLICIT_LITTLE,
        });

        expect(mockedExec).toHaveBeenCalledWith(
            '/usr/local/bin/dcmconv',
            ['+ti', '/path/input.dcm', '/path/output.dcm'],
            expect.objectContaining({ timeoutMs: 30000 })
        );
    });

    it('supports all transfer syntax presets', async () => {
        for (const ts of Object.values(TransferSyntax)) {
            vi.clearAllMocks();
            mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmconv' });
            mockedExec.mockResolvedValue({
                ok: true,
                value: { stdout: '', stderr: '', exitCode: 0 },
            });

            const result = await dcmconv('/in.dcm', '/out.dcm', { transferSyntax: ts });

            expect(result.ok).toBe(true);
        }
    });

    it('returns error when DCMTK is not found', async () => {
        mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

        const result = await dcmconv('/in.dcm', '/out.dcm', {
            transferSyntax: TransferSyntax.EXPLICIT_LITTLE,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toBe('DCMTK not found');
        }
    });

    it('returns error on non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot convert', exitCode: 1 },
        });

        const result = await dcmconv('/in.dcm', '/out.dcm', {
            transferSyntax: TransferSyntax.EXPLICIT_LITTLE,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmconv failed');
        }
    });

    it('returns error for invalid options', async () => {
        // @ts-expect-error testing invalid transfer syntax
        const result = await dcmconv('/in.dcm', '/out.dcm', { transferSyntax: '+invalid' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });

    it('returns error on exec failure', async () => {
        mockedExec.mockResolvedValue({ ok: false, error: new Error('Process error: spawn ENOENT') });

        const result = await dcmconv('/in.dcm', '/out.dcm', { transferSyntax: TransferSyntax.EXPLICIT_LITTLE });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('ENOENT');
        }
    });

    it('respects custom timeout', async () => {
        await dcmconv('/in.dcm', '/out.dcm', {
            transferSyntax: TransferSyntax.EXPLICIT_LITTLE,
            timeoutMs: 5000,
        });

        expect(mockedExec).toHaveBeenCalledWith('/usr/local/bin/dcmconv', expect.any(Array), expect.objectContaining({ timeoutMs: 5000 }));
    });
});
