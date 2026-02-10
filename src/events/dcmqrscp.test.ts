import { describe, it, expect } from 'vitest';
import { DcmqrscpEvent, DCMQRSCP_PATTERNS, DCMQRSCP_FATAL_EVENTS } from './dcmqrscp';
import { LineParser } from '../parsers/LineParser';

describe('DcmqrscpEvent constants', () => {
    it('has expected event names', () => {
        expect(DcmqrscpEvent.LISTENING).toBe('LISTENING');
        expect(DcmqrscpEvent.ASSOCIATION_RECEIVED).toBe('ASSOCIATION_RECEIVED');
        expect(DcmqrscpEvent.ASSOCIATION_ACKNOWLEDGED).toBe('ASSOCIATION_ACKNOWLEDGED');
        expect(DcmqrscpEvent.C_FIND_REQUEST).toBe('C_FIND_REQUEST');
        expect(DcmqrscpEvent.C_MOVE_REQUEST).toBe('C_MOVE_REQUEST');
        expect(DcmqrscpEvent.C_GET_REQUEST).toBe('C_GET_REQUEST');
        expect(DcmqrscpEvent.C_STORE_REQUEST).toBe('C_STORE_REQUEST');
        expect(DcmqrscpEvent.ASSOCIATION_RELEASE).toBe('ASSOCIATION_RELEASE');
        expect(DcmqrscpEvent.ASSOCIATION_ABORTED).toBe('ASSOCIATION_ABORTED');
        expect(DcmqrscpEvent.CANNOT_START_LISTENER).toBe('CANNOT_START_LISTENER');
    });

    it('has all expected events', () => {
        expect(Object.keys(DcmqrscpEvent)).toHaveLength(10);
    });
});

describe('DCMQRSCP_FATAL_EVENTS', () => {
    it('contains CANNOT_START_LISTENER', () => {
        expect(DCMQRSCP_FATAL_EVENTS.has(DcmqrscpEvent.CANNOT_START_LISTENER)).toBe(true);
    });

    it('does not contain non-fatal events', () => {
        expect(DCMQRSCP_FATAL_EVENTS.has(DcmqrscpEvent.LISTENING)).toBe(false);
        expect(DCMQRSCP_FATAL_EVENTS.has(DcmqrscpEvent.ASSOCIATION_RELEASE)).toBe(false);
    });
});

describe('DCMQRSCP_PATTERNS with LineParser', () => {
    function createParser() {
        const parser = new LineParser();
        for (const pattern of DCMQRSCP_PATTERNS) {
            parser.addPattern(pattern);
        }
        return parser;
    }

    it('matches LISTENING pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: listening on port 11112');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.LISTENING);
        const data = events[0]?.data as { port: number };
        expect(data.port).toBe(11112);
    });

    it('matches ASSOCIATION_RECEIVED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Received (192.168.1.50:FINDSCU -> QRSCP)');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.ASSOCIATION_RECEIVED);
        const data = events[0]?.data as { peerInfo: string };
        expect(data.peerInfo).toContain('192.168.1.50');
    });

    it('matches ASSOCIATION_ACKNOWLEDGED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Acknowledged (Max Send PDV: 16372)');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.ASSOCIATION_ACKNOWLEDGED);
        const data = events[0]?.data as { maxSendPDV: number };
        expect(data.maxSendPDV).toBe(16372);
    });

    it('matches C_FIND_REQUEST pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Find SCP Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.C_FIND_REQUEST);
    });

    it('matches C_MOVE_REQUEST pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Move SCP Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.C_MOVE_REQUEST);
    });

    it('matches C_GET_REQUEST pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Get SCP Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.C_GET_REQUEST);
    });

    it('matches C_STORE_REQUEST pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Store SCP Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.C_STORE_REQUEST);
    });

    it('matches ASSOCIATION_RELEASE pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Release');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.ASSOCIATION_RELEASE);
    });

    it('matches ASSOCIATION_ABORTED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Abort');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.ASSOCIATION_ABORTED);
    });

    it('matches CANNOT_START_LISTENER with listen failure', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: cannot listen on port 11112');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.CANNOT_START_LISTENER);
        const data = events[0]?.data as { message: string };
        expect(data.message).toContain('cannot listen');
    });

    it('matches CANNOT_START_LISTENER with network init failure', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: cannot initialise network');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmqrscpEvent.CANNOT_START_LISTENER);
    });

    it('does not match unrelated output', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('D: some debug output');
        parser.feed('');
        parser.feed('random text');

        expect(events).toHaveLength(0);
    });

    it('registers all patterns without exceeding limit', () => {
        expect(DCMQRSCP_PATTERNS.length).toBe(10);
    });
});
