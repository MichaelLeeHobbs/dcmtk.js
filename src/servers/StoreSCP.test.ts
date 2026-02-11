import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreSCP, StoreSCPPreset } from './StoreSCP';

vi.mock('../tools/_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { resolveBinary } from '../tools/_resolveBinary';

const mockedResolveBinary = vi.mocked(resolveBinary);

describe('StoreSCP', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/storescp' });
    });

    describe('create()', () => {
        it('returns ok with valid options', () => {
            const result = StoreSCP.create({ port: 11112 });

            expect(result.ok).toBe(true);
        });

        it('returns error for invalid port', () => {
            const result = StoreSCP.create({ port: 0 });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error for port out of range', () => {
            const result = StoreSCP.create({ port: 70000 });

            expect(result.ok).toBe(false);
        });

        it('returns error when binary not found', () => {
            mockedResolveBinary.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

            const result = StoreSCP.create({ port: 11112 });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DCMTK not found');
            }
        });

        it('rejects unknown options via strict schema', () => {
            const result = StoreSCP.create({ port: 11112, badOption: 42 } as never);

            expect(result.ok).toBe(false);
        });

        it('accepts all optional parameters', () => {
            const result = StoreSCP.create({
                port: 11112,
                aeTitle: 'STORESCP',
                outputDirectory: '/tmp/received',
                configFile: '/etc/storescp.cfg',
                configProfile: 'Default',
                sortByStudy: true,
                sortByStudyUID: true,
                sortByPatientName: true,
                uniqueFilenames: true,
                bitPreserving: true,
                execOnReception: 'echo #p',
                execOnEndOfStudy: 'echo done',
                endOfStudyTimeout: 30,
                renameOnEndOfStudy: true,
                socketTimeout: 60,
                acseTimeout: 30,
                dimseTimeout: 30,
                maxPdu: 16384,
                filenameExtension: '.dcm',
                startTimeoutMs: 5000,
                drainTimeoutMs: 3000,
            });

            expect(result.ok).toBe(true);
        });

        it('accepts little-endian transfer syntax', () => {
            const result = StoreSCP.create({
                port: 11112,
                preferredTransferSyntax: 'little-endian',
            });

            expect(result.ok).toBe(true);
        });

        it('accepts big-endian transfer syntax', () => {
            const result = StoreSCP.create({
                port: 11112,
                preferredTransferSyntax: 'big-endian',
            });

            expect(result.ok).toBe(true);
        });

        it('accepts implicit transfer syntax', () => {
            const result = StoreSCP.create({
                port: 11112,
                preferredTransferSyntax: 'implicit',
            });

            expect(result.ok).toBe(true);
        });

        it('rejects invalid maxPdu', () => {
            const result = StoreSCP.create({ port: 11112, maxPdu: 100 });

            expect(result.ok).toBe(false);
        });

        it('rejects aeTitle exceeding 16 characters', () => {
            const result = StoreSCP.create({ port: 11112, aeTitle: 'A'.repeat(17) });

            expect(result.ok).toBe(false);
        });

        it('accepts AbortSignal', () => {
            const controller = new AbortController();
            const result = StoreSCP.create({
                port: 11112,
                signal: controller.signal,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                result.value[Symbol.dispose]();
            }
        });

        it('handles already-aborted signal', () => {
            const controller = new AbortController();
            controller.abort();

            const result = StoreSCP.create({
                port: 11112,
                signal: controller.signal,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                result.value[Symbol.dispose]();
            }
        });
    });

    describe('StoreSCPPreset', () => {
        it('creates server with BASIC_STORAGE preset', () => {
            const result = StoreSCP.create({ ...StoreSCPPreset.BASIC_STORAGE, port: 11112 });
            expect(result.ok).toBe(true);
        });

        it('creates server with TESTING preset', () => {
            const result = StoreSCP.create({ ...StoreSCPPreset.TESTING, port: 11112 });
            expect(result.ok).toBe(true);
        });

        it('creates server with PRODUCTION preset', () => {
            const result = StoreSCP.create({ ...StoreSCPPreset.PRODUCTION, port: 11112 });
            expect(result.ok).toBe(true);
        });

        it('allows overriding preset values', () => {
            const result = StoreSCP.create({ ...StoreSCPPreset.PRODUCTION, port: 11112, acseTimeout: 60 });
            expect(result.ok).toBe(true);
        });
    });

    describe('event emission via parser', () => {
        it('emits STORED_FILE when parser matches stored file output', () => {
            const result = StoreSCP.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('STORED_FILE', spy);

            server.emit('line', { source: 'stderr', text: 'I: Stored received object to file: /tmp/image.dcm' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ filePath: '/tmp/image.dcm' });
            server[Symbol.dispose]();
        });

        it('emits STORING_FILE for storescp-specific output', () => {
            const result = StoreSCP.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('STORING_FILE', spy);

            server.emit('line', { source: 'stderr', text: 'I: storing DICOM file: /output/CT.1.2.3.dcm' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ filePath: '/output/CT.1.2.3.dcm' });
            server[Symbol.dispose]();
        });

        it('emits SUBDIRECTORY_CREATED for new subdirectory output', () => {
            const result = StoreSCP.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('SUBDIRECTORY_CREATED', spy);

            server.emit('line', { source: 'stderr', text: 'I: created new subdirectory: /output/2024-01-15' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ directory: '/output/2024-01-15' });
            server[Symbol.dispose]();
        });

        it('onAssociationReceived convenience method delegates to onEvent', () => {
            const result = StoreSCP.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onAssociationReceived(spy);

            server.emit('line', { source: 'stderr', text: 'I: Association Received 10.0.0.1: "SCU" -> "SCP"' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('onStoringFile convenience method delegates to onEvent', () => {
            const result = StoreSCP.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onStoringFile(spy);

            server.emit('line', { source: 'stderr', text: 'I: storing DICOM file: /output/CT.1.2.3.dcm' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ filePath: '/output/CT.1.2.3.dcm' });
            server[Symbol.dispose]();
        });

        it('emits error for fatal events', () => {
            const result = StoreSCP.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const errorSpy = vi.fn();
            server.removeAllListeners('error');
            server.on('error', errorSpy);

            server.emit('line', { source: 'stderr', text: 'E: cannot listen on port 11112' });

            expect(errorSpy).toHaveBeenCalled();
            const errorArg = errorSpy.mock.calls[0]?.[0] as { fatal: boolean };
            expect(errorArg.fatal).toBe(true);
            server[Symbol.dispose]();
        });

        it('emits ASSOCIATION_RECEIVED with parsed data', () => {
            const result = StoreSCP.create({ port: 11112 });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ASSOCIATION_RECEIVED', spy);

            server.emit('line', { source: 'stderr', text: 'I: Association Received 10.0.0.1: "SCU" -> "SCP"' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });
    });
});
