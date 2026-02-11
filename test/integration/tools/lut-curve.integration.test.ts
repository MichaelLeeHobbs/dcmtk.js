import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dcmmklut } from '../../../src/tools/dcmmklut';
import { dcmmkcrv } from '../../../src/tools/dcmmkcrv';
import { dcmtkAvailable, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('LUT and curve tools integration', () => {
    let tempDir: string;

    beforeAll(async () => {
        tempDir = await createTempDir('lut-curve-');
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    describe('dcmmklut', () => {
        it('creates a VOI LUT file', async () => {
            const outputPath = join(tempDir, 'voi-lut.dcm');
            const result = await dcmmklut(outputPath, {
                lutType: 'voi',
                gamma: 2.2,
                entries: 256,
                bits: 12,
            });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputPath).toBe(outputPath);
                expect(existsSync(outputPath)).toBe(true);
            }
        });

        it('creates a modality LUT file', async () => {
            const outputPath = join(tempDir, 'modality-lut.dcm');
            const result = await dcmmklut(outputPath, {
                lutType: 'modality',
                gamma: 1.0,
                entries: 256,
                bits: 8,
            });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(existsSync(outputPath)).toBe(true);
            }
        });

        it('creates a presentation LUT file', async () => {
            const outputPath = join(tempDir, 'pres-lut.dcm');
            const result = await dcmmklut(outputPath, {
                lutType: 'presentation',
                gamma: 1.8,
            });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(existsSync(outputPath)).toBe(true);
            }
        });

        it('returns error for invalid options', async () => {
            const outputPath = join(tempDir, 'fail-lut.dcm');
            // @ts-expect-error testing invalid option
            const result = await dcmmklut(outputPath, { bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });

    describe('dcmmkcrv', () => {
        it('returns error for invalid curve data input', async () => {
            const invalidInput = join(tempDir, 'invalid-curve.txt');
            await writeFile(invalidInput, 'not valid curve data');
            const outputPath = join(tempDir, 'fail-curve.dcm');

            const result = await dcmmkcrv(invalidInput, outputPath);
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('dcmmkcrv');
            }
        });

        it('returns error for non-existent input', async () => {
            const outputPath = join(tempDir, 'fail-curve2.dcm');
            const result = await dcmmkcrv('/nonexistent/path/curves.txt', outputPath);
            expect(result.ok).toBe(false);
        });

        it('returns error for invalid options', async () => {
            const outputPath = join(tempDir, 'fail-curve3.dcm');
            // @ts-expect-error testing invalid option
            const result = await dcmmkcrv('/some/path.txt', outputPath, { bogus: true });
            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });
    });
});
