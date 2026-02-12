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

        // Create a minimal binary STL file with one triangle.
        // DCMTK 3.7.0 only accepts binary STL (rejects ASCII).
        // Binary STL format: 80-byte header + 4-byte triangle count + triangles
        // Each triangle: 12 floats (normal + 3 vertices) + 2-byte attribute
        const header = Buffer.alloc(80, 0); // 80-byte header (all zeros)
        const count = Buffer.alloc(4);
        count.writeUInt32LE(1, 0); // 1 triangle
        const triangle = Buffer.alloc(50);
        // Normal (0, 0, 1)
        triangle.writeFloatLE(0, 0);
        triangle.writeFloatLE(0, 4);
        triangle.writeFloatLE(1, 8);
        // Vertex 1 (0, 0, 0)
        triangle.writeFloatLE(0, 12);
        triangle.writeFloatLE(0, 16);
        triangle.writeFloatLE(0, 20);
        // Vertex 2 (1, 0, 0)
        triangle.writeFloatLE(1, 24);
        triangle.writeFloatLE(0, 28);
        triangle.writeFloatLE(0, 32);
        // Vertex 3 (0, 1, 0)
        triangle.writeFloatLE(0, 36);
        triangle.writeFloatLE(1, 40);
        triangle.writeFloatLE(0, 44);
        // Attribute byte count (0)
        triangle.writeUInt16LE(0, 48);

        stlPath = join(tempDir, 'test.stl');
        await writeFile(stlPath, Buffer.concat([header, count, triangle]));
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
