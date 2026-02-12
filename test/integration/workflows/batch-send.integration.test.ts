import { describe, it, expect, afterEach } from 'vitest';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { StoreSCP } from '../../../src/servers/StoreSCP';
import { Dcmrecv } from '../../../src/servers/Dcmrecv';
import { storescu } from '../../../src/tools/storescu';
import { dcm2json } from '../../../src/tools/dcm2json';
import { dcmtkAvailable, SAMPLES, getAvailablePort, createTempDir, removeTempDir, withServer } from '../helpers';
import type { DcmtkProcess } from '../../../src/DcmtkProcess';
import type { DicomJsonModel } from '../../../src/tools/dcm2json';

const CONFIG_FILE = resolve(__dirname, '../../../src/data/storescp.cfg');
const CONFIG_PROFILE = 'Default';

/** Extracts SOP Instance UID from a DICOM JSON model. */
function extractSOPUID(data: DicomJsonModel): string | undefined {
    const uid = data['00080018'];
    if (uid?.Value !== undefined) {
        return String(uid.Value[0]);
    }
    return undefined;
}

/** Collects SOP Instance UIDs from an array of DICOM file paths. */
async function collectUIDsFromFiles(paths: readonly string[]): Promise<Set<string>> {
    const uids = new Set<string>();
    for (const filePath of paths) {
        const json = await dcm2json(filePath);
        if (json.ok) {
            const uid = extractSOPUID(json.value.data);
            if (uid !== undefined) {
                uids.add(uid);
            }
        }
    }
    return uids;
}

describe.skipIf(!dcmtkAvailable)('batch-send workflow', () => {
    const servers: DcmtkProcess[] = [];
    let tempDir: string;

    afterEach(async () => {
        for (const server of servers) {
            try {
                await server.stop();
            } catch {
                /* already stopped */
            }
        }
        servers.length = 0;
        if (tempDir !== undefined) {
            await removeTempDir(tempDir);
        }
    });

    it('sends a file to StoreSCP and verifies it is received', async () => {
        tempDir = await createTempDir('batch-storescp-');
        const port = await getAvailablePort();
        const createResult = StoreSCP.create({ port, outputDirectory: tempDir });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        await withServer(server, async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const sendResult = await storescu({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 60_000,
            });
            expect(sendResult.ok).toBe(true);

            // Wait for files to be written
            await new Promise(resolve => setTimeout(resolve, 3000));

            const files = await readdir(tempDir);
            expect(files.length).toBeGreaterThanOrEqual(1);
        });
    });

    it('sends file to Dcmrecv and verifies SOP UID matches', async () => {
        tempDir = await createTempDir('batch-dcmrecv-');
        const port = await getAvailablePort();
        const createResult = Dcmrecv.create({
            port,
            outputDirectory: tempDir,
            configFile: CONFIG_FILE,
            configProfile: CONFIG_PROFILE,
        });
        if (!createResult.ok) return;

        const server = createResult.value;
        servers.push(server);

        const storedFiles: string[] = [];
        server.onEvent('STORED_FILE', data => {
            storedFiles.push(data.filePath);
        });

        await withServer(server, async () => {
            const sendResult = await storescu({
                host: '127.0.0.1',
                port,
                files: [SAMPLES.OTHER_0002D],
                timeoutMs: 60_000,
            });
            expect(sendResult.ok).toBe(true);

            // Wait for events
            await new Promise(resolve => setTimeout(resolve, 3000));
            expect(storedFiles.length).toBeGreaterThanOrEqual(1);

            // Verify SOP UIDs
            const origUIDs = await collectUIDsFromFiles([SAMPLES.OTHER_0002D]);
            const receivedUIDs = await collectUIDsFromFiles(storedFiles);

            // All original UIDs should be in received set
            for (const uid of origUIDs) {
                expect(receivedUIDs.has(uid)).toBe(true);
            }
        });
    });
});
