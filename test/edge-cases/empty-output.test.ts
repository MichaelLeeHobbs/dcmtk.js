/**
 * Tests for edge case DCMTK outputs: empty, partial, and large.
 * Verifies tools handle abnormal process results gracefully.
 *
 * @module empty-output.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports that depend on them
// ---------------------------------------------------------------------------

vi.mock('../../src/exec', () => ({
    execCommand: vi.fn(),
}));

vi.mock('../../src/tools/_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { dcm2json } from '../../src/tools/dcm2json';
import { dcm2xml } from '../../src/tools/dcm2xml';
import { dcmdump } from '../../src/tools/dcmdump';
import { echoscu } from '../../src/tools/echoscu';
import { execCommand } from '../../src/exec';
import { resolveBinary } from '../../src/tools/_resolveBinary';

const mockedExec = vi.mocked(execCommand);
const mockedResolve = vi.mocked(resolveBinary);

beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmtk' });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a string of approximately the given byte size. */
function generateLargeString(bytes: number): string {
    const chunk = 'A'.repeat(1024);
    const chunks: string[] = [];
    let total = 0;
    while (total < bytes) {
        chunks.push(chunk);
        total += chunk.length;
    }
    return chunks.join('');
}

// ---------------------------------------------------------------------------
// dcm2json edge cases
// ---------------------------------------------------------------------------

describe('dcm2json edge case outputs', () => {
    it('returns error for empty stdout with exit code 0 (XML path produces missing root)', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: '', exitCode: 0 },
        });

        // dcm2json first tries XML path; empty stdout means no NativeDicomModel
        // Both XML and direct paths will get empty stdout
        const result = await dcm2json('/path/to/test.dcm');

        // The XML path fails (missing root), fallback direct path tries JSON.parse('')
        // which also fails — so both paths error
        expect(result.ok).toBe(false);
    });

    it('returns error for empty stdout with exit code 1', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: fatal error', exitCode: 1 },
        });

        const result = await dcm2json('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('failed');
        }
    });

    it('returns error for truncated JSON output (direct path)', async () => {
        // First call (dcm2xml) fails so we fall back to direct
        mockedExec
            .mockResolvedValueOnce({
                ok: true,
                value: { stdout: '', stderr: 'E: xml error', exitCode: 1 },
            })
            .mockResolvedValueOnce({
                ok: true,
                value: { stdout: '{"00100010": {"vr": "PN", "Value": [', stderr: '', exitCode: 0 },
            });

        mockedResolve.mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2xml' }).mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2json' });

        const result = await dcm2json('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('failed to parse output');
        }
    });

    it('handles very large stdout without crashing (direct path)', async () => {
        const largeJson = `{"00100020": {"vr": "LO", "Value": ["${'X'.repeat(1_000_000)}"]}}`;

        mockedExec
            .mockResolvedValueOnce({
                ok: true,
                value: { stdout: '', stderr: 'E: xml error', exitCode: 1 },
            })
            .mockResolvedValueOnce({
                ok: true,
                value: { stdout: largeJson, stderr: '', exitCode: 0 },
            });

        mockedResolve.mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2xml' }).mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2json' });

        const result = await dcm2json('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.source).toBe('direct');
        }
    });

    it('returns error for whitespace-only stdout (direct path)', async () => {
        mockedExec
            .mockResolvedValueOnce({
                ok: true,
                value: { stdout: '   \n\t  ', stderr: 'E: xml error', exitCode: 1 },
            })
            .mockResolvedValueOnce({
                ok: true,
                value: { stdout: '   \n\t  ', stderr: '', exitCode: 0 },
            });

        mockedResolve.mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2xml' }).mockReturnValueOnce({ ok: true, value: '/usr/local/bin/dcm2json' });

        const result = await dcm2json('/path/to/test.dcm');

        expect(result.ok).toBe(false);
    });

    it('succeeds when exit code 0 but stderr has warnings (XML path)', async () => {
        const xml = `<?xml version="1.0"?>
<NativeDicomModel>
  <DicomAttribute tag="00100020" vr="LO" keyword="PatientID">
    <Value number="1">12345</Value>
  </DicomAttribute>
</NativeDicomModel>`;

        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: xml, stderr: 'W: some warning about charset', exitCode: 0 },
        });

        const result = await dcm2json('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.source).toBe('xml');
            expect(result.value.data['00100020']).toBeDefined();
        }
    });

    it('includes stderr in error for non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read file: permission denied', exitCode: 1 },
        });

        const result = await dcm2json('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('permission denied');
        }
    });
});

