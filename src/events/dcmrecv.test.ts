import { describe, it, expect } from 'vitest';
import { DcmrecvEvent, DCMRECV_PATTERNS, DCMRECV_FATAL_EVENTS } from './dcmrecv';
import { LineParser } from '../parsers/LineParser';

describe('DcmrecvEvent constants', () => {
    it('has expected event names', () => {
        expect(DcmrecvEvent.LISTENING).toBe('LISTENING');
        expect(DcmrecvEvent.ASSOCIATION_RECEIVED).toBe('ASSOCIATION_RECEIVED');
        expect(DcmrecvEvent.STORED_FILE).toBe('STORED_FILE');
        expect(DcmrecvEvent.CANNOT_START_LISTENER).toBe('CANNOT_START_LISTENER');
    });

    it('has all expected events', () => {
        expect(Object.keys(DcmrecvEvent)).toHaveLength(10);
    });
});

describe('DCMRECV_FATAL_EVENTS', () => {
    it('contains CANNOT_START_LISTENER', () => {
        expect(DCMRECV_FATAL_EVENTS.has(DcmrecvEvent.CANNOT_START_LISTENER)).toBe(true);
    });

    it('does not contain non-fatal events', () => {
        expect(DCMRECV_FATAL_EVENTS.has(DcmrecvEvent.LISTENING)).toBe(false);
        expect(DCMRECV_FATAL_EVENTS.has(DcmrecvEvent.STORED_FILE)).toBe(false);
    });
});

describe('DCMRECV_PATTERNS with LineParser', () => {
    function createParser() {
        const parser = new LineParser();
        for (const pattern of DCMRECV_PATTERNS) {
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
        expect(events[0]?.event).toBe(DcmrecvEvent.LISTENING);
    });

    it('matches ASSOCIATION_RECEIVED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Received 192.168.1.100: "STORESCU" -> "DCMRECV"');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.ASSOCIATION_RECEIVED);
        const data = events[0]?.data as { address: string; callingAE: string; calledAE: string };
        expect(data.address).toBe('192.168.1.100');
        expect(data.callingAE).toBe('STORESCU');
        expect(data.calledAE).toBe('DCMRECV');
    });

    it('matches ASSOCIATION_ACKNOWLEDGED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Acknowledged (Max Send PDV: 16372)');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.ASSOCIATION_ACKNOWLEDGED);
        const data = events[0]?.data as { maxSendPDV: number };
        expect(data.maxSendPDV).toBe(16372);
    });

    it('matches C_STORE_REQUEST pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Store Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.C_STORE_REQUEST);
    });

    it('matches STORED_FILE pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Stored received object to file: /tmp/dcmrecv/image001.dcm');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.STORED_FILE);
        const data = events[0]?.data as { filePath: string };
        expect(data.filePath).toBe('/tmp/dcmrecv/image001.dcm');
    });

    it('matches ASSOCIATION_RELEASE pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Association Release');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.ASSOCIATION_RELEASE);
    });

    it('matches ASSOCIATION_ABORTED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Association Abort');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.ASSOCIATION_ABORTED);
    });

    it('matches ECHO_REQUEST pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received C-ECHO Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.ECHO_REQUEST);
    });

    it('matches CANNOT_START_LISTENER pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('E: cannot listen on port 11112');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.CANNOT_START_LISTENER);
        const data = events[0]?.data as { message: string };
        expect(data.message).toContain('cannot listen on port');
    });

    it('matches CANNOT_START_LISTENER with SCP prefix', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('E: cannot start SCP and listen on port 104');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.CANNOT_START_LISTENER);
    });

    it('matches REFUSING_ASSOCIATION pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Refusing Association (bad application context name)');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmrecvEvent.REFUSING_ASSOCIATION);
        const data = events[0]?.data as { reason: string };
        expect(data.reason).toBe('bad application context name');
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
        expect(DCMRECV_PATTERNS.length).toBe(10);
    });
});
