import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DcmQRSCP } from '../../../src/servers/DcmQRSCP';
import { StoreSCP } from '../../../src/servers/StoreSCP';
import { findscu } from '../../../src/tools/findscu';
import { getscu } from '../../../src/tools/getscu';
import { movescu } from '../../../src/tools/movescu';
import { dcmqridx } from '../../../src/tools/dcmqridx';
import { dcm2json } from '../../../src/tools/dcm2json';
import { DicomDataset } from '../../../src/dicom/DicomDataset';
import { dcmtkAvailable, SAMPLES, getAvailablePort, createTempDir, removeTempDir, copyDicomToTemp, generateQRConfig } from '../helpers';

describe.skipIf(!dcmtkAvailable)('query-retrieve integration', () => {
    let tempDir: string;
    let dbDir: string;
    let outputDir: string;
    let moveDestDir: string;
    let configFile: string;
    let qrPort: number;
    let movePort: number;
    let studyInstanceUID: string;

    let qrServer: DcmQRSCP;
    let moveScp: StoreSCP;

    const QR_AE = 'TESTQR';
    const MOVE_AE = 'MOVESCP';

    beforeAll(async () => {
        // 1. Create temp dirs
        tempDir = await createTempDir('qr-integ-');
        dbDir = join(tempDir, 'db', QR_AE);
        outputDir = join(tempDir, 'output');
        moveDestDir = join(tempDir, 'moveDest');
        await mkdir(dbDir, { recursive: true });
        await mkdir(outputDir, { recursive: true });
        await mkdir(moveDestDir, { recursive: true });

        // 2. Copy sample file into storage area
        await copyDicomToTemp(SAMPLES.OTHER_0002D, dbDir, 'sample.dcm');

        // 3. Register with dcmqridx
        const idxResult = await dcmqridx({
            indexDirectory: dbDir,
            inputFiles: [join(dbDir, 'sample.dcm')],
        });
        if (!idxResult.ok) {
            throw new Error(`dcmqridx setup failed: ${idxResult.error.message}`);
        }

        // 4. Read StudyInstanceUID from the registered file
        const jsonResult = await dcm2json(join(dbDir, 'sample.dcm'));
        if (!jsonResult.ok) {
            throw new Error(`dcm2json setup failed: ${jsonResult.error.message}`);
        }
        const ds = DicomDataset.fromJson(jsonResult.value.data);
        if (!ds.ok) {
            throw new Error(`DicomDataset setup failed: ${ds.error.message}`);
        }
        const uid = ds.value.studyInstanceUID;
        if (uid === undefined) {
            throw new Error('Sample file has no StudyInstanceUID');
        }
        studyInstanceUID = uid;

        // 5. Get two available ports
        qrPort = await getAvailablePort();
        movePort = await getAvailablePort();

        // 6. Generate dcmqrscp.cfg
        const configContent = generateQRConfig({
            port: qrPort,
            aeTitle: QR_AE,
            storageArea: dbDir,
            moveDestinations: [{ name: 'movescp', aeTitle: MOVE_AE, host: 'localhost', port: movePort }],
        });
        configFile = join(tempDir, 'dcmqrscp.cfg');
        await writeFile(configFile, configContent, 'utf-8');

        // 7. Start Q/R SCP (do not pass singleProcess — some builds are single-process only
        //    and reject the -s flag)
        const qrResult = DcmQRSCP.create({
            configFile,
            port: qrPort,
            startTimeoutMs: 15_000,
        });
        if (!qrResult.ok) {
            throw new Error(`DcmQRSCP.create failed: ${qrResult.error.message}`);
        }
        qrServer = qrResult.value;
        const qrStart = await qrServer.start();
        if (!qrStart.ok) {
            throw new Error(`DcmQRSCP start failed: ${qrStart.error.message}`);
        }
        // dcmqrscp resolves on spawn — wait for socket to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 8. Start StoreSCP for C-MOVE destination
        const moveResult = StoreSCP.create({
            port: movePort,
            outputDirectory: moveDestDir,
            aeTitle: MOVE_AE,
        });
        if (!moveResult.ok) {
            throw new Error(`StoreSCP.create failed: ${moveResult.error.message}`);
        }
        moveScp = moveResult.value;
        const moveStart = await moveScp.start();
        if (!moveStart.ok) {
            throw new Error(`StoreSCP start failed: ${moveStart.error.message}`);
        }
        // StoreSCP needs warmup — resolves on spawn, not listen
        await new Promise(resolve => setTimeout(resolve, 1000));
    }, 60_000);

    afterAll(async () => {
        try {
            await qrServer?.stop();
        } catch {
            /* already stopped */
        }
        try {
            await moveScp?.stop();
        } catch {
            /* already stopped */
        }
        if (tempDir !== undefined) {
            await removeTempDir(tempDir);
        }
    });

    // -----------------------------------------------------------------------
    // C-FIND (findscu)
    // -----------------------------------------------------------------------

    describe('findscu (C-FIND)', () => {
        it('study-level query succeeds', async () => {
            const result = await findscu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', `0020,000D=${studyInstanceUID}`],
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.success).toBe(true);
            }
        });

        it('writes response files with --extract', async () => {
            const extractDir = join(tempDir, 'find-extract');
            await mkdir(extractDir, { recursive: true });

            const result = await findscu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', `0020,000D=${studyInstanceUID}`],
                extract: true,
                outputDirectory: extractDir,
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);

            await new Promise(resolve => setTimeout(resolve, 3000));

            const files = await readdir(extractDir);
            expect(files.length).toBeGreaterThan(0);
        });

        it('patient-level query succeeds', async () => {
            const result = await findscu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'patient',
                keys: ['0008,0052=PATIENT', '0010,0010=*'],
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.success).toBe(true);
            }
        });

        it('works with custom callingAETitle', async () => {
            const result = await findscu({
                host: '127.0.0.1',
                port: qrPort,
                callingAETitle: 'MYSCU',
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', `0020,000D=${studyInstanceUID}`],
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // C-GET (getscu)
    // -----------------------------------------------------------------------

    describe('getscu (C-GET)', () => {
        it('retrieves by StudyInstanceUID to output dir', async () => {
            const getDir = join(tempDir, 'get-output');
            await mkdir(getDir, { recursive: true });

            const result = await getscu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', `0020,000D=${studyInstanceUID}`],
                outputDirectory: getDir,
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);

            await new Promise(resolve => setTimeout(resolve, 3000));

            const files = await readdir(getDir);
            expect(files.length).toBeGreaterThan(0);
        });

        it('study query model succeeds', async () => {
            const getDir2 = join(tempDir, 'get-study');
            await mkdir(getDir2, { recursive: true });

            const result = await getscu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', `0020,000D=${studyInstanceUID}`],
                outputDirectory: getDir2,
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.success).toBe(true);
            }
        });

        it('returns error or empty for non-existent UID', async () => {
            const getDir3 = join(tempDir, 'get-empty');
            await mkdir(getDir3, { recursive: true });

            const result = await getscu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', '0020,000D=9.9.9.9.9.9.9.9'],
                outputDirectory: getDir3,
                timeoutMs: 30_000,
            });
            // Non-existent UID: may succeed with no files or return an error
            if (result.ok) {
                const files = await readdir(getDir3);
                expect(files.length).toBe(0);
            } else {
                expect(result.ok).toBe(false);
            }
        });
    });

    // -----------------------------------------------------------------------
    // C-MOVE (movescu)
    // -----------------------------------------------------------------------

    describe('movescu (C-MOVE)', () => {
        it('moves study to MOVESCP — files appear in destination', async () => {
            const result = await movescu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', `0020,000D=${studyInstanceUID}`],
                moveDestination: MOVE_AE,
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);

            // Wait for file transfer to complete
            await new Promise(resolve => setTimeout(resolve, 3000));

            const files = await readdir(moveDestDir);
            expect(files.length).toBeGreaterThan(0);
        });

        it('succeeds with explicit moveDestination', async () => {
            const result = await movescu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', `0020,000D=${studyInstanceUID}`],
                moveDestination: MOVE_AE,
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.success).toBe(true);
            }
        });

        it('study query model works', async () => {
            const result = await movescu({
                host: '127.0.0.1',
                port: qrPort,
                calledAETitle: QR_AE,
                queryModel: 'study',
                keys: ['0008,0052=STUDY', `0020,000D=${studyInstanceUID}`],
                moveDestination: MOVE_AE,
                timeoutMs: 30_000,
            });
            expect(result.ok).toBe(true);
        });
    });
});
