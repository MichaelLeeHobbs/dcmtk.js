import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DcmQRSCP } from './DcmQRSCP';

vi.mock('../tools/_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { resolveBinary } from '../tools/_resolveBinary';

const mockedResolveBinary = vi.mocked(resolveBinary);

describe('DcmQRSCP', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/dcmqrscp' });
    });

    describe('create()', () => {
        it('returns ok with valid options', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg' });

            expect(result.ok).toBe(true);
        });

        it('returns ok with port specified', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg', port: 11112 });

            expect(result.ok).toBe(true);
        });

        it('returns error for empty configFile', () => {
            const result = DcmQRSCP.create({ configFile: '' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error when binary not found', () => {
            mockedResolveBinary.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DCMTK not found');
            }
        });

        it('rejects unknown options via strict schema', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg', unknownOption: true } as never);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('accepts all optional parameters', () => {
            const result = DcmQRSCP.create({
                configFile: '/etc/dcmqrscp.cfg',
                port: 11112,
                singleProcess: true,
                checkFind: true,
                checkMove: true,
                disableGet: true,
                maxPdu: 65536,
                acseTimeout: 30,
                dimseTimeout: 30,
                verbose: true,
                startTimeoutMs: 5000,
                drainTimeoutMs: 3000,
            });

            expect(result.ok).toBe(true);
        });

        it('rejects invalid port', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg', port: 70000 });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('rejects invalid maxPdu', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg', maxPdu: 100 });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('accepts AbortSignal', () => {
            const controller = new AbortController();
            const result = DcmQRSCP.create({
                configFile: '/etc/dcmqrscp.cfg',
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

            const result = DcmQRSCP.create({
                configFile: '/etc/dcmqrscp.cfg',
                signal: controller.signal,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                result.value[Symbol.dispose]();
            }
        });

        it('omits --verbose when verbose is false', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg', verbose: false });

            expect(result.ok).toBe(true);
        });
    });

    describe('event emission via parser', () => {
        it('emits LISTENING when parser matches listening output', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('LISTENING', spy);

            server.emit('line', { source: 'stderr', text: 'I: listening on port 11112' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ port: 11112 });
            server[Symbol.dispose]();
        });

        it('emits C_FIND_REQUEST with parsed data', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('C_FIND_REQUEST', spy);

            server.emit('line', { source: 'stderr', text: 'I: Received Find SCP Request' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits C_MOVE_REQUEST with parsed data', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('C_MOVE_REQUEST', spy);

            server.emit('line', { source: 'stderr', text: 'I: Received Move SCP Request' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits ASSOCIATION_ACKNOWLEDGED with maxSendPDV', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ASSOCIATION_ACKNOWLEDGED', spy);

            server.emit('line', { source: 'stderr', text: 'I: Association Acknowledged (Max Send PDV: 16372)' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ maxSendPDV: 16372 });
            server[Symbol.dispose]();
        });

        it('emits ASSOCIATION_RELEASE', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ASSOCIATION_RELEASE', spy);

            server.emit('line', { source: 'stderr', text: 'I: Association Release' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits error for fatal CANNOT_START_LISTENER events', () => {
            const result = DcmQRSCP.create({ configFile: '/etc/dcmqrscp.cfg' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const errorSpy = vi.fn();
            server.removeAllListeners('error');
            server.on('error', errorSpy);

            server.emit('line', { source: 'stderr', text: 'F: cannot listen on port 11112' });

            expect(errorSpy).toHaveBeenCalled();
            const errorArg = errorSpy.mock.calls[0]?.[0] as { fatal: boolean };
            expect(errorArg.fatal).toBe(true);
            server[Symbol.dispose]();
        });
    });
});
