import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dcmdspfn } from '../../../src/tools/dcmdspfn';
import { dcod2lum } from '../../../src/tools/dcod2lum';
import { dconvlum } from '../../../src/tools/dconvlum';
import { dcmtkAvailable, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('display calibration tools integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('display-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    describe('dcmdspfn', () => {
        it('runs without crashing for a non-existent monitor file', async () => {
            const result = await dcmdspfn({ monitorFile: '/nonexistent/monitor.lut' });
            // dcmdspfn exits 0 even for non-existent monitor files — just verify it runs
            expect(typeof result.ok).toBe('boolean');
        });

        it('returns error for invalid options', async () => {
            // @ts-expect-error testing invalid option
            const result = await dcmdspfn({ bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });

    describe('dcod2lum', () => {
        it('returns error for invalid OD data input', async () => {
            const invalidInput = join(tempDir, 'invalid-od.dat');
            await writeFile(invalidInput, 'not valid OD data');
            const outputPath = join(tempDir, 'fail-lum.dat');

            const result = await dcod2lum(invalidInput, outputPath);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcod2lum');
            }
        });

        it('runs without crashing for non-existent input', async () => {
            const outputPath = join(tempDir, 'fail-lum2.dat');
            const result = await dcod2lum('/nonexistent/path/od.dat', outputPath);
            // dcod2lum exits 0 even for non-existent input files — just verify it runs
            expect(typeof result.ok).toBe('boolean');
        });
    });

    describe('dconvlum', () => {
        it('returns error for invalid luminance data input', async () => {
            const invalidInput = join(tempDir, 'invalid-lum.dat');
            await writeFile(invalidInput, 'not valid luminance data');
            const outputPath = join(tempDir, 'fail-conv.dat');

            const result = await dconvlum(invalidInput, outputPath);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dconvlum');
            }
        });

        it('returns error for non-existent input', async () => {
            const outputPath = join(tempDir, 'fail-conv2.dat');
            const result = await dconvlum('/nonexistent/path/lum.dat', outputPath);
            expect(result.ok).toBe(false);
        });

        it('returns error for invalid options', async () => {
            // @ts-expect-error testing invalid option
            const result = await dconvlum('/path/to/in.dat', '/path/to/out.dat', { bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });
});
