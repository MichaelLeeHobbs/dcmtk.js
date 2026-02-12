import { describe, it, expect } from 'vitest';
import { DcmprscpEvent, DCMPRSCP_PATTERNS, DCMPRSCP_FATAL_EVENTS } from './dcmprscp';
import { LineParser } from '../parsers/LineParser';

describe('DcmprscpEvent constants', () => {
    it('has expected event names', () => {
        expect(DcmprscpEvent.DATABASE_READY).toBe('DATABASE_READY');
        expect(DcmprscpEvent.ASSOCIATION_RECEIVED).toBe('ASSOCIATION_RECEIVED');
        expect(DcmprscpEvent.ASSOCIATION_ACKNOWLEDGED).toBe('ASSOCIATION_ACKNOWLEDGED');
        expect(DcmprscpEvent.ASSOCIATION_RELEASE).toBe('ASSOCIATION_RELEASE');
        expect(DcmprscpEvent.ASSOCIATION_ABORTED).toBe('ASSOCIATION_ABORTED');
        expect(DcmprscpEvent.CANNOT_START_LISTENER).toBe('CANNOT_START_LISTENER');
        expect(DcmprscpEvent.CONFIG_ERROR).toBe('CONFIG_ERROR');
    });

    it('has all expected events', () => {
        expect(Object.keys(DcmprscpEvent)).toHaveLength(7);
    });
});

describe('DCMPRSCP_FATAL_EVENTS', () => {
    it('contains CANNOT_START_LISTENER', () => {
        expect(DCMPRSCP_FATAL_EVENTS.has(DcmprscpEvent.CANNOT_START_LISTENER)).toBe(true);
    });

    it('contains CONFIG_ERROR', () => {
        expect(DCMPRSCP_FATAL_EVENTS.has(DcmprscpEvent.CONFIG_ERROR)).toBe(true);
    });

    it('does not contain non-fatal events', () => {
        expect(DCMPRSCP_FATAL_EVENTS.has(DcmprscpEvent.DATABASE_READY)).toBe(false);
        expect(DCMPRSCP_FATAL_EVENTS.has(DcmprscpEvent.ASSOCIATION_RELEASE)).toBe(false);
    });
});

describe('DCMPRSCP_PATTERNS with LineParser', () => {
    function createParser() {
        const parser = new LineParser();
        for (const pattern of DCMPRSCP_PATTERNS) {
            parser.addPattern(pattern);
        }
        return parser;
    }

    it('matches DATABASE_READY pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed("I: Using database in directory '/var/lib/dcmtk/database'");

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.DATABASE_READY);
        const data = events[0]?.data as { directory: string };
        expect(data.directory).toBe('/var/lib/dcmtk/database');
    });

    it('matches ASSOCIATION_RECEIVED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Received ("192.168.1.50:PRINTSCU -> IHEFULL")');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.ASSOCIATION_RECEIVED);
        const data = events[0]?.data as { peerInfo: string };
        expect(data.peerInfo).toBe('"192.168.1.50:PRINTSCU -> IHEFULL"');
    });

    it('matches ASSOCIATION_ACKNOWLEDGED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Acknowledged (Max Send PDV: 16372)');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.ASSOCIATION_ACKNOWLEDGED);
        const data = events[0]?.data as { maxSendPDV: number };
        expect(data.maxSendPDV).toBe(16372);
    });

    it('matches ASSOCIATION_RELEASE pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Release');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.ASSOCIATION_RELEASE);
    });

    it('matches ASSOCIATION_ABORTED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Abort');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.ASSOCIATION_ABORTED);
    });

    it('matches CANNOT_START_LISTENER with network init failure', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: cannot initialise network');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.CANNOT_START_LISTENER);
        const data = events[0]?.data as { message: string };
        expect(data.message).toMatch(/cannot initialise network/);
    });

    it('matches CANNOT_START_LISTENER with listen failure', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: cannot listen on port 10005');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.CANNOT_START_LISTENER);
    });

    it('matches CONFIG_ERROR with missing config file', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed("F: can't open configuration file '/etc/dcmpstat.cfg'");

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.CONFIG_ERROR);
        const data = events[0]?.data as { message: string };
        expect(data.message).toMatch(/can't open configuration file/);
    });

    it('matches CONFIG_ERROR with missing print SCP definition', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed("F: no print scp definition for 'MYPRINTER' found in config file");

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.CONFIG_ERROR);
    });

    it('matches CONFIG_ERROR with no default print SCP', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: no default print scp available - no config file?');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(DcmprscpEvent.CONFIG_ERROR);
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
        expect(DCMPRSCP_PATTERNS.length).toBe(7);
    });
});
