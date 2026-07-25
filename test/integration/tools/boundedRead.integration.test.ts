import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDicomHead } from '../../../src/tools/_boundedRead';
import { parseDicomBuffer } from '../../../src/tools/_p10ToJson';

const SAMPLES_ROOT = resolve(__dirname, '../../../dicomSamples');

/** All good sample files (bad/ excluded — corrupt files fall back to full reads by design). */
function listSampleFiles(): string[] {
    const dirs = ['1010_brain_mr_12_jpg', 'other'];
    const files: string[] = [];
    for (const dir of dirs) {
        for (const name of readdirSync(join(SAMPLES_ROOT, dir))) {
            if (/\.dcm$/i.test(name)) {
                files.push(join(SAMPLES_ROOT, dir, name));
            }
        }
    }
    return files;
}

/**
 * Differential check (#35): for every sample, the bounded head-read (forced
 * with a tiny threshold and chunk size so every file exercises the skip/grow
 * machinery) must produce byte-parse output identical to the full file —
 * same data, same warnings, same ok/err outcome.
 */
describe('readDicomHead — differential vs full read (all samples)', () => {
    const samples = listSampleFiles();

    it('has samples to test', () => {
        expect(samples.length).toBeGreaterThan(100);
    });

    it.each(samples.map(f => [f.slice(SAMPLES_ROOT.length + 1), f]))('%s', async (_label, filePath) => {
        const full = readFileSync(filePath);
        const bounded = await readDicomHead(filePath, { timeoutMs: 30_000, thresholdBytes: 0 });
        expect(bounded.ok).toBe(true);
        if (!bounded.ok) return;

        const fromBounded = parseDicomBuffer(bounded.value);
        const fromFull = parseDicomBuffer(full);
        expect(fromBounded.ok).toBe(fromFull.ok);
        if (fromBounded.ok && fromFull.ok) {
            expect(fromBounded.value.data).toEqual(fromFull.value.data);
            expect(fromBounded.value.warnings).toEqual(fromFull.value.warnings);
        }
    });

    it('reads dramatically less than the file size for pixel-data-heavy samples', async () => {
        let boundedTotal = 0;
        let fileTotal = 0;
        for (const filePath of samples) {
            const bounded = await readDicomHead(filePath, { timeoutMs: 30_000, thresholdBytes: 0 });
            if (bounded.ok) {
                boundedTotal += bounded.value.length;
                fileTotal += statSync(filePath).size;
            }
        }
        expect(boundedTotal).toBeLessThan(fileTotal / 2);
    });
});
