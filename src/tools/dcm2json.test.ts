import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dcm2json } from './dcm2json';

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

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">12345</Value>
  </DicomAttribute>
</NativeDicomModel>`;

const SAMPLE_JSON = '{"00100020": {"vr": "LO", "Value": ["12345"]}}';

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2xml' });
});

describe('dcm2json()', () => {
    describe('XML-primary path', () => {
        it('converts via XML when dcm2xml succeeds', async () => {
            mockedExec.mockResolvedValue({
                ok: true,
                value: { stdout: SAMPLE_XML, stderr: '', exitCode: 0 },
            });

            const result = await dcm2json('/path/to/test.dcm');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.source).toBe('xml');
                expect(result.value.data['00100020']).toEqual({
                    vr: 'LO',
                    Value: ['12345'],
                });
            }
        });
    });

    describe('direct fallback path', () => {
        it('falls back to dcm2json when XML fails', async () => {
            // First call (dcm2xml) fails, second call (dcm2json) succeeds
            mockedExec
                .mockResolvedValueOnce({
                    ok: true,
                    value: { stdout: '', stderr: 'E: xml error', exitCode: 1 },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    value: { stdout: SAMPLE_JSON, stderr: '', exitCode: 0 },
                });

            // Second resolve call for dcm2json binary
            mockedResolve
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2xml' })
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2json' });

            const result = await dcm2json('/path/to/test.dcm');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.source).toBe('direct');
            }
        });

        it('falls back when XML exec itself fails', async () => {
            // First call (dcm2xml) exec error, second call (dcm2json) succeeds
            mockedExec
                .mockResolvedValueOnce({ ok: false, error: new Error('Process error: timeout') })
                .mockResolvedValueOnce({ ok: true, value: { stdout: SAMPLE_JSON, stderr: '', exitCode: 0 } });

            mockedResolve
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2xml' })
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2json' });

            const result = await dcm2json('/path/to/test.dcm');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.source).toBe('direct');
            }
        });

        it('repairs malformed JSON from direct dcm2json', async () => {
            const malformedJson = '{"00280030": {"vr": "DS", "Value": [0.5, 0.5]}}';

            mockedExec
                .mockResolvedValueOnce({
                    ok: true,
                    value: { stdout: '', stderr: 'E: xml error', exitCode: 1 },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    value: { stdout: malformedJson, stderr: '', exitCode: 0 },
                });

            mockedResolve
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2xml' })
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2json' });

            const result = await dcm2json('/path/to/test.dcm');

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.source).toBe('direct');
                expect(result.value.data['00280030']).toBeDefined();
            }
        });
    });

    describe('directOnly mode', () => {
        it('skips XML path when directOnly is true', async () => {
            mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcm2json' });
            mockedExec.mockResolvedValue({
                ok: true,
                value: { stdout: SAMPLE_JSON, stderr: '', exitCode: 0 },
            });

            const result = await dcm2json('/path/to/test.dcm', { directOnly: true });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.source).toBe('direct');
            }
            // Should only call exec once (no dcm2xml call)
            expect(mockedExec).toHaveBeenCalledTimes(1);
        });
    });

    describe('error handling', () => {
        it('returns error when DCMTK is not found', async () => {
            mockedResolve.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

            const result = await dcm2json('/path/to/test.dcm');

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DCMTK not found');
            }
        });

        it('returns error when both paths fail', async () => {
            // Both dcm2xml and dcm2json fail
            mockedExec.mockResolvedValue({
                ok: true,
                value: { stdout: '', stderr: 'E: error', exitCode: 1 },
            });

            mockedResolve
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2xml' })
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2json' });

            const result = await dcm2json('/path/to/test.dcm');

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcm2json failed');
            }
        });

        it('returns error for invalid JSON from direct path', async () => {
            mockedExec
                .mockResolvedValueOnce({
                    ok: true,
                    value: { stdout: '', stderr: 'E: xml error', exitCode: 1 },
                })
                .mockResolvedValueOnce({
                    ok: true,
                    value: { stdout: 'not valid json at all', stderr: '', exitCode: 0 },
                });

            mockedResolve
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2xml' })
                .mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2json' });

            const result = await dcm2json('/path/to/test.dcm');

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('failed to parse output');
            }
        });

        it('returns error for invalid options', async () => {
            // @ts-expect-error testing invalid option
            const result = await dcm2json('/path/to/test.dcm', { bogus: true });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error on exec failure', async () => {
            mockedExec.mockResolvedValue({
                ok: false,
                error: new Error('Process error: timeout'),
            });

            const result = await dcm2json('/path/to/test.dcm');

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('timeout');
            }
        });
    });
});
