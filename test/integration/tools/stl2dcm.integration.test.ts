import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stl2dcm } from '../../../src/tools/stl2dcm';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('stl2dcm integration', () => {
    let tempDir: string;
    let stlPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('stl2dcm-');

        // Create a minimal ASCII STL file with one triangle
        const stlContent = [
            'solid test',
            'facet normal 0 0 1',
            'outer loop',
            'vertex 0 0 0',
            'vertex 1 0 0',
            'vertex 0 1 0',
            'endloop',
            'endfacet',
            'endsolid test',
        ].join('\n');

        stlPath = join(tempDir, 'test.stl');
        await writeFile(stlPath, stlContent);
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('converts an STL file to DICOM', async () => {
        const outputPath = join(tempDir, 'from-stl.dcm');
        const result = await stl2dcm(stlPath, outputPath);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe(outputPath);
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('output is valid DICOM', async () => {
        const outputPath = join(tempDir, 'valid-stl.dcm');
        await stl2dcm(stlPath, outputPath);

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('returns error for non-existent input', async () => {
        const outputPath = join(tempDir, 'fail.dcm');
        const result = await stl2dcm('/nonexistent/path/model.stl', outputPath);
        expect(result.ok).toBe(false);
    });

    it('returns error for invalid options', async () => {
        const outputPath = join(tempDir, 'fail2.dcm');
        // @ts-expect-error testing invalid option
        const result = await stl2dcm(stlPath, outputPath, { bogus: true });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });
});
