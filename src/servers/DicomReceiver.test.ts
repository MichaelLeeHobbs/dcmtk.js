import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { DicomReceiver } from './DicomReceiver';
import type {
    ReceiverFileData,
    ReceiverAssociationData,
    ReceiverErrorData,
    PoolAssociationReceivedData,
    PoolCStoreRequestData,
    PoolEchoRequestData,
    PoolRefusingAssociationData,
} from './DicomReceiver';
import { Dcmrecv } from './Dcmrecv';

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

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
    mkdir: vi.fn(() => Promise.resolve(undefined)),
    rename: vi.fn(() => Promise.resolve(undefined)),
    copyFile: vi.fn(() => Promise.resolve(undefined)),
    unlink: vi.fn(() => Promise.resolve(undefined)),
    rm: vi.fn(() => Promise.resolve(undefined)),
    stat: vi.fn(() => Promise.resolve({ size: 524288 })),
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
        it('emits FILE_RECEIVED when worker receives a file', async () => {
            const result = DicomReceiver.create({
                port: 4242,
                storageDir: '/data',
                minPoolSize: 1,
                maxPoolSize: 1,
            });
            if (!result.ok) return;

            const receiver = result.value;
            const fileEvents: ReceiverFileData[] = [];
            receiver.onFileReceived(data => fileEvents.push(data));

            await receiver.start();
            const worker = createdFakes[0];
            if (worker === undefined) return;

            // Trigger a connection to make worker busy
            if (connectionHandler !== undefined) {
                connectionHandler(createMockSocket());
                await delay(50);
            }

            // Simulate FILE_RECEIVED from the worker dcmrecv
            worker.emit('FILE_RECEIVED', {
                filePath: '/tmp/dcmrecv-pool-50001-1234/file1.dcm',
                associationId: 'assoc-1',
                callingAE: 'SCU1',
                calledAE: 'DCMRECV',
                source: '192.168.1.1:5000',
            });

            // Wait for async file move
            await delay(50);

            expect(fileEvents).toHaveLength(1);
            expect(fileEvents[0]?.associationId).toBe('assoc-1');
            expect(fileEvents[0]?.callingAE).toBe('SCU1');
            expect(fileEvents[0]?.instance).toBe(mockDicomInstance);

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

        it('emits error (not FILE_RECEIVED) when DicomInstance.open fails', async () => {
            mockOpen.mockResolvedValueOnce({ ok: false, error: new Error('Failed to parse DICOM') });

            const result = DicomReceiver.create({ port: 4242, storageDir: '/data', minPoolSize: 1, maxPoolSize: 1 });
            if (!result.ok) return;

            const receiver = result.value;
            const fileEvents: ReceiverFileData[] = [];
            const errorEvents: ReceiverErrorData[] = [];
            receiver.onFileReceived(data => fileEvents.push(data));
            receiver.onEvent('error', data => errorEvents.push(data));

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
            await delay(50);

            expect(fileEvents).toHaveLength(0);
            const fileError = errorEvents.find(e => e.filePath !== undefined);
            expect(fileError).toBeDefined();
            expect(fileError?.error.message).toBe('Failed to parse DICOM');
            expect(fileError?.associationId).toBe('assoc-1');

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
