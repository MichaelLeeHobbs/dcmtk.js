import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dcmconv, dcmdump, dicom2json, dump2dcm, lookupTag } from '../../../src';
import type { DicomJsonModel } from '../../../src';
import { dcmtkAvailable, createTempDir, removeTempDir } from '../helpers';

/**
 * Repeating groups — overlays `(60xx,eeee)` and curves `(50xx,eeee)` — are defined
 * once in the standard for a whole family of tags. The dictionary must resolve them
 * through their range, which matters most for implicit VR files where the dictionary
 * is the only source of a VR.
 *
 * This exercises a file DCMTK itself wrote, and checks our VRs against dcmdump's.
 */
const DUMP = [
    '(0008,0016) UI [1.2.840.10008.5.1.4.1.1.7]',
    '(0008,0060) CS [OT]',
    '(0010,0010) PN [OVERLAY^TEST]',
    '(6000,0010) US 512',
    '(6000,0011) US 512',
    '(6000,0040) CS [G]',
    '(6000,0050) SS 1\\1',
    '(6000,3000) OW 00ff\\ff00',
    '(6002,0010) US 256',
    '(6002,3000) OW 1234\\5678',
    '(5000,0005) US 1',
    '',
].join('\n');

/** Tag → VR the dictionary defines for the repeating family. */
const EXPECTED_VRS: ReadonlyArray<readonly [string, string]> = [
    ['60000010', 'US'],
    ['60000040', 'CS'],
    ['60000050', 'SS'],
    ['60003000', 'OW'],
    ['60020010', 'US'],
    ['60023000', 'OW'],
    ['50000005', 'US'],
];

describe.skipIf(!dcmtkAvailable)('dictionary repeating groups vs DCMTK', () => {
    let tempDir: string;
    let implicitPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('dcmtk-overlay-');
        const dumpPath = join(tempDir, 'overlay.dump');
        const explicitPath = join(tempDir, 'overlay-explicit.dcm');
        implicitPath = join(tempDir, 'overlay-implicit.dcm');

        await writeFile(dumpPath, DUMP, 'utf8');

        const written = await dump2dcm(dumpPath, explicitPath, { generateNewUIDs: true });
        expect(written.ok).toBe(true);

        const converted = await dcmconv(explicitPath, implicitPath, { transferSyntax: '+ti' });
        expect(converted.ok).toBe(true);
    }, 60_000);

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('resolves implicit VR for overlay and curve tags', async () => {
        const result = await dicom2json(implicitPath);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const data: DicomJsonModel = result.value.data;
        for (const [tag, vr] of EXPECTED_VRS) {
            expect(data[tag], `tag ${tag} missing from the parsed model`).toBeDefined();
            expect(data[tag]?.vr, `tag ${tag}`).toBe(vr);
        }
    });

    it('agrees with dcmdump on the keyword for each repeating tag', async () => {
        const dumped = await dcmdump(implicitPath);
        expect(dumped.ok).toBe(true);
        if (!dumped.ok) return;

        // dcmdump prints the keyword it resolved from DCMTK's own dictionary.
        for (const [tag] of EXPECTED_VRS) {
            const keyword = lookupTag(tag)?.name;
            expect(keyword, `tag ${tag} unknown to the dictionary`).toBeDefined();
            expect(dumped.value.text, `tag ${tag} keyword`).toContain(keyword ?? '');
        }
    });
});
