import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { join, resolve } from 'node:path';
import { DicomFile } from '../../../src/dicom/DicomFile';
import { ChangeSet } from '../../../src/dicom/ChangeSet';
import { Dcmrecv } from '../../../src/servers/Dcmrecv';
import { storescu } from '../../../src/tools/storescu';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmcjpeg } from '../../../src/tools/dcmcjpeg';
import { dcmdjpeg } from '../../../src/tools/dcmdjpeg';
import { dcmftest } from '../../../src/tools/dcmftest';
import { dcmtkAvailable, SAMPLES, getAvailablePort, createTempDir, removeTempDir, withServer, waitForEvent } from '../helpers';
import type { DicomTagPath } from '../../../src/brands';
import type { StoredFileData } from '../../../src/events/dcmrecv';

const CONFIG_FILE = resolve(__dirname, '../../../_configs/storescp.cfg');
const CONFIG_PROFILE = 'Default';

describe.skipIf(!dcmtkAvailable)('anonymize-and-send workflow', () => {
    const servers: Dcmrecv[] = [];
    let tempDir: string;
    let uncompressedPath: string;

    beforeAll(async () => {
        tempDir = await createTempDir('anon-send-');
        // Decompress OTHER_0002 to get uncompressed input
        uncompressedPath = join(tempDir, 'uncompressed-source.dcm');
        const decompResult = await dcmdjpeg(SAMPLES.OTHER_0002, uncompressedPath);
        if (!decompResult.ok) {
            throw new Error(`Setup failed: ${decompResult.error.message}`);
        }
    });

    afterAll(async () => {
        await removeTempDir(tempDir);
    });

    afterEach(async () => {
        for (const server of servers) {
            try {
                await server.stop();
            } catch {
                /* already stopped */
            }
        }
        servers.length = 0;
    });

    it('anonymizes a file then sends to Dcmrecv', async () => {
        const port = await getAvailablePort();

        // Open and anonymize
        const fileResult = await DicomFile.open(uncompressedPath);
        expect(fileResult.ok).toBe(true);
        if (!fileResult.ok) return;

        const changes = ChangeSet.empty()
            .setTag('(0010,0010)' as DicomTagPath, 'ANONYMOUS')
            .setTag('(0010,0020)' as DicomTagPath, 'ANON001')
            .eraseTag('(0010,0030)' as DicomTagPath); // DOB

        const anonPath = join(tempDir, 'anonymized.dcm');
        const modified = fileResult.value.withChanges(changes);
        const writeResult = await modified.writeAs(anonPath);
        expect(writeResult.ok).toBe(true);

        // Start receiver with config
        const receiveDir = join(tempDir, 'received');
        const { mkdir } = await import('node:fs/promises');
        await mkdir(receiveDir, { recursive: true });

        const createResult = Dcmrecv.create({
            port,
            outputDirectory: receiveDir,
            configFile: CONFIG_FILE,
            configProfile: CONFIG_PROFILE,
        });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            const storedPromise = waitForEvent<StoredFileData>(server, 'STORED_FILE', 30_000);

            const sendResult = await storescu({
                host: '127.0.0.1',
                port,
                files: [anonPath],
                timeoutMs: 30_000,
            });
            expect(sendResult.ok).toBe(true);

            const storedEvent = await storedPromise;

            // Verify received file is anonymized
            const receivedJson = await dcm2json(storedEvent.filePath);
            expect(receivedJson.ok).toBe(true);
            if (receivedJson.ok) {
                const pn = receivedJson.value.data['00100010'];
                if (pn?.Value !== undefined) {
                    const first = pn.Value[0] as Record<string, unknown>;
                    expect(first['Alphabetic']).toBe('ANONYMOUS');
                }
            }
        });
    });

    it('compress, modify, decompress round-trip', async () => {
        // Compress uncompressed file
        const compressedPath = join(tempDir, 'compressed.dcm');
        const compResult = await dcmcjpeg(uncompressedPath, compressedPath, { lossless: true });
        expect(compResult.ok).toBe(true);

        // Decompress
        const decompressedPath = join(tempDir, 'decompressed.dcm');
        const decompResult = await dcmdjpeg(compressedPath, decompressedPath);
        expect(decompResult.ok).toBe(true);

        // Open decompressed, modify, verify
        const fileResult = await DicomFile.open(decompressedPath);
        expect(fileResult.ok).toBe(true);
        if (!fileResult.ok) return;

        const changes = ChangeSet.empty().setTag('(0010,0010)' as DicomTagPath, 'RoundTripTest');

        const modified = fileResult.value.withChanges(changes);
        const applyResult = await modified.applyChanges();
        expect(applyResult.ok).toBe(true);

        // Verify
        const jsonResult = await dcm2json(decompressedPath);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const pn = jsonResult.value.data['00100010'];
            if (pn?.Value !== undefined) {
                const first = pn.Value[0] as Record<string, unknown>;
                expect(first['Alphabetic']).toBe('RoundTripTest');
            }
        }

        // Still valid DICOM
        const testResult = await dcmftest(decompressedPath);
        expect(testResult.ok).toBe(true);
        if (testResult.ok) {
            expect(testResult.value.isDicom).toBe(true);
        }
    });
});
