import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcm2json } from './dcm2json';

vi.mock('../exec', () => ({
    execCommand: vi.fn(),
}));

vi.mock('./_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

vi.mock('./_xmlToJson', () => ({
    xmlToJson: vi.fn(),
}));

vi.mock('./_repairJson', () => ({
    repairJson: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
    mkdtemp: vi.fn(),
    rm: vi.fn(),
}));

import { execCommand } from '../exec';
import { resolveBinary } from './_resolveBinary';
import { xmlToJson } from './_xmlToJson';
import { repairJson } from './_repairJson';
import { mkdtemp, rm } from 'node:fs/promises';

const mockedExecCommand = vi.mocked(execCommand);
const mockedResolveBinary = vi.mocked(resolveBinary);
const mockedXmlToJson = vi.mocked(xmlToJson);
const mockedRepairJson = vi.mocked(repairJson);
const mockedMkdtemp = vi.mocked(mkdtemp);
const mockedRm = vi.mocked(rm);

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2xml' });
    mockedMkdtemp.mockResolvedValue('/tmp/dcm2json-bulk-abc123');
    mockedRm.mockResolvedValue(undefined);
    mockedExecCommand.mockResolvedValue({
        ok: true,
        value: { stdout: '<xml/>', stderr: '', exitCode: 0 },
    });
    mockedXmlToJson.mockReturnValue({ ok: true, value: { '00100010': { vr: 'PN', Value: [{ Alphabetic: 'DOE^JOHN' }] } } });
});

