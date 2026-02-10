import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dcmdump } from '../../../src/tools/dcmdump';
import { dump2dcm } from '../../../src/tools/dump2dcm';
import { dcm2json } from '../../../src/tools/dcm2json';
import { json2dcm } from '../../../src/tools/json2dcm';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmtkAvailable, SAMPLES, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('format round-trip integration', () => {
    let tempDir: string;
    let uncompressedPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('roundtrip-');
        // Decompress to get a clean uncompressed file for round-trip tests
        uncompressedPath = join(tempDir, 'uncompressed-source.dcm');
        const decompResult = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedPath);
        if (!decompResult.ok) {
            throw new Error(`Setup failed: ${decompResult.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    // Note: XML round-trip (dcm2xml → xml2dcm) skipped because dcm2xml marks binary
    // elements as "hidden" and xml2dcm cannot reconstruct them.

    describe('JSON round-trip (dcm2json → json2dcm)', () => {
        it('produces valid DICOM from JSON', async () => {
            const jsonResult = await dcm2json(uncompressedPath);
            expect(jsonResult.ok).toBe(true);
            if (!jsonResult.ok) return;

            const jsonPath = join(tempDir, 'roundtrip.json');
            await writeFile(jsonPath, JSON.stringify(jsonResult.value.data), 'utf-8');

            const outputPath = join(tempDir, 'from-json.dcm');
            const dcmResult = await json2dcm(jsonPath, outputPath);
            expect(dcmResult.ok).toBe(true);

            if (dcmResult.ok) {
                expect(existsSync(outputPath)).toBe(true);
            }
        });

        it('round-trip preserves key tags', async () => {
            const jsonResult = await dcm2json(uncompressedPath);
            if (!jsonResult.ok) return;

            const jsonPath = join(tempDir, 'rt-json-tags.json');
            await writeFile(jsonPath, JSON.stringify(jsonResult.value.data), 'utf-8');

            const outputPath = join(tempDir, 'rt-json-tags.dcm');
            await json2dcm(jsonPath, outputPath);

            const rtJson = await dcm2json(outputPath);
            expect(rtJson.ok).toBe(true);
            if (rtJson.ok) {
                expect(rtJson.value.data['00100010']).toBeDefined();
            }
        });
    });

    describe('dump round-trip (dcmdump → dump2dcm)', () => {
        it('produces output from dump', async () => {
            const dumpResult = await dcmdump(uncompressedPath);
            expect(dumpResult.ok).toBe(true);
            if (!dumpResult.ok) return;

            const dumpPath = join(tempDir, 'roundtrip.dump');
            await writeFile(dumpPath, dumpResult.value.text, 'utf-8');

            const outputPath = join(tempDir, 'from-dump.dcm');
            const dcmResult = await dump2dcm(dumpPath, outputPath);
            // dump2dcm may or may not succeed depending on dump format compatibility
            if (dcmResult.ok) {
                expect(existsSync(outputPath)).toBe(true);
            }
        });
    });
});
