import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { img2dcm } from '../../../src/tools/img2dcm';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, createTempDir, removeTempDir } from '../helpers';

describe.skipIf(!dcmtkAvailable)('img2dcm integration', () => {
    let tempDir: string;
    let jpegPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('img2dcm-');

        // Create a minimal valid JPEG file (smallest valid JFIF JPEG)
        // SOI + APP0 JFIF header + minimal DQT + SOF0 + DHT + SOS + EOI
        const jpegBytes = Buffer.from([
            0xff,
            0xd8, // SOI
            0xff,
            0xe0, // APP0
            0x00,
            0x10, // length 16
            0x4a,
            0x46,
            0x49,
            0x46,
            0x00, // JFIF\0
            0x01,
            0x01, // version 1.1
            0x00, // aspect ratio units
            0x00,
            0x01, // X density
            0x00,
            0x01, // Y density
            0x00,
            0x00, // no thumbnail
            0xff,
            0xdb, // DQT
            0x00,
            0x43, // length 67
            0x00, // 8-bit precision, table 0
            // 64 quantization values (all 1s for simplicity)
            ...Array.from({ length: 64 }, () => 0x01),
            0xff,
            0xc0, // SOF0 (baseline)
            0x00,
            0x0b, // length 11
            0x08, // 8-bit precision
            0x00,
            0x01, // height 1
            0x00,
            0x01, // width 1
            0x01, // 1 component
            0x01, // component ID 1
            0x11, // sampling 1x1
            0x00, // quant table 0
            0xff,
            0xc4, // DHT
            0x00,
            0x1f, // length 31
            0x00, // DC table 0
            0x00,
            0x01,
            0x05,
            0x01,
            0x01,
            0x01,
            0x01,
            0x01,
            0x01,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x01,
            0x02,
            0x03,
            0x04,
            0x05,
            0x06,
            0x07,
            0x08,
            0x09,
            0x0a,
            0x0b,
            0xff,
            0xc4, // DHT
            0x00,
            0x1f, // length 31
            0x10, // AC table 0
            0x00,
            0x01,
            0x05,
            0x01,
            0x01,
            0x01,
            0x01,
            0x01,
            0x01,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x01,
            0x02,
            0x03,
            0x04,
            0x05,
            0x06,
            0x07,
            0x08,
            0x09,
            0x0a,
            0x0b,
            0xff,
            0xda, // SOS
            0x00,
            0x08, // length 8
            0x01, // 1 component
            0x01, // component 1
            0x00, // DC/AC table 0/0
            0x00,
            0x3f,
            0x00, // spectral selection
            0x7f,
            0x50, // scan data (padding)
            0xff,
            0xd9, // EOI
        ]);
        jpegPath = join(tempDir, 'test.jpg');
        await writeFile(jpegPath, jpegBytes);
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    it('converts a JPEG image to DICOM', async () => {
        const outputPath = join(tempDir, 'from-jpeg.dcm');
        const result = await img2dcm(jpegPath, outputPath, { inputFormat: 'jpeg' });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.outputPath).toBe(outputPath);
            expect(existsSync(outputPath)).toBe(true);
        }
    });

    it('output is valid DICOM', async () => {
        const outputPath = join(tempDir, 'valid-jpeg.dcm');
        await img2dcm(jpegPath, outputPath, { inputFormat: 'jpeg' });

        const testResult = await dcmftest(outputPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });

    it('returns error for non-existent input', async () => {
        const outputPath = join(tempDir, 'fail.dcm');
        const result = await img2dcm('/nonexistent/path/image.jpg', outputPath);
        expect(result.ok).toBe(false);
    });

    it('returns error for invalid options', async () => {
        const outputPath = join(tempDir, 'fail2.dcm');
        // @ts-expect-error testing invalid option
        const result = await img2dcm(jpegPath, outputPath, { bogus: true });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain('invalid options');
        }
    });
});
