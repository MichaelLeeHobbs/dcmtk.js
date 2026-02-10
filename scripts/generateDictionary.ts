/**
 * Generates the flat DICOM dictionary lookup file from _configs/dicom.dic.json.
 *
 * Usage: npx tsx scripts/generateDictionary.ts
 *
 * Input:  _configs/dicom.dic.json (762KB, grouped by DICOM group number)
 * Output: src/data/dictionary.json (flat Record<string, DictionaryEntry>)
 *
 * The output format uses 8-char hex keys (group+element, no parens/comma):
 *   "00100010": { "vr": "PN", "name": "PatientName", "vm": [1, 1], "retired": false }
 *
 * DCMTK-internal VR aliases (lowercase) are normalized:
 *   ox → OW, xs → US, lt → OW, px → OW, up → UL, na → (skipped)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Standard VR codes for validation
const STANDARD_VRS = new Set([
    'AE',
    'AS',
    'AT',
    'CS',
    'DA',
    'DS',
    'DT',
    'FD',
    'FL',
    'IS',
    'LO',
    'LT',
    'OB',
    'OD',
    'OF',
    'OL',
    'OV',
    'OW',
    'PN',
    'SH',
    'SL',
    'SQ',
    'SS',
    'ST',
    'SV',
    'TM',
    'UC',
    'UI',
    'UL',
    'UN',
    'UR',
    'US',
    'UT',
    'UV',
]);

// DCMTK-internal VR aliases → standard VR
const VR_ALIASES: Record<string, string> = {
    ox: 'OW', // OB or OW → default to OW
    xs: 'US', // SS or US → default to US
    lt: 'OW', // US, SS, or OW → default to OW
    px: 'OW', // OB or OW (pixel data) → default to OW
    up: 'UL', // UL (pointer)
};

interface SourceElement {
    tag: string;
    vr: string;
    name: string;
    vm: { min: number; max: number | null };
    retired: boolean;
}

interface SourceGroup {
    group: string;
    range: string;
    elements: Record<string, SourceElement>;
}

interface SourceDictionary {
    rangeMap: number[][];
    groups: Record<string, SourceGroup>;
}

interface OutputEntry {
    vr: string;
    name: string;
    vm: [number, number | null];
    retired: boolean;
}

function main(): void {
    const projectRoot = path.resolve(import.meta.dirname, '..');
    const inputPath = path.join(projectRoot, '_configs', 'dicom.dic.json');
    const outputPath = path.join(projectRoot, 'src', 'data', 'dictionary.json');

    console.log(`Reading: ${inputPath}`);
    const raw = fs.readFileSync(inputPath, 'utf8');
    const source: SourceDictionary = JSON.parse(raw) as SourceDictionary;

    const output: Record<string, OutputEntry> = {};
    let totalProcessed = 0;
    let skippedNa = 0;
    let aliasNormalized = 0;

    const groupKeys = Object.keys(source.groups);
    for (const groupKey of groupKeys) {
        const group = source.groups[groupKey];
        if (group === undefined) continue;

        const groupHex = group.range;
        const elementKeys = Object.keys(group.elements);

        for (const elementKey of elementKeys) {
            const element = group.elements[elementKey];
            if (element === undefined) continue;

            let vr = element.vr;

            // Skip 'na' (Item, ItemDelimitationItem, SequenceDelimitationItem)
            if (vr === 'na') {
                skippedNa++;
                continue;
            }

            // Normalize DCMTK-internal aliases
            const alias = VR_ALIASES[vr];
            if (alias !== undefined) {
                vr = alias;
                aliasNormalized++;
            }

            // Validate VR
            if (!STANDARD_VRS.has(vr)) {
                console.warn(`  WARNING: Unknown VR "${vr}" for tag (${groupHex},${elementKey}), name=${element.name}`);
                continue;
            }

            // Build 8-char hex key (uppercase)
            const key = `${groupHex.toUpperCase()}${elementKey.toUpperCase()}`;

            if (output[key] !== undefined) {
                console.warn(`  WARNING: Duplicate tag key ${key}, name=${element.name}`);
                continue;
            }

            output[key] = {
                vr,
                name: element.name,
                vm: [element.vm.min, element.vm.max],
                retired: element.retired,
            };
            totalProcessed++;
        }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const json = JSON.stringify(output, null, 2);
    fs.writeFileSync(outputPath, json + '\n', 'utf8');

    const sizeKB = Math.round(Buffer.byteLength(json, 'utf8') / 1024);
    console.log(`\nDone.`);
    console.log(`  Tags written:  ${totalProcessed}`);
    console.log(`  Skipped (na):  ${skippedNa}`);
    console.log(`  VR normalized: ${aliasNormalized}`);
    console.log(`  Output size:   ~${sizeKB}KB`);
    console.log(`  Output:        ${outputPath}`);

    // Validate output is parseable
    const verify = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as Record<string, unknown>;
    const verifyCount = Object.keys(verify).length;
    if (verifyCount !== totalProcessed) {
        console.error(`  ERROR: Verification failed. Expected ${totalProcessed} entries, got ${verifyCount}`);
        process.exit(1);
    }
    console.log(`  Verified:      ${verifyCount} entries ✓`);
}

main();
