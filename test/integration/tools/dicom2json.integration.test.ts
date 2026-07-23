import { readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dcm2json, dicom2json } from '../../../src';
import type { DicomJsonModel, DicomJsonElement } from '../../../src';
import { dcmtkAvailable, SAMPLES } from '../helpers';

const SAMPLES_ROOT = resolve(__dirname, '../../../dicomSamples');

/** All good sample files (bad/ excluded — handled separately). */
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

/** True for private (odd-group) tags. */
function isPrivateTag(tag: string): boolean {
    return parseInt(tag.slice(0, 4), 16) % 2 === 1;
}

/** Relative-epsilon comparison for FL/FD precision differences between engines. */
function closeEnough(a: unknown, b: unknown): boolean {
    if (typeof a !== 'number' || typeof b !== 'number') return false;
    if (a === b) return true;
    const rel = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-30);
    return rel < 1e-5;
}

/**
 * Collects differences between the XML-path model and the JS model.
 *
 * Exclusions, both verified against dcmdump ground truth:
 * - group 0002: deliberately included by the JS engine, omitted by dcm2xml
 * - private (odd-group) tags: dcm2xml renumbers private blocks incorrectly;
 *   the JS output preserves the file's actual tags
 */
function diffModel(xml: DicomJsonModel, js: DicomJsonModel, out: string[], path = ''): void {
    const xmlTags = Object.keys(xml).filter(t => !isPrivateTag(t));
    const jsTags = Object.keys(js).filter(t => !t.startsWith('0002') && !isPrivateTag(t));
    for (const tag of xmlTags) {
        const xmlEl = xml[tag];
        const jsEl = js[tag];
        if (xmlEl === undefined) continue;
        if (jsEl === undefined) {
            out.push(`${path}${tag}: missing in js`);
            continue;
        }
        diffElement({ xmlEl, jsEl, label: `${path}${tag}` }, out);
    }
    for (const tag of jsTags) {
        if (xml[tag] === undefined) out.push(`${path}${tag}: extra in js`);
    }
}

/** An element pair under comparison, with its diagnostic path prefix. */
interface ElementPair {
    readonly xmlEl: DicomJsonElement;
    readonly jsEl: DicomJsonElement;
    readonly label: string;
}

/** Compares SQ item lists, recursing via diffModel. */
function diffSequence(pair: ElementPair, out: string[]): void {
    const xmlItems = (pair.xmlEl.Value ?? []) as readonly DicomJsonModel[];
    const jsItems = (pair.jsEl.Value ?? []) as readonly DicomJsonModel[];
    if (xmlItems.length !== jsItems.length) {
        out.push(`${pair.label}: item count ${String(xmlItems.length)} != ${String(jsItems.length)}`);
        return;
    }
    for (let i = 0; i < xmlItems.length; i++) {
        const xmlItem = xmlItems[i];
        const jsItem = jsItems[i];
        if (xmlItem !== undefined && jsItem !== undefined) {
            diffModel(xmlItem, jsItem, out, `${pair.label}[${String(i)}].`);
        }
    }
}

/** Compares leaf values with a numeric epsilon for FL/FD. */
function diffValues(pair: ElementPair, out: string[]): void {
    if (JSON.stringify(pair.xmlEl.Value) === JSON.stringify(pair.jsEl.Value)) return;
    const xmlValues = pair.xmlEl.Value ?? [];
    const jsValues = pair.jsEl.Value ?? [];
    if (xmlValues.length === jsValues.length && xmlValues.every((v, i) => closeEnough(v, jsValues[i]))) return;
    out.push(`${pair.label}: value mismatch ${JSON.stringify(pair.xmlEl.Value)} != ${JSON.stringify(pair.jsEl.Value)}`);
}

/** Compares one element pair, recursing into sequences. */
function diffElement(pair: ElementPair, out: string[]): void {
    if (pair.xmlEl.vr !== pair.jsEl.vr) {
        out.push(`${pair.label}: vr ${pair.xmlEl.vr} != ${pair.jsEl.vr}`);
        return;
    }
    if (pair.xmlEl.vr === 'SQ') {
        diffSequence(pair, out);
        return;
    }
    diffValues(pair, out);
}

describe('dicom2json integration', () => {
    it('parses a standard MR file with the JS engine', async () => {
        const result = await dicom2json(SAMPLES.MR_BRAIN);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.source).toBe('js');
            expect(result.value.data['00100010']).toBeDefined();
            // Improvement over the XML path: file meta group is present
            expect(result.value.data['00020010']).toBeDefined();
        }
    });

    it('returns an error for a non-existent file', async () => {
        const result = await dicom2json('/nonexistent/path/file.dcm');
        expect(result.ok).toBe(false);
    });

    it('fails gracefully (no throw) on bad sample files', async () => {
        for (const bad of [SAMPLES.BAD_0002, SAMPLES.BAD_0003]) {
            const result = await dicom2json(bad);
            expect(typeof result.ok).toBe('boolean');
        }
    });
});

describe.skipIf(!dcmtkAvailable)('dicom2json differential vs DCMTK', () => {
    it('agrees with the dcm2xml path on every good sample file', async () => {
        const files = listSampleFiles();
        expect(files.length).toBeGreaterThan(100);
        const failures: string[] = [];
        for (const file of files) {
            const [xmlResult, jsResult] = await Promise.all([dcm2json(file, { timeoutMs: 60_000 }), dicom2json(file, { timeoutMs: 60_000 })]);
            if (!xmlResult.ok) continue; // XML path unavailable for this file — nothing to compare against
            if (!jsResult.ok) {
                failures.push(`${file}: js parse failed: ${jsResult.error.message}`);
                continue;
            }
            const diffs: string[] = [];
            diffModel(xmlResult.value.data, jsResult.value.data, diffs);
            if (diffs.length > 0) {
                failures.push(`${file}:\n  ${diffs.slice(0, 10).join('\n  ')}`);
            }
        }
        expect(failures, failures.join('\n')).toEqual([]);
    }, 300_000);

    it('is at least 5x faster than the XML path', async () => {
        const files = listSampleFiles().slice(0, 30);

        // Warm up both paths
        await dicom2json(files[0] as string);
        await dcm2json(files[0] as string);

        const jsStart = performance.now();
        for (const file of files) {
            await dicom2json(file, { timeoutMs: 60_000 });
        }
        const jsMs = performance.now() - jsStart;

        const xmlStart = performance.now();
        for (const file of files) {
            await dcm2json(file, { timeoutMs: 60_000 });
        }
        const xmlMs = performance.now() - xmlStart;

        // Measured ~75x locally; 5x is a loose regression gate resilient to CI noise
        expect(jsMs * 5).toBeLessThan(xmlMs);
    }, 300_000);
});
