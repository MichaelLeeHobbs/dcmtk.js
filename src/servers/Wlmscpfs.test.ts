import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Wlmscpfs } from './Wlmscpfs';

vi.mock('../tools/_resolveBinary', () => ({
    resolveBinary: vi.fn(),
}));

import { resolveBinary } from '../tools/_resolveBinary';

const mockedResolveBinary = vi.mocked(resolveBinary);

describe('Wlmscpfs', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockedResolveBinary.mockReturnValue({ ok: true, value: '/usr/local/bin/wlmscpfs' });
    });

    describe('create()', () => {
        it('returns ok with valid options', () => {
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });

            expect(result.ok).toBe(true);
        });

        it('returns error for missing worklistDirectory', () => {
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error for invalid port', () => {
            const result = Wlmscpfs.create({ port: 0, worklistDirectory: '/var/worklists' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('returns error when binary not found', () => {
            mockedResolveBinary.mockReturnValue({ ok: false, error: new Error('DCMTK not found') });

            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toBe('DCMTK not found');
            }
        });

        it('rejects unknown options via strict schema', () => {
            const result = Wlmscpfs.create({
                port: 2005,
                worklistDirectory: '/var/worklists',
                unknownOption: true,
            } as never);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.message).toContain('invalid options');
            }
        });

        it('accepts all optional parameters', () => {
            const result = Wlmscpfs.create({
                port: 2005,
                worklistDirectory: '/var/worklists',
                enableFileRejection: true,
                maxPdu: 65536,
                acseTimeout: 30,
                dimseTimeout: 30,
                maxAssociations: 10,
                verbose: true,
                startTimeoutMs: 5000,
                drainTimeoutMs: 3000,
            });

            expect(result.ok).toBe(true);
        });

        it('accepts enableFileRejection as false', () => {
            const result = Wlmscpfs.create({
                port: 2005,
                worklistDirectory: '/var/worklists',
                enableFileRejection: false,
            });

            expect(result.ok).toBe(true);
        });

        it('accepts AbortSignal', () => {
            const controller = new AbortController();
            const result = Wlmscpfs.create({
                port: 2005,
                worklistDirectory: '/var/worklists',
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

            const result = Wlmscpfs.create({
                port: 2005,
                worklistDirectory: '/var/worklists',
                signal: controller.signal,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                result.value[Symbol.dispose]();
            }
        });

        it('omits --verbose when verbose is false', () => {
            const result = Wlmscpfs.create({
                port: 2005,
                worklistDirectory: '/var/worklists',
                verbose: false,
            });

            expect(result.ok).toBe(true);
        });
    });

    describe('event emission via parser', () => {
        it('emits LISTENING when parser matches listening output', () => {
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('LISTENING', spy);

            server.emit('line', { source: 'stderr', text: 'I: listening on port 2005' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ port: 2005 });
            server[Symbol.dispose]();
        });

        it('emits C_FIND_REQUEST with parsed data', () => {
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('C_FIND_REQUEST', spy);

            server.emit('line', { source: 'stderr', text: 'I: Received C-FIND Request' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('onCFindRequest convenience method delegates to onEvent', () => {
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onCFindRequest(spy);

            server.emit('line', { source: 'stderr', text: 'I: Received C-FIND Request' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('onListening convenience method delegates to onEvent', () => {
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onListening(spy);

            server.emit('line', { source: 'stderr', text: 'I: listening on port 2005' });

            expect(spy).toHaveBeenCalledOnce();
            expect(spy).toHaveBeenCalledWith({ port: 2005 });
            server[Symbol.dispose]();
        });

        it('emits ECHO_REQUEST', () => {
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const spy = vi.fn();
            server.onEvent('ECHO_REQUEST', spy);

            server.emit('line', { source: 'stderr', text: 'I: Received Echo Request' });

            expect(spy).toHaveBeenCalledOnce();
            server[Symbol.dispose]();
        });

        it('emits ASSOCIATION_RELEASE', () => {
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });
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
            const result = Wlmscpfs.create({ port: 2005, worklistDirectory: '/var/worklists' });
            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const server = result.value;
            const errorSpy = vi.fn();
            server.removeAllListeners('error');
            server.on('error', errorSpy);

            server.emit('line', { source: 'stderr', text: 'F: cannot listen on port 2005' });

            expect(errorSpy).toHaveBeenCalled();
            const errorArg = errorSpy.mock.calls[0]?.[0] as { fatal: boolean };
            expect(errorArg.fatal).toBe(true);
            server[Symbol.dispose]();
        });
    });
});
