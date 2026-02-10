import { describe, it, expect } from 'vitest';
import { DcmpsrcvEvent, DCMPSRCV_PATTERNS, DCMPSRCV_FATAL_EVENTS } from './dcmpsrcv';
import { LineParser } from '../parsers/LineParser';

describe('DcmpsrcvEvent constants', () => {
    it('has expected event names', () => {
        expect(DcmpsrcvEvent.LISTENING).toBe('LISTENING');
        expect(DcmpsrcvEvent.DATABASE_READY).toBe('DATABASE_READY');
        expect(DcmpsrcvEvent.ASSOCIATION_RECEIVED).toBe('ASSOCIATION_RECEIVED');
        expect(DcmpsrcvEvent.ECHO_REQUEST).toBe('ECHO_REQUEST');
        expect(DcmpsrcvEvent.C_STORE_REQUEST).toBe('C_STORE_REQUEST');
        expect(DcmpsrcvEvent.FILE_DELETED).toBe('FILE_DELETED');
        expect(DcmpsrcvEvent.CANNOT_START_LISTENER).toBe('CANNOT_START_LISTENER');
        expect(DcmpsrcvEvent.CONFIG_ERROR).toBe('CONFIG_ERROR');
        expect(DcmpsrcvEvent.TERMINATING).toBe('TERMINATING');
    });

    it('has all expected events', () => {
        expect(Object.keys(DcmpsrcvEvent)).toHaveLength(12);
    });
});

describe('DCMPSRCV_FATAL_EVENTS', () => {
    it('contains CANNOT_START_LISTENER', () => {
        expect(DCMPSRCV_FATAL_EVENTS.has(DcmpsrcvEvent.CANNOT_START_LISTENER)).toBe(true);
    });

    it('contains CONFIG_ERROR', () => {
        expect(DCMPSRCV_FATAL_EVENTS.has(DcmpsrcvEvent.CONFIG_ERROR)).toBe(true);
    });

    it('does not contain non-fatal events', () => {
        expect(DCMPSRCV_FATAL_EVENTS.has(DcmpsrcvEvent.LISTENING)).toBe(false);
        expect(DCMPSRCV_FATAL_EVENTS.has(DcmpsrcvEvent.ASSOCIATION_RELEASE)).toBe(false);
        expect(DCMPSRCV_FATAL_EVENTS.has(DcmpsrcvEvent.TERMINATING)).toBe(false);
    });
});

describe('DCMPSRCV_PATTERNS with LineParser', () => {
    function createParser() {
        const parser = new LineParser();
        for (const pattern of DCMPSRCV_PATTERNS) {
            parser.addPattern(pattern);
        }
        return parser;
    }

    it('matches LISTENING pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Receiver STORESCP1 on port 10004');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.LISTENING);
        const data = events[0]?.data as { receiverId: string; port: number };
        expect(data.receiverId).toBe('STORESCP1');
        expect(data.port).toBe(10004);
    });

    it('matches LISTENING pattern with TLS', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Receiver STORESCP2 on port 10007 with TLS');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.LISTENING);
        const data = events[0]?.data as { receiverId: string; port: number };
        expect(data.receiverId).toBe('STORESCP2');
        expect(data.port).toBe(10007);
    });

    it('matches DATABASE_READY pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed("I: Using database in directory '/var/lib/dcmtk/database'");

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.DATABASE_READY);
        const data = events[0]?.data as { directory: string };
        expect(data.directory).toBe('/var/lib/dcmtk/database');
    });

    it('matches ASSOCIATION_RECEIVED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Received ("192.168.1.100:STORESCU -> STORESCP1")');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.ASSOCIATION_RECEIVED);
        const data = events[0]?.data as { peerInfo: string };
        expect(data.peerInfo).toBe('"192.168.1.100:STORESCU -> STORESCP1"');
    });

    it('matches ASSOCIATION_ACKNOWLEDGED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Acknowledged (Max Send PDV: 32756)');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.ASSOCIATION_ACKNOWLEDGED);
        const data = events[0]?.data as { maxSendPDV: number };
        expect(data.maxSendPDV).toBe(32756);
    });

    it('matches ECHO_REQUEST pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Echo SCP RQ: MsgID 1');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.ECHO_REQUEST);
        const data = events[0]?.data as { messageId: number };
        expect(data.messageId).toBe(1);
    });

    it('matches C_STORE_REQUEST pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Store SCP:');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.C_STORE_REQUEST);
    });

    it('matches FILE_DELETED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Store SCP: Deleting Image File: /tmp/rejected.dcm');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.FILE_DELETED);
        const data = events[0]?.data as { filePath: string };
        expect(data.filePath).toBe('/tmp/rejected.dcm');
    });

    it('matches ASSOCIATION_RELEASE pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Release');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.ASSOCIATION_RELEASE);
    });

    it('matches ASSOCIATION_ABORTED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Aborted');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.ASSOCIATION_ABORTED);
    });

    it('matches CANNOT_START_LISTENER pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: cannot listen on port 10004, insufficient privileges');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.CANNOT_START_LISTENER);
        const data = events[0]?.data as { message: string };
        expect(data.message).toContain('cannot listen on port');
    });

    it('matches CONFIG_ERROR with missing config file', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed("F: can't open configuration file '/etc/dcmpstat.cfg'");

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.CONFIG_ERROR);
    });

    it('matches CONFIG_ERROR with missing config file name', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: missing configuration file name');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.CONFIG_ERROR);
    });

    it('matches CONFIG_ERROR with no AE title', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: no application entity title');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.CONFIG_ERROR);
    });

    it('matches CONFIG_ERROR with invalid port', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: no or invalid port number');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.CONFIG_ERROR);
    });

    it('matches TERMINATING pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Terminating all receivers');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmpsrcvEvent.TERMINATING);
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
        expect(DCMPSRCV_PATTERNS.length).toBe(12);
    });
});
