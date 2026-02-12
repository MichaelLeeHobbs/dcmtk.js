import { describe, it, expect } from 'vitest';
import { WlmscpfsEvent, WLMSCPFS_PATTERNS, WLMSCPFS_FATAL_EVENTS } from './wlmscpfs';
import { LineParser } from '../parsers/LineParser';

describe('WlmscpfsEvent constants', () => {
    it('has expected event names', () => {
        expect(WlmscpfsEvent.LISTENING).toBe('LISTENING');
        expect(WlmscpfsEvent.ASSOCIATION_RECEIVED).toBe('ASSOCIATION_RECEIVED');
        expect(WlmscpfsEvent.ASSOCIATION_ACKNOWLEDGED).toBe('ASSOCIATION_ACKNOWLEDGED');
        expect(WlmscpfsEvent.C_FIND_REQUEST).toBe('C_FIND_REQUEST');
        expect(WlmscpfsEvent.ASSOCIATION_RELEASE).toBe('ASSOCIATION_RELEASE');
        expect(WlmscpfsEvent.ASSOCIATION_ABORTED).toBe('ASSOCIATION_ABORTED');
        expect(WlmscpfsEvent.ECHO_REQUEST).toBe('ECHO_REQUEST');
        expect(WlmscpfsEvent.CANNOT_START_LISTENER).toBe('CANNOT_START_LISTENER');
    });

    it('has all expected events', () => {
        expect(Object.keys(WlmscpfsEvent)).toHaveLength(8);
    });
});

describe('WLMSCPFS_FATAL_EVENTS', () => {
    it('contains CANNOT_START_LISTENER', () => {
        expect(WLMSCPFS_FATAL_EVENTS.has(WlmscpfsEvent.CANNOT_START_LISTENER)).toBe(true);
    });

    it('does not contain non-fatal events', () => {
        expect(WLMSCPFS_FATAL_EVENTS.has(WlmscpfsEvent.LISTENING)).toBe(false);
        expect(WLMSCPFS_FATAL_EVENTS.has(WlmscpfsEvent.ASSOCIATION_RELEASE)).toBe(false);
    });
});

describe('WLMSCPFS_PATTERNS with LineParser', () => {
    function createParser() {
        const parser = new LineParser();
        for (const pattern of WLMSCPFS_PATTERNS) {
            parser.addPattern(pattern);
        }
        return parser;
    }

    it('matches LISTENING pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: listening on port 2005');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.LISTENING);
        const data = events[0]?.data as { port: number };
        expect(data.port).toBe(2005);
    });

    it('matches ASSOCIATION_RECEIVED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Received (192.168.1.50:WORKLIST_SCU -> WLM_SCP)');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.ASSOCIATION_RECEIVED);
        const data = events[0]?.data as { peerInfo: string };
        expect(data.peerInfo).toContain('192.168.1.50');
    });

    it('matches ASSOCIATION_ACKNOWLEDGED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Acknowledged (Max Send PDV: 16372)');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.ASSOCIATION_ACKNOWLEDGED);
        const data = events[0]?.data as { maxSendPDV: number };
        expect(data.maxSendPDV).toBe(16372);
    });

    it('matches C_FIND_REQUEST with "Find Request" format', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Find Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.C_FIND_REQUEST);
    });

    it('matches C_FIND_REQUEST with "C-FIND Request" format', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received C-FIND Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.C_FIND_REQUEST);
    });

    it('matches ASSOCIATION_RELEASE pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Release');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.ASSOCIATION_RELEASE);
    });

    it('matches ASSOCIATION_ABORTED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Association Abort');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.ASSOCIATION_ABORTED);
    });

    it('matches ECHO_REQUEST with "Echo Request" format', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received Echo Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.ECHO_REQUEST);
    });

    it('matches ECHO_REQUEST with "C-ECHO Request" format', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Received C-ECHO Request');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.ECHO_REQUEST);
    });

    it('matches CANNOT_START_LISTENER pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('F: cannot listen on port 2005');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(WlmscpfsEvent.CANNOT_START_LISTENER);
        const data = events[0]?.data as { message: string };
        expect(data.message).toMatch(/cannot listen/);
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
        expect(WLMSCPFS_PATTERNS.length).toBe(8);
    });
});
