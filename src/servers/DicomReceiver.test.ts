import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { DicomReceiver } from './DicomReceiver';
import type {
    ReceiverFileReceivedData,
    ReceiverFileStoredData,
    ReceiverInstanceData,
    ReceiverInstanceErrorData,
    ReceiverAssociationData,
    ReceiverAssociationFinalizedData,
    ReceiverErrorData,
    PoolAssociationReceivedData,
    PoolCStoreRequestData,
    PoolEchoRequestData,
    PoolRefusingAssociationData,
} from './DicomReceiver';
import { Dcmrecv } from './Dcmrecv';
import * as fsp from 'node:fs/promises';
import * as net from 'node:net';

// ---------------------------------------------------------------------------
// Mock Dcmrecv — a fake that emits events like the real one
// ---------------------------------------------------------------------------

class FakeDcmrecv extends EventEmitter {
    started = false;
    stopped = false;
    disposed = false;
    readonly port: number;

    constructor(port: number) {
        super();
        this.port = port;
        this.setMaxListeners(20);
    }

    start(): Promise<{ ok: true; value: undefined }> {
        this.started = true;
        return Promise.resolve({ ok: true, value: undefined });
    }

    stop(): Promise<{ ok: true; value: undefined }> {
        this.stopped = true;
        return Promise.resolve({ ok: true, value: undefined });
    }

    [Symbol.dispose](): void {
        this.disposed = true;
    }

    onFileReceived(listener: (data: unknown) => void): this {
        return this.on('FILE_RECEIVED', listener);
    }

    onAssociationComplete(listener: (data: unknown) => void): this {
        return this.on('ASSOCIATION_COMPLETE', listener);
    }

    onEvent(event: string, listener: (...args: unknown[]) => void): this {
        return this.on(event, listener);
    }
}

// Track created fakes for assertions
let createdFakes: FakeDcmrecv[] = [];

vi.mock('./Dcmrecv', () => ({
    Dcmrecv: {
        create: vi.fn((options: { port: number }) => {
            const fake = new FakeDcmrecv(options.port);
            createdFakes.push(fake);
            return { ok: true, value: fake };
        }),
    },
}));

// ---------------------------------------------------------------------------
// Mock net module — each createServer returns a new mock with unique port
// ---------------------------------------------------------------------------

let allocatedPortCounter = 50000;
let connectionHandler: ((socket: unknown) => void) | undefined;

function createMockServer(): Record<string, unknown> {
    const port = ++allocatedPortCounter;
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const srv = {
        listen: vi.fn((_port: number, _host: unknown, cb?: () => void) => {
            if (typeof _host === 'function') {
                (_host as () => void)();
            } else if (cb !== undefined) {
                cb();
            }
        }),
        close: vi.fn((cb?: () => void) => {
            if (cb !== undefined) cb();
        }),
        address: vi.fn(() => ({ port })),
        on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
            listeners.set(event, listener);
            return srv;
        }),
    };
    return srv;
}

vi.mock('node:net', () => ({
    createServer: vi.fn((handler?: (socket: unknown) => void) => {
        const srv = createMockServer();
        // If a handler is provided, this is the TCP proxy (not port allocation)
        if (handler !== undefined) {
            connectionHandler = handler;
        }
        return srv;
    }),
    createConnection: vi.fn(() => {
        const socket = new EventEmitter();
        Object.assign(socket, {
            pipe: vi.fn().mockReturnThis(),
            unpipe: vi.fn(),
            resume: vi.fn(),
            pause: vi.fn(),
            destroy: vi.fn(),
            destroyed: false,
        });
        return socket;
    }),
}));

// Mock DicomInstance — vi.hoisted ensures the variable is available to the hoisted vi.mock factory
const { mockDicomInstance, mockOpen } = vi.hoisted(() => {
    const inst = { patientName: 'DOE^JOHN', sopInstanceUID: '1.2.3.4.5', filePath: '/data/file.dcm' };
    type OpenResult = { ok: true; value: typeof inst } | { ok: false; error: Error };
    return {
        mockDicomInstance: inst,
        mockOpen: vi.fn((): Promise<OpenResult> => Promise.resolve({ ok: true, value: inst })),
    };
});

vi.mock('../dicom/DicomInstance', () => ({
    DicomInstance: { open: mockOpen },
}));

// Mock fs/promises. `workerTempFiles` stands in for the worker temp folders' contents: readdir of a
// dcmrecv-pool folder lists it, and a rename out of one removes the file from it.
const { workerTempFiles, baseName } = vi.hoisted(() => ({
    workerTempFiles: new Set<string>(),
    baseName: (filePath: string): string => filePath.split(/[\\/]/).pop() ?? filePath,
}));

vi.mock('node:fs/promises', () => ({
    mkdir: vi.fn(() => Promise.resolve(undefined)),
    rename: vi.fn((src: string) => {
        workerTempFiles.delete(baseName(src));
        return Promise.resolve(undefined);
    }),
    copyFile: vi.fn(() => Promise.resolve(undefined)),
    unlink: vi.fn(() => Promise.resolve(undefined)),
    rm: vi.fn(() => Promise.resolve(undefined)),
    stat: vi.fn(() => Promise.resolve({ size: 524288 })),
    readdir: vi.fn((dir: string) => Promise.resolve(dir.includes('dcmrecv-pool') ? [...workerTempFiles] : [])),
}));

// Mock os.tmpdir
vi.mock('node:os', () => ({
    tmpdir: vi.fn(() => '/tmp'),
}));