// ---------------------------------------------------------------------------
// dcm2xml edge cases
// ---------------------------------------------------------------------------

describe('dcm2xml edge case outputs', () => {
    it('returns ok with empty string for empty stdout with exit code 0', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: '', exitCode: 0 },
        });

        const result = await dcm2xml('/path/to/test.dcm');

        // dcm2xml returns whatever stdout is — even if empty
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toBe('');
        }
    });

    it('returns error for empty stdout with exit code 1', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: cannot read file', exitCode: 1 },
        });

        const result = await dcm2xml('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcm2xml failed');
        }
    });

    it('returns ok with truncated XML output (unclosed tags) with exit code 0', async () => {
        const truncatedXml = '<NativeDicomModel><DicomAttribute tag="00100020" vr="LO"';

        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: truncatedXml, stderr: '', exitCode: 0 },
        });

        const result = await dcm2xml('/path/to/test.dcm');

        // dcm2xml just returns stdout as-is — it does not parse the XML
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toBe(truncatedXml);
        }
    });

    it('handles very large stdout without crashing', async () => {
        const largeXml = generateLargeString(1_000_000);

        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: largeXml, stderr: '', exitCode: 0 },
        });

        const result = await dcm2xml('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml.length).toBeGreaterThanOrEqual(1_000_000);
        }
    });

    it('returns ok with whitespace-only stdout', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '   \n\t\n  ', stderr: '', exitCode: 0 },
        });

        const result = await dcm2xml('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toBe('   \n\t\n  ');
        }
    });

    it('succeeds when exit code 0 but stderr has warnings', async () => {
        const xml = '<NativeDicomModel/>';

        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: xml, stderr: 'W: charset issue', exitCode: 0 },
        });

        const result = await dcm2xml('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.xml).toBe(xml);
        }
    });

    it('includes stderr in error message for non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: no such file or directory', exitCode: 1 },
        });

        const result = await dcm2xml('/path/to/nonexistent.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('no such file or directory');
        }
    });
});

// ---------------------------------------------------------------------------
// dcmdump edge cases
// ---------------------------------------------------------------------------

describe('dcmdump edge case outputs', () => {
    it('returns ok with empty text for empty stdout with exit code 0', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: '', exitCode: 0 },
        });

        const result = await dcmdump('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe('');
        }
    });

    it('returns error for empty stdout with exit code 1', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: file not found', exitCode: 1 },
        });

        const result = await dcmdump('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('dcmdump failed');
        }
    });

    it('handles very large stdout without crashing', async () => {
        const largeDump = generateLargeString(1_000_000);

        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: largeDump, stderr: '', exitCode: 0 },
        });

        const result = await dcmdump('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text.length).toBeGreaterThanOrEqual(1_000_000);
        }
    });

    it('returns ok with whitespace-only stdout', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '   \n  ', stderr: '', exitCode: 0 },
        });

        const result = await dcmdump('/path/to/test.dcm');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.text).toBe('   \n  ');
        }
    });

    it('includes stderr content in error for non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: access denied to /path/to/file', exitCode: 1 },
        });

        const result = await dcmdump('/path/to/test.dcm');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('access denied');
        }
    });
});

// ---------------------------------------------------------------------------
// echoscu edge cases
// ---------------------------------------------------------------------------

describe('echoscu edge case outputs', () => {
    it('returns ok for empty stdout with exit code 0', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: '', exitCode: 0 },
        });

        const result = await echoscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
        }
    });

    it('returns error for empty stdout with exit code 1', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: '', exitCode: 1 },
        });

        const result = await echoscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('echoscu failed');
        }
    });

    it('succeeds with stderr warnings when exit code is 0', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'W: peer responded slowly', exitCode: 0 },
        });

        const result = await echoscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.success).toBe(true);
            expect(result.value.stderr).toContain('peer responded slowly');
        }
    });

    it('includes stderr in error message for non-zero exit code', async () => {
        mockedExec.mockResolvedValue({
            ok: true,
            value: { stdout: '', stderr: 'E: connection refused by remote host', exitCode: 1 },
        });

        const result = await echoscu({ host: 'localhost', port: 104 });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('connection refused');
        }
    });
});
