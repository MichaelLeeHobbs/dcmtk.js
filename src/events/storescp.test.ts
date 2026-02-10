import { describe, it, expect } from 'vitest';
import { StorescpEvent, STORESCP_PATTERNS, STORESCP_FATAL_EVENTS } from './storescp';
import { DcmrecvEvent } from './dcmrecv';
import { LineParser } from '../parsers/LineParser';

describe('StorescpEvent constants', () => {
    it('includes all dcmrecv events', () => {
        for (const key of Object.keys(DcmrecvEvent)) {
            expect(StorescpEvent).toHaveProperty(key);
        }
    });

    it('has additional storescp-specific events', () => {
        expect(StorescpEvent.STORING_FILE).toBe('STORING_FILE');
        expect(StorescpEvent.SUBDIRECTORY_CREATED).toBe('SUBDIRECTORY_CREATED');
    });

    it('has all expected events (dcmrecv + storescp-specific)', () => {
        expect(Object.keys(StorescpEvent)).toHaveLength(12);
    });
});

describe('STORESCP_FATAL_EVENTS', () => {
    it('contains CANNOT_START_LISTENER', () => {
        expect(STORESCP_FATAL_EVENTS.has(StorescpEvent.CANNOT_START_LISTENER)).toBe(true);
    });
});

describe('STORESCP_PATTERNS with LineParser', () => {
    function createParser() {
        const parser = new LineParser();
        for (const pattern of STORESCP_PATTERNS) {
            parser.addPattern(pattern);
        }
        return parser;
    }

    it('matches inherited LISTENING pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: listening on port 11112');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(StorescpEvent.LISTENING);
    });

    it('matches inherited STORED_FILE pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: Stored received object to file: /output/study/image.dcm');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(StorescpEvent.STORED_FILE);
    });

    it('matches STORING_FILE pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: storing DICOM file: /output/CT.1.2.3.dcm');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(StorescpEvent.STORING_FILE);
        const data = events[0]?.data as { filePath: string };
        expect(data.filePath).toBe('/output/CT.1.2.3.dcm');
    });

    it('matches SUBDIRECTORY_CREATED pattern', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('I: created new subdirectory: /output/2024-01-15');

        expect(events).toHaveLength(1);
        expect(events[0]?.event).toBe(StorescpEvent.SUBDIRECTORY_CREATED);
        const data = events[0]?.data as { directory: string };
        expect(data.directory).toBe('/output/2024-01-15');
    });

    it('includes all dcmrecv patterns plus storescp-specific ones', () => {
        expect(STORESCP_PATTERNS.length).toBe(12);
    });

    it('does not match unrelated output', () => {
        const parser = createParser();
        const events: Array<{ event: string; data: unknown }> = [];
        parser.on('match', evt => events.push(evt));

        parser.feed('D: debug information');
        parser.feed('some unrelated output');

        expect(events).toHaveLength(0);
    });
});