describe('DicomReceiver', () => {
    beforeEach(() => {
        createdFakes = [];
        allocatedPortCounter = 50000;
        connectionHandler = undefined;
        workerTempFiles.clear();
    });

    afterEach(() => {
        for (const fake of createdFakes) {
            fake.removeAllListeners();
        }
    });

    // -----------------------------------------------------------------------
    // create() validation
    // -----------------------------------------------------------------------

    describe('create()', () => {
        it('returns ok with valid minimal options', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data/received' });
            expect(result.ok).toBe(true);
        });

        it('returns ok with all options', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data/received',
                aeTitle: 'MYRECV',
                minPoolSize: 3,
                maxPoolSize: 8,
                connectionTimeoutMs: 5000,
                configFile: '/etc/dcmrecv.cfg',
                configProfile: 'Default',
            });
            expect(result.ok).toBe(true);
        });

        it('accepts port 0 for handleSocket-only mode', () => {
            const result = DicomReceiver.create({ port: 0, storageDir: '/data' });
            expect(result.ok).toBe(true);
        });

        it('rejects port > 65535', () => {
            const result = DicomReceiver.create({ port: 70000, storageDir: '/data' });
            expect(result.ok).toBe(false);
        });

        it('rejects empty storageDir', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '' });
            expect(result.ok).toBe(false);
        });

        it('rejects path traversal in storageDir', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '../../../etc' });
            expect(result.ok).toBe(false);
        });

        it('rejects invalid aeTitle characters', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', aeTitle: 'HAS\\SLASH' });
            expect(result.ok).toBe(false);
        });

        it('rejects aeTitle longer than 16 characters', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', aeTitle: 'A'.repeat(17) });
            expect(result.ok).toBe(false);
        });

        it('rejects minPoolSize > maxPoolSize', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 10,
                maxPoolSize: 5,
            });
            expect(result.ok).toBe(false);
            if (!result.ok) expect(result.error.message).toMatch(/minPoolSize/);
        });

        it('rejects unknown options via strict schema', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                unknownOption: true,
            } as never);
            expect(result.ok).toBe(false);
        });

        it('rejects path traversal in configFile', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                configFile: '../../etc/passwd',
            });
            expect(result.ok).toBe(false);
        });

        it('accepts equal minPoolSize and maxPoolSize', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 5,
                maxPoolSize: 5,
            });
            expect(result.ok).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // start() / stop()
    // -----------------------------------------------------------------------

    describe('start()', () => {
        it('spawns minPoolSize workers and starts TCP proxy', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 2 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const receiver = result.value;
            const startResult = await receiver.start();
            expect(startResult.ok).toBe(true);
            expect(createdFakes).toHaveLength(2);
            expect(createdFakes[0]?.started).toBe(true);
            expect(createdFakes[1]?.started).toBe(true);

            await receiver.stop();
        });

        it('returns error when called twice', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            await receiver.start();
            const secondStart = await receiver.start();
            expect(secondStart.ok).toBe(false);
            if (!secondStart.ok) expect(secondStart.error.message).toMatch(/already started/);

            await receiver.stop();
        });

        it('spawns default minPoolSize of 2 when not specified', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;

            const receiver = result.value;
            await receiver.start();
            expect(createdFakes).toHaveLength(2);
            await receiver.stop();
        });
    });

    describe('stop()', () => {
        it('stops all workers and closes TCP proxy', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 2 });
            if (!result.ok) return;

            const receiver = result.value;
            await receiver.start();
            await receiver.stop();

            expect(createdFakes[0]?.stopped).toBe(true);
            expect(createdFakes[1]?.stopped).toBe(true);
            expect(createdFakes[0]?.disposed).toBe(true);
            expect(createdFakes[1]?.disposed).toBe(true);
        });

        it('is safe to call when not started', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;

            await expect(result.value.stop()).resolves.toBeUndefined();
        });

        it('is safe to call twice', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            await receiver.start();
            await receiver.stop();
            await expect(receiver.stop()).resolves.toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // poolStatus
    // -----------------------------------------------------------------------

    describe('poolStatus', () => {
        it('reports correct idle/busy/total counts', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 3, maxPoolSize: 5 });
            if (!result.ok) return;

            const receiver = result.value;
            await receiver.start();

            const status = receiver.poolStatus;
            expect(status.idle).toBe(3);
            expect(status.busy).toBe(0);
            expect(status.total).toBe(3);

            await receiver.stop();
        });

        it('reports zero when not started', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;

            const status = result.value.poolStatus;
            expect(status.idle).toBe(0);
            expect(status.busy).toBe(0);
            expect(status.total).toBe(0);
        });
    });

    // -----------------------------------------------------------------------
    // AbortSignal
    // -----------------------------------------------------------------------

    describe('AbortSignal', () => {
        it('accepts AbortSignal in options', () => {
            const controller = new AbortController();
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                signal: controller.signal,
            });
            expect(result.ok).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Event listener convenience methods
    // -----------------------------------------------------------------------

    describe('event listeners', () => {
        it('onFileReceived returns this for chaining', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;

            const receiver = result.value;
            const returnVal = receiver.onFileReceived(vi.fn());
            expect(returnVal).toBe(receiver);
        });

        it('onAssociationComplete returns this for chaining', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;

            const receiver = result.value;
            const returnVal = receiver.onAssociationComplete(vi.fn());
            expect(returnVal).toBe(receiver);
        });

        it('onEvent returns this for chaining', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;

            const receiver = result.value;
            const returnVal = receiver.onEvent('FILE_RECEIVED', vi.fn());
            expect(returnVal).toBe(receiver);
        });
    });

    // -----------------------------------------------------------------------
    // Worker lifecycle events
    // -----------------------------------------------------------------------

    describe('worker event wiring', () => {
        it('emits FILE_RECEIVED, FILE_STORED, and INSTANCE_RECEIVED for each file', async () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 1,
                maxPoolSize: 1,
            });
            if (!result.ok) return;

            const receiver = result.value;
            const fileReceivedEvents: ReceiverFileReceivedData[] = [];
            const fileStoredEvents: ReceiverFileStoredData[] = [];
            const instanceEvents: ReceiverInstanceData[] = [];
            const errorEvents: ReceiverErrorData[] = [];
            receiver.onFileReceived(data => fileReceivedEvents.push(data));
            receiver.onFileStored(data => fileStoredEvents.push(data));
            receiver.onInstanceReceived(data => instanceEvents.push(data));
            receiver.onEvent('error', data => errorEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            worker.emit('FILE_RECEIVED', {
                filePath: '/tmp/dcmrecv-pool-50001-1234/file1.dcm',
                associationId: 'assoc-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
            });

            await delay(100);

            // FILE_RECEIVED fires immediately (raw from dcmrecv)
            expect(fileReceivedEvents).toHaveLength(1);
            expect(fileReceivedEvents[0]?.associationId).toBe('assoc-1');

            // FILE_STORED fires after move + stat
            expect(fileStoredEvents).toHaveLength(1);
            expect(fileStoredEvents[0]?.fileSize).toBe(524288);

            // INSTANCE_RECEIVED fires after DicomInstance.open
            expect(instanceEvents).toHaveLength(1);
            expect(instanceEvents[0]?.instance).toBe(mockDicomInstance);

            expect(errorEvents).toHaveLength(0);

            await receiver.stop();
        });

        it('emits ASSOCIATION_COMPLETE and returns worker to idle', async () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 1,
                maxPoolSize: 1,
            });
            if (!result.ok) return;

            const receiver = result.value;
            const assocEvents: ReceiverAssociationData[] = [];
            receiver.onAssociationComplete(data => assocEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            // Make worker busy
            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            expect(receiver.poolStatus.busy).toBe(1);

            // Simulate ASSOCIATION_COMPLETE
            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'assoc-internal-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
                files: ['/tmp/file1.dcm'],
                durationMs: 1234,
                endReason: 'release',
            });

            await delay(50);

            expect(assocEvents).toHaveLength(1);
            const evt = assocEvents[0];
            expect(evt).toMatchObject({ endReason: 'release', durationMs: 1234 });
            expect(evt?.totalBytes).toBeTypeOf('number');
            expect(evt?.bytesPerSecond).toBeTypeOf('number');
            expect(evt?.startAt).toBeTypeOf('number');
            expect(evt?.endAt).toBeTypeOf('number');
            expect(receiver.poolStatus.idle).toBe(1);
            expect(receiver.poolStatus.busy).toBe(0);

            await receiver.stop();
        });

        it('worker handles abort end reason', async () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 1,
                maxPoolSize: 1,
            });
            if (!result.ok) return;

            const receiver = result.value;
            const assocEvents: ReceiverAssociationData[] = [];
            receiver.onAssociationComplete(data => assocEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'assoc-internal-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
                files: [],
                durationMs: 500,
                endReason: 'abort',
            });

            await delay(50);

            expect(assocEvents).toHaveLength(1);
            expect(assocEvents[0]?.endReason).toBe('abort');

            await receiver.stop();
        });

        it('emits FILE_STORED + INSTANCE_ERROR (not INSTANCE_RECEIVED) when DicomInstance.open fails', async () => {
            mockOpen.mockResolvedValueOnce({ ok: false, error: new Error('Failed to parse DICOM') });

            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const storedEvents: ReceiverFileStoredData[] = [];
            const instanceEvents: ReceiverInstanceData[] = [];
            const instanceErrors: ReceiverInstanceErrorData[] = [];
            receiver.onFileStored(data => storedEvents.push(data));
            receiver.onInstanceReceived(data => instanceEvents.push(data));
            receiver.onInstanceError(data => instanceErrors.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            worker.emit('FILE_RECEIVED', {
                filePath: '/tmp/dcmrecv-pool-50001-1234/bad.dcm',
                associationId: 'assoc-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
            });
            await delay(100);

            // FILE_STORED fires (file is on disk)
            expect(storedEvents).toHaveLength(1);
            // INSTANCE_RECEIVED does NOT fire (parse failed)
            expect(instanceEvents).toHaveLength(0);
            // INSTANCE_ERROR fires with the parse failure details
            expect(instanceErrors).toHaveLength(1);
            expect(instanceErrors[0]?.error.message).toBe('Failed to parse DICOM');
            expect(instanceErrors[0]?.thrown).toBe(false);
            expect(instanceErrors[0]?.filePath).toContain('bad.dcm');

            await receiver.stop();
        });

        it('emits FILE_STORED for all 4 files when 2 unique instances are each sent twice (regression: #23)', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const fileEvents: ReceiverFileStoredData[] = [];
            const errorEvents: ReceiverErrorData[] = [];
            receiver.onFileStored(data => fileEvents.push(data));
            receiver.onEvent('error', data => errorEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            // Simulate dcmrecv receiving 4 C-STORE requests: 2 unique instances, each sent twice
            // With filenameMode: 'unique', each gets a distinct filename
            const files = [
                '/tmp/dcmrecv-pool-50001-1234/SRt.X.1.2.276.0.7230010.3.1.4.0.20.661806',
                '/tmp/dcmrecv-pool-50001-1234/SRt.X.1.2.276.0.7230010.3.1.4.0.20.661807',
                '/tmp/dcmrecv-pool-50001-1234/DX.X.1.2.276.0.7230010.3.1.4.0.20.661808',
                '/tmp/dcmrecv-pool-50001-1234/DX.X.1.2.276.0.7230010.3.1.4.0.20.661809',
            ];

            for (const filePath of files) {
                worker.emit('FILE_RECEIVED', {
                    filePath,
                    associationId: 'assoc-1',
                    callingAE: 'VNS-DICOM-QR',
                    calledAE: '00060',
                    source: 'localhost',
                });
            }

            await delay(200);

            expect(errorEvents).toHaveLength(0);
            expect(fileEvents).toHaveLength(4);

            const receivedPaths = fileEvents.map(e => e.filePath);
            for (const filePath of files) {
                const basename = filePath.split('/').pop()!;
                expect(receivedPaths.some(p => p.includes(basename))).toBe(true);
            }

            await receiver.stop();
        });

        it('emits zero totalBytes for zero-file association', async () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 1,
                maxPoolSize: 1,
            });
            if (!result.ok) return;

            const receiver = result.value;
            const assocEvents: ReceiverAssociationData[] = [];
            receiver.onAssociationComplete(data => assocEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            // Complete association without sending any files
            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'assoc-internal-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
                files: [],
                durationMs: 100,
                endReason: 'release',
            });

            await delay(50);

            expect(assocEvents).toHaveLength(1);
            expect(assocEvents[0]?.totalBytes).toBe(0);
            expect(assocEvents[0]?.bytesPerSecond).toBe(0);
            expect(assocEvents[0]?.startAt).toBeTypeOf('number');
            expect(assocEvents[0]?.endAt).toBeTypeOf('number');

            await receiver.stop();
        });
    });
    // -----------------------------------------------------------------------
    // Passthrough options (#3, #4)
    // -----------------------------------------------------------------------

    describe('passthrough options', () => {
        it('passes acseTimeout, dimseTimeout, maxPdu to Dcmrecv.create()', async () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 1,
                maxPoolSize: 1,
                acseTimeout: 30,
                dimseTimeout: 60,
                maxPdu: 65536,
            });
            if (!result.ok) return;

            await result.value.start();

            // Verify the Dcmrecv.create mock was called with passthrough options
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const mockCreate = vi.mocked(Dcmrecv.create);
            const lastCall = mockCreate.mock.calls[mockCreate.mock.calls.length - 1]?.[0];
            expect(lastCall).toMatchObject({
                acseTimeout: 30,
                dimseTimeout: 60,
                maxPdu: 65536,
            });

            await result.value.stop();
        });

        it('accepts valid options in create()', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                acseTimeout: 30,
                dimseTimeout: 60,
                maxPdu: 65536,
            });
            expect(result.ok).toBe(true);
        });

        it('rejects negative acseTimeout', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                acseTimeout: -1,
            });
            expect(result.ok).toBe(false);
        });

        it('rejects maxPdu below 4096', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                maxPdu: 1024,
            });
            expect(result.ok).toBe(false);
        });

        it('rejects maxPdu above 131072', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                maxPdu: 200000,
            });
            expect(result.ok).toBe(false);
        });

        it('passes filenameMode, filenameExtension, storageMode to Dcmrecv.create()', async () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 1,
                maxPoolSize: 1,
                filenameMode: 'unique',
                filenameExtension: '.dcm',
                storageMode: 'bit-preserving',
            });
            if (!result.ok) return;

            await result.value.start();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            const mockCreate = vi.mocked(Dcmrecv.create);
            const lastCall = mockCreate.mock.calls[mockCreate.mock.calls.length - 1]?.[0];
            expect(lastCall).toMatchObject({
                filenameMode: 'unique',
                filenameExtension: '.dcm',
                storageMode: 'bit-preserving',
            });

            await result.value.stop();
        });

        it('accepts all filenameMode values', () => {
            for (const mode of ['default', 'unique', 'short-unique', 'system-time'] as const) {
                const result = DicomReceiver.create({
                    port: 4242,
                    storageDir: '/data',
                    filenameMode: mode,
                });
                expect(result.ok).toBe(true);
            }
        });

        it('accepts all storageMode values', () => {
            for (const mode of ['normal', 'bit-preserving', 'ignore'] as const) {
                const result = DicomReceiver.create({
                    port: 4242,
                    storageDir: '/data',
                    storageMode: mode,
                });
                expect(result.ok).toBe(true);
            }
        });

        it('rejects empty filenameExtension', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                filenameExtension: '',
            });
            expect(result.ok).toBe(false);
        });

        it('rejects invalid filenameMode', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                filenameMode: 'invalid' as never,
            });
            expect(result.ok).toBe(false);
        });

        it('rejects invalid storageMode', () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                storageMode: 'invalid' as never,
            });
            expect(result.ok).toBe(false);
        });

        it('omits filename and storage options when not specified', async () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 1,
                maxPoolSize: 1,
            });
            if (!result.ok) return;

            await result.value.start();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            const mockCreate = vi.mocked(Dcmrecv.create);
            const lastCall = mockCreate.mock.calls[mockCreate.mock.calls.length - 1]?.[0];
            expect(lastCall?.filenameMode).toBe('unique');
            expect(lastCall?.filenameExtension).toBeUndefined();
            expect(lastCall?.storageMode).toBeUndefined();

            await result.value.stop();
        });
    });

    // -----------------------------------------------------------------------
    // Event bubbling (#2)
    // -----------------------------------------------------------------------

    describe('event bubbling', () => {
        it('emits ASSOCIATION_RECEIVED when worker receives association', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const events: PoolAssociationReceivedData[] = [];
            receiver.onAssociationReceived(data => events.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            // Make worker busy first
            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            worker.emit('ASSOCIATION_RECEIVED', {
                source: '192.168.1.1:5000',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
            });

            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                associationId: 'assoc-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
            });

            await receiver.stop();
        });

        it('suppresses a late ASSOCIATION_RECEIVED after the worker has finalized', async () => {
            // Regression: dcmrecv stdout can deliver a stray ASSOCIATION_RECEIVED
            // for a just-finished association after the worker finalized and went
            // idle. Bubbling it would make a consumer register an association that
            // never gets a matching ASSOCIATION_FINALIZED, stranding it.
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const events: PoolAssociationReceivedData[] = [];
            receiver.onAssociationReceived(data => events.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            // Make worker busy, then a legitimate ASSOCIATION_RECEIVED bubbles.
            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }
            worker.emit('ASSOCIATION_RECEIVED', { source: '192.168.1.1:5000', callingAE: 'SCU1', calledAE: 'DCMRECV' });
            expect(events).toHaveLength(1);

            // Finalize the association (worker → idle, finalized = true).
            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'assoc-internal-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
                files: [],
                durationMs: 10,
                endReason: 'release',
            });
            await delay(50);
            expect(receiver.poolStatus.busy).toBe(0);

            // A late stray ASSOCIATION_RECEIVED for the finished association must
            // NOT bubble — still exactly one event from the legitimate one.
            worker.emit('ASSOCIATION_RECEIVED', { source: '192.168.1.1:5000', callingAE: 'SCU1', calledAE: 'DCMRECV' });
            expect(events).toHaveLength(1);

            await receiver.stop();
        });

        it('emits C_STORE_REQUEST when worker receives store request', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const events: PoolCStoreRequestData[] = [];
            receiver.onCStoreRequest(data => events.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            worker.emit('C_STORE_REQUEST', { raw: 'Received Store Request' });

            expect(events).toHaveLength(1);
            expect(events[0]).toMatchObject({
                associationId: 'assoc-1',
                raw: 'Received Store Request',
            });

            await receiver.stop();
        });

        it('emits ECHO_REQUEST when worker receives echo', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const events: PoolEchoRequestData[] = [];
            receiver.onEchoRequest(data => events.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            worker.emit('ECHO_REQUEST');

            expect(events).toHaveLength(1);
            expect(events[0]?.associationId).toBe('assoc-1');

            await receiver.stop();
        });

        it('emits REFUSING_ASSOCIATION when worker refuses', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const events: PoolRefusingAssociationData[] = [];
            receiver.onRefusingAssociation(data => events.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            worker.emit('REFUSING_ASSOCIATION', { reason: 'no valid context' });

            expect(events).toHaveLength(1);
            expect(events[0]?.reason).toBe('no valid context');

            await receiver.stop();
        });
    });

    // -----------------------------------------------------------------------
    // Output accumulation (#6)
    // -----------------------------------------------------------------------

    describe('output accumulation', () => {
        it('includes output lines in ASSOCIATION_COMPLETE', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const assocEvents: ReceiverAssociationData[] = [];
            receiver.onAssociationComplete(data => assocEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            // Simulate output lines from the worker
            worker.emit('line', { source: 'stdout', text: 'Association Received' });
            worker.emit('line', { source: 'stderr', text: 'some debug info' });

            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'assoc-internal-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
                files: [],
                durationMs: 100,
                endReason: 'release',
            });

            await delay(50);

            expect(assocEvents).toHaveLength(1);
            expect(assocEvents[0]?.output).toEqual(['Association Received', 'some debug info']);

            await receiver.stop();
        });

        it('bounds output lines at 500', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const assocEvents: ReceiverAssociationData[] = [];
            receiver.onAssociationComplete(data => assocEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            // Emit 600 lines — should be capped at 500
            for (let i = 0; i < 600; i++) {
                worker.emit('line', { source: 'stdout', text: `line ${String(i)}` });
            }

            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'assoc-internal-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
                files: [],
                durationMs: 100,
                endReason: 'release',
            });

            await delay(50);

            expect(assocEvents[0]?.output).toHaveLength(500);
            expect(assocEvents[0]?.output[0]).toBe('line 0');
            expect(assocEvents[0]?.output[499]).toBe('line 499');

            await receiver.stop();
        });

        it('does not capture lines when worker is idle', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const assocEvents: ReceiverAssociationData[] = [];
            receiver.onAssociationComplete(data => assocEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            // Emit lines while idle — should not be captured
            worker.emit('line', { source: 'stdout', text: 'idle chatter' });

            // Now make worker busy
            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            worker.emit('line', { source: 'stdout', text: 'busy line' });

            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'assoc-internal-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
                files: [],
                durationMs: 100,
                endReason: 'release',
            });

            await delay(50);

            expect(assocEvents[0]?.output).toEqual(['busy line']);

            await receiver.stop();
        });

        it('resets output between associations', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const assocEvents: ReceiverAssociationData[] = [];
            receiver.onAssociationComplete(data => assocEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            // First association
            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }
            worker.emit('line', { source: 'stdout', text: 'first assoc line' });
            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'a1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
                files: [],
                durationMs: 100,
                endReason: 'release',
            });
            await delay(50);

            // Second association
            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }
            worker.emit('line', { source: 'stdout', text: 'second assoc line' });
            worker.emit('ASSOCIATION_COMPLETE', {
                associationId: 'a2',
                callingAE: 'SCU2',
                calledAE: 'DCMRECV',
                source: '192.168.1.2:5000',
                files: [],
                durationMs: 200,
                endReason: 'release',
            });
            await delay(50);

            expect(assocEvents).toHaveLength(2);
            expect(assocEvents[0]?.output).toEqual(['first assoc line']);
            expect(assocEvents[1]?.output).toEqual(['second assoc line']);

            await receiver.stop();
        });
    });

    // -----------------------------------------------------------------------
    // handleSocket() (#1)
    // -----------------------------------------------------------------------

    describe('handleSocket()', () => {
        it('destroys socket with error when not started', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;

            const socket = createMockSocket();
            result.value.handleSocket(socket as unknown as import('node:net').Socket);
            expect(socket.destroy).toHaveBeenCalled();
            const callArg = vi.mocked(socket.destroy as (...args: unknown[]) => void).mock.calls[0]?.[0] as Error | undefined;
            expect(callArg?.message).toContain('not started');
        });

        it('routes socket to worker when started', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 3 });
            if (!result.ok) return;

            const receiver = result.value;
            await receiver.start();

            expect(receiver.poolStatus.idle).toBe(1);

            const socket = createMockSocket();
            receiver.handleSocket(socket as unknown as import('node:net').Socket);

            await delay(50);

            expect(receiver.poolStatus.busy).toBe(1);

            await receiver.stop();
        });

        it('works with port 0 (no TCP proxy)', async () => {
            const result = DicomReceiver.create({ port: 0, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            await receiver.start();

            const socket = createMockSocket();
            receiver.handleSocket(socket as unknown as import('node:net').Socket);

            await delay(50);

            expect(receiver.poolStatus.busy).toBe(1);

            await receiver.stop();
        });
    });

    // -----------------------------------------------------------------------
    // New convenience method chaining
    // -----------------------------------------------------------------------

    describe('new convenience methods', () => {
        it('onAssociationReceived returns this for chaining', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;
            expect(result.value.onAssociationReceived(vi.fn())).toBe(result.value);
        });

        it('onCStoreRequest returns this for chaining', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;
            expect(result.value.onCStoreRequest(vi.fn())).toBe(result.value);
        });

        it('onEchoRequest returns this for chaining', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;
            expect(result.value.onEchoRequest(vi.fn())).toBe(result.value);
        });

        it('onRefusingAssociation returns this for chaining', () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data' });
            if (!result.ok) return;
            expect(result.value.onRefusingAssociation(vi.fn())).toBe(result.value);
        });
    });

    // -----------------------------------------------------------------------
    // stop() with an open association (#53)
    // -----------------------------------------------------------------------

    describe('stop() hands over every file dcmrecv stored (#53)', () => {
        const PEER = { callingAE: 'SCU1', calledAE: 'DCMRECV', source: '192.168.1.1:5000' };

        /** With reportsAbort, the fake dcmrecv reports the abort when its connection is cut, as the real one does. */
        async function startBusyReceiver({ stopTimeoutMs, reportsAbort = true }: { stopTimeoutMs?: number; reportsAbort?: boolean } = {}): Promise<{
            receiver: DicomReceiver;
            worker: FakeDcmrecv;
            remote: Record<string, unknown>;
        }> {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1, stopTimeoutMs });
            if (!result.ok) throw result.error;
            const receiver = result.value;
            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined || connectionHandler === undefined) throw new Error('receiver did not start');
            const remote = createMockSocket();
            if (reportsAbort) {
                vi.mocked(remote.destroy as () => void).mockImplementationOnce(() => {
                    worker.emit('ASSOCIATION_COMPLETE', { associationId: 'assoc-1', ...PEER, files: [], durationMs: 1, endReason: 'abort' });
                });
            }
            connectionHandler(remote);
            await delay(50);
            worker.emit('ASSOCIATION_RECEIVED', PEER);
            return { receiver, worker, remote };
        }

        function tempDirRemovals(): string[] {
            return vi
                .mocked(fsp.rm)
                .mock.calls.map(call => String(call[0]))
                .filter(p => p.includes('dcmrecv-pool'));
        }

        beforeEach(() => {
            vi.mocked(fsp.rm).mockClear();
        });

        it('waits for a stored line parsed while dcmrecv exits before removing the temp folder', async () => {
            const { receiver, worker } = await startBusyReceiver();
            const order: string[] = [];
            vi.mocked(fsp.rm).mockImplementation(p => {
                order.push(`rm ${String(p)}`);
                return Promise.resolve();
            });
            vi.mocked(fsp.rename).mockImplementationOnce(async src => {
                await delay(30);
                order.push(`moved ${baseName(String(src))}`);
            });
            worker.stop = (): Promise<{ ok: true; value: undefined }> => {
                worker.stopped = true;
                worker.emit('FILE_RECEIVED', { filePath: '/tmp/dcmrecv-pool-50001-1/late.dcm', ...PEER });
                return Promise.resolve({ ok: true, value: undefined });
            };
            const stored: ReceiverFileStoredData[] = [];
            receiver.onFileStored(data => stored.push(data));

            await receiver.stop();

            expect(stored.map(s => baseName(s.filePath))).toEqual(['late.dcm']);
            const moved = order.indexOf('moved late.dcm');
            const removed = order.findIndex(o => o.includes('dcmrecv-pool'));
            expect(moved).toBeGreaterThanOrEqual(0);
            expect(removed).toBeGreaterThan(moved);
            vi.mocked(fsp.rm).mockImplementation(() => Promise.resolve());
        });

        it('hands over a file left in the temp folder that dcmrecv never reported', async () => {
            const { receiver, worker } = await startBusyReceiver();
            workerTempFiles.add('unreported.dcm');
            vi.mocked(fsp.rename).mockImplementationOnce(src => {
                workerTempFiles.delete(baseName(String(src)));
                worker.emit('FILE_RECEIVED', { filePath: String(src), ...PEER });
                return Promise.resolve();
            });
            const received: ReceiverFileReceivedData[] = [];
            const stored: ReceiverFileStoredData[] = [];
            const instances: ReceiverInstanceData[] = [];
            receiver.onFileReceived(data => received.push(data));
            receiver.onFileStored(data => stored.push(data));
            receiver.onInstanceReceived(data => instances.push(data));

            await receiver.stop();

            expect(received).toHaveLength(1);
            expect(received[0]).toMatchObject({ associationId: 'assoc-1', ...PEER });
            expect(stored.map(s => baseName(s.filePath))).toEqual(['unreported.dcm']);
            expect(stored[0]?.associationDir).toContain('assoc-1');
            expect(instances).toHaveLength(1);
            expect(tempDirRemovals()).toHaveLength(1);
        });

        it('aborts the open association first and finalizes it as an abort', async () => {
            const { receiver, worker, remote } = await startBusyReceiver();
            let destroyedBeforeStop = false;
            worker.stop = (): Promise<{ ok: true; value: undefined }> => {
                destroyedBeforeStop = vi.mocked(remote.destroy as () => void).mock.calls.length > 0;
                worker.stopped = true;
                return Promise.resolve({ ok: true, value: undefined });
            };
            const finalized: ReceiverAssociationFinalizedData[] = [];
            receiver.onAssociationFinalized(data => finalized.push(data));

            await receiver.stop();

            expect(destroyedBeforeStop).toBe(true);
            expect(finalized).toHaveLength(1);
            expect(finalized[0]).toMatchObject({ associationId: 'assoc-1', endReason: 'abort', ...PEER });
        });

        it('keeps the temp folder and emits an error when a stored file cannot be moved out', async () => {
            const { receiver } = await startBusyReceiver();
            workerTempFiles.add('stuck.dcm');
            vi.mocked(fsp.rename).mockRejectedValueOnce(new Error('EACCES'));
            vi.mocked(fsp.copyFile).mockRejectedValueOnce(new Error('EACCES'));
            const stored: ReceiverFileStoredData[] = [];
            const errors: ReceiverErrorData[] = [];
            receiver.onFileStored(data => stored.push(data));
            receiver.onEvent('error', data => errors.push(data));

            await receiver.stop();

            expect(stored).toHaveLength(1);
            expect(errors.map(e => e.error.message)).toEqual([
                expect.stringMatching(/stuck\.dcm could not be moved out of the worker temp folder/),
                expect.stringMatching(/kept worker temp folder .* 1 file\(s\) could not be handed over/),
            ]);
            expect(baseName(errors[0]?.filePath ?? '')).toBe('stuck.dcm');
            expect(errors[0]?.associationId).toBe('assoc-1');
            expect(tempDirRemovals()).toHaveLength(0);
        });

        it('keeps the temp folder when the folder cannot be listed', async () => {
            const { receiver } = await startBusyReceiver();
            vi.mocked(fsp.readdir).mockRejectedValue(Object.assign(new Error('EIO'), { code: 'EIO' }));
            const errors: ReceiverErrorData[] = [];
            receiver.onEvent('error', data => errors.push(data));

            await receiver.stop();
            vi.mocked(fsp.readdir).mockReset();
            vi.mocked(fsp.readdir).mockImplementation(((dir: string) =>
                Promise.resolve(dir.includes('dcmrecv-pool') ? [...workerTempFiles] : [])) as unknown as typeof fsp.readdir);

            expect(errors.map(e => e.error.message)).toEqual([expect.stringMatching(/kept worker temp folder .*Failed to list directory/)]);
            expect(tempDirRemovals()).toHaveLength(0);
        });

        it('waits past 5 s for a slow parse of an acknowledged file before resolving', async () => {
            const { receiver, worker } = await startBusyReceiver();
            vi.useFakeTimers({ toFake: ['setTimeout', 'setImmediate', 'Date'] });
            try {
                mockOpen.mockImplementationOnce(async () => {
                    await delay(8_000);
                    return { ok: true, value: mockDicomInstance };
                });
                worker.emit('FILE_RECEIVED', { filePath: '/tmp/dcmrecv-pool-50001-1/multiframe.dcm', ...PEER });
                const instances: ReceiverInstanceData[] = [];
                const errors: ReceiverErrorData[] = [];
                receiver.onInstanceReceived(data => instances.push(data));
                receiver.onEvent('error', data => errors.push(data));
                let instancesWhenStopped = -1;

                const stopping = receiver.stop().then(() => {
                    instancesWhenStopped = instances.length;
                });
                await vi.advanceTimersByTimeAsync(10_000);
                await stopping;

                expect(instancesWhenStopped).toBe(1);
                expect(errors).toEqual([]);
                expect(tempDirRemovals()).toHaveLength(1);
            } finally {
                vi.useRealTimers();
            }
        });

        it('names each file it gives up on when handling outlasts stopTimeoutMs, and keeps the temp folder', async () => {
            const { receiver, worker } = await startBusyReceiver({ stopTimeoutMs: 1_000 });
            vi.useFakeTimers({ toFake: ['setTimeout', 'setImmediate', 'Date'] });
            try {
                vi.mocked(fsp.rename).mockImplementationOnce(() => new Promise(() => undefined));
                mockOpen.mockImplementationOnce(() => new Promise(() => undefined));
                worker.emit('FILE_RECEIVED', { filePath: '/tmp/dcmrecv-pool-50001-1/hung-move.dcm', ...PEER });
                worker.emit('FILE_RECEIVED', { filePath: '/tmp/dcmrecv-pool-50001-1/hung-parse.dcm', ...PEER });
                const errors: ReceiverErrorData[] = [];
                receiver.onEvent('error', data => errors.push(data));

                const stopping = receiver.stop();
                await vi.advanceTimersByTimeAsync(2_000);
                await stopping;

                const named = errors.filter(e => e.filePath !== undefined);
                expect(named.map(e => baseName(e.filePath ?? '')).sort()).toEqual(['hung-move.dcm', 'hung-parse.dcm']);
                expect(named.every(e => /gave up after 1000 ms/.test(e.error.message) && e.associationId === 'assoc-1')).toBe(true);
                expect(errors.filter(e => e.filePath === undefined).map(e => e.error.message)).toEqual([
                    expect.stringMatching(/kept worker temp folder .*did not finish within 1000 ms/),
                ]);
                expect(tempDirRemovals()).toHaveLength(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('does not hand over leftovers when dcmrecv never reports the abort: names them and keeps the folder', async () => {
            const { receiver } = await startBusyReceiver({ reportsAbort: false });
            workerTempFiles.add('partial.dcm');
            vi.useFakeTimers({ toFake: ['setTimeout', 'setImmediate', 'Date'] });
            try {
                const stored: ReceiverFileStoredData[] = [];
                const errors: ReceiverErrorData[] = [];
                const finalized: ReceiverAssociationFinalizedData[] = [];
                receiver.onFileStored(data => stored.push(data));
                receiver.onEvent('error', data => errors.push(data));
                receiver.onAssociationFinalized(data => finalized.push(data));

                const stopping = receiver.stop();
                await vi.advanceTimersByTimeAsync(3_000);
                await stopping;

                expect(stored).toEqual([]);
                expect(errors.map(e => e.error.message)).toEqual([
                    expect.stringMatching(/partial\.dcm was left in the worker temp folder and not handed over; it may be incomplete/),
                    expect.stringMatching(/kept worker temp folder/),
                ]);
                expect(finalized).toHaveLength(1);
                expect(finalized[0]).toMatchObject({ associationId: 'assoc-1', endReason: 'abort', ...PEER });
                expect(tempDirRemovals()).toHaveLength(0);
            } finally {
                vi.useRealTimers();
            }
        });

        it('scale-down: routes no new connection to a worker being stopped, and reports leftovers instead of handing them over', async () => {
            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 5 });
            if (!result.ok) throw result.error;
            const receiver = result.value;
            await receiver.start();
            if (connectionHandler === undefined) throw new Error('receiver did not start');
            for (let i = 0; i < 4; i++) {
                connectionHandler(createMockSocket());
                await delay(50);
            }
            expect(receiver.poolStatus).toEqual({ idle: 1, busy: 4, total: 5 });
            const releases: Array<() => void> = [];
            for (const fake of createdFakes) {
                fake.stop = (): Promise<{ ok: true; value: undefined }> => {
                    fake.stopped = true;
                    return new Promise(resolve => releases.push(() => resolve({ ok: true, value: undefined })));
                };
            }
            workerTempFiles.add('leftover.dcm');
            const stored: ReceiverFileStoredData[] = [];
            const errors: ReceiverErrorData[] = [];
            receiver.onFileStored(data => stored.push(data));
            receiver.onEvent('error', data => errors.push(data));

            for (const fake of createdFakes.slice(0, 4)) {
                fake.emit('ASSOCIATION_COMPLETE', { associationId: 'x', ...PEER, files: [], durationMs: 1, endReason: 'release' });
            }
            await delay(100);
            const stopping = createdFakes.filter(f => f.stopped).map(f => f.port);
            expect(stopping).toHaveLength(2);

            connectionHandler(createMockSocket());
            await delay(50);
            const routedPort = (vi.mocked(net.createConnection).mock.lastCall?.[0] as unknown as { port: number }).port;
            expect(stopping).not.toContain(routedPort);

            for (const release of releases) release();
            await delay(50);
            expect(stored).toEqual([]);
            expect(errors.filter(e => e.filePath !== undefined && baseName(e.filePath) === 'leftover.dcm').length).toBe(2);

            workerTempFiles.clear();
            for (const fake of createdFakes) {
                fake.stop = (): Promise<{ ok: true; value: undefined }> => Promise.resolve({ ok: true, value: undefined });
            }
            await receiver.stop();
        });

        it('rejects a non-positive stopTimeoutMs', () => {
            expect(DicomReceiver.create({ port: 4242, storageDir: '/data', stopTimeoutMs: 0 }).ok).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSocket(): Record<string, unknown> {
    const emitter = new EventEmitter();
    return {
        pipe: vi.fn().mockReturnValue(emitter),
        unpipe: vi.fn(),
        resume: vi.fn(),
        pause: vi.fn(),
        destroy: vi.fn(),
        destroyed: false,
        on: emitter.on.bind(emitter),
        emit: emitter.emit.bind(emitter),
        removeListener: emitter.removeListener.bind(emitter),
    };
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