describe('dcm2json', () => {
    describe('argument building', () => {
        it('passes -v for verbose verbosity via XML path', async () => {
            await dcm2json('/input.dcm', { verbosity: 'verbose' });
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            expect(args).toContain('-v');
        });

        it('passes -d for debug verbosity via XML path', async () => {
            await dcm2json('/input.dcm', { verbosity: 'debug' });
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            expect(args).toContain('-d');
        });

        it('omits verbosity flag when not specified', async () => {
            await dcm2json('/input.dcm');
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            expect(args).not.toContain('-v');
            expect(args).not.toContain('-d');
        });

        it('passes -v for verbose verbosity via direct path', async () => {
            mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2json' });
            mockedExecCommand.mockResolvedValue({
                ok: true,
                value: { stdout: '{}', stderr: '', exitCode: 0 },
            });
            mockedRepairJson.mockReturnValue('{}');
            await dcm2json('/input.dcm', { verbosity: 'verbose', directOnly: true });
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            expect(args).toContain('-v');
        });

        it('passes -d for debug verbosity via direct path', async () => {
            mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2json' });
            mockedExecCommand.mockResolvedValue({
                ok: true,
                value: { stdout: '{}', stderr: '', exitCode: 0 },
            });
            mockedRepairJson.mockReturnValue('{}');
            await dcm2json('/input.dcm', { verbosity: 'debug', directOnly: true });
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            expect(args).toContain('-d');
        });

        it('passes +b +bd <tmpdir> on direct path to handle compressed pixel data', async () => {
            mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2json' });
            mockedExecCommand.mockResolvedValue({
                ok: true,
                value: { stdout: '{}', stderr: '', exitCode: 0 },
            });
            mockedRepairJson.mockReturnValue('{}');
            await dcm2json('/input.dcm', { directOnly: true });
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            expect(args).toContain('+b');
            const bdIdx = args.indexOf('+bd');
            expect(bdIdx).toBeGreaterThanOrEqual(0);
            expect(args[bdIdx + 1]).toBe('/tmp/dcm2json-bulk-abc123');
        });

        it('cleans up bulk data temp directory after direct path', async () => {
            mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2json' });
            mockedExecCommand.mockResolvedValue({
                ok: true,
                value: { stdout: '{}', stderr: '', exitCode: 0 },
            });
            mockedRepairJson.mockReturnValue('{}');
            await dcm2json('/input.dcm', { directOnly: true });
            expect(mockedRm).toHaveBeenCalledWith('/tmp/dcm2json-bulk-abc123', { recursive: true, force: true });
        });

        it('passes +Ca with charset value via XML path', async () => {
            await dcm2json('/input.dcm', { charsetAssume: 'ISO_IR 100' });
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            const idx = args.indexOf('+Ca');
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(args[idx + 1]).toBe('ISO_IR 100');
        });

        it('omits +Ca when charsetAssume not specified', async () => {
            await dcm2json('/input.dcm');
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            expect(args).not.toContain('+Ca');
        });

        it('does not pass +Ca to direct path', async () => {
            mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2json' });
            mockedExecCommand.mockResolvedValue({
                ok: true,
                value: { stdout: '{}', stderr: '', exitCode: 0 },
            });
            mockedRepairJson.mockReturnValue('{}');
            await dcm2json('/input.dcm', { charsetAssume: 'ISO_IR 100', directOnly: true });
            const args = mockedExecCommand.mock.calls[0]?.[1] as string[];
            expect(args).not.toContain('+Ca');
        });
    });

    describe('validation', () => {
        it('rejects empty charsetAssume', async () => {
            const result = await dcm2json('/input.dcm', { charsetAssume: '' });
            expect(result.ok).toBe(false);
        });

        it('accepts valid charsetAssume', async () => {
            const result = await dcm2json('/input.dcm', { charsetAssume: 'Latin1' });
            expect(result.ok).toBe(true);
        });
    });

    describe('result handling', () => {
        it('returns data on success via XML path', async () => {
            const result = await dcm2json('/input.dcm');
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.source).toBe('xml');
                expect(result.value.data).toBeDefined();
            }
        });

        it('returns error when binary not found', async () => {
            mockedResolveBinary.mockReturnValue({ ok: false, error: new Error('not found') });
            const result = await dcm2json('/input.dcm');
            expect(result.ok).toBe(false);
        });

        it('returns error when exec fails', async () => {
            mockedExecCommand.mockResolvedValue({ ok: false, error: new Error('exec failed') });
            const result = await dcm2json('/input.dcm');
            expect(result.ok).toBe(false);
        });

        it('aggregates both path errors when both paths fail', async () => {
            mockedExecCommand
                .mockResolvedValueOnce({ ok: false, error: new Error('dcm2xml timed out') })
                .mockResolvedValueOnce({ ok: false, error: new Error('dcm2json crashed') });
            const result = await dcm2json('/input.dcm');
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('both paths failed');
                expect(result.error.message).toContain('dcm2xml timed out');
                expect(result.error.message).toContain('dcm2json crashed');
            }
        });

        it('skips the direct fallback when the timeout budget is exhausted', async () => {
            mockedExecCommand.mockResolvedValue({ ok: false, error: new Error('dcm2xml timed out after 5000ms') });
            const nowSpy = vi.spyOn(Date, 'now');
            nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(5_001);
            const result = await dcm2json('/input.dcm', { timeoutMs: 5000 });
            nowSpy.mockRestore();
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('timeout budget');
                expect(result.error.message).toContain('skipping direct fallback');
                expect(result.error.message).toContain('dcm2xml timed out after 5000ms');
            }
            // The direct path must never have been launched
            expect(mockedExecCommand).toHaveBeenCalledTimes(1);
        });

        it('runs the direct fallback with the remaining budget, not a fixed floor', async () => {
            mockedExecCommand
                .mockResolvedValueOnce({ ok: false, error: new Error('xml failed fast') })
                .mockResolvedValueOnce({ ok: true, value: { stdout: '{}', stderr: '', exitCode: 0 } });
            const nowSpy = vi.spyOn(Date, 'now');
            nowSpy.mockReturnValueOnce(0).mockReturnValueOnce(2_000);
            const result = await dcm2json('/input.dcm', { timeoutMs: 5000 });
            nowSpy.mockRestore();
            expect(result.ok).toBe(true);
            const directCall = mockedExecCommand.mock.calls[1];
            expect(directCall?.[2]).toEqual(expect.objectContaining({ timeoutMs: 3_000 }));
        });
    });
});
