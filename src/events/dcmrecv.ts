/**
 * Event patterns and types for dcmrecv output parsing.
 *
 * Defines regex patterns that match DCMTK dcmrecv verbose output,
 * along with typed event data interfaces for each event.
 *
 * @module events/dcmrecv
 */

import type { EventPattern } from '../parsers/EventPattern';

// ---------------------------------------------------------------------------
// Event constants (as const, not enum — Rule 3.5)
// ---------------------------------------------------------------------------

/** Events emitted by dcmrecv process output. */
const DcmrecvEvent = {
    LISTENING: 'LISTENING',
    ASSOCIATION_RECEIVED: 'ASSOCIATION_RECEIVED',
    ASSOCIATION_ACKNOWLEDGED: 'ASSOCIATION_ACKNOWLEDGED',
    C_STORE_REQUEST: 'C_STORE_REQUEST',
    STORED_FILE: 'STORED_FILE',
    ASSOCIATION_RELEASE: 'ASSOCIATION_RELEASE',
    ASSOCIATION_ABORTED: 'ASSOCIATION_ABORTED',
    ECHO_REQUEST: 'ECHO_REQUEST',
    CANNOT_START_LISTENER: 'CANNOT_START_LISTENER',
    REFUSING_ASSOCIATION: 'REFUSING_ASSOCIATION',
} as const;

type DcmrecvEventValue = (typeof DcmrecvEvent)[keyof typeof DcmrecvEvent];

// ---------------------------------------------------------------------------
// Event data interfaces (all readonly)
// ---------------------------------------------------------------------------

/** Data for ASSOCIATION_RECEIVED event. */
interface AssociationReceivedData {
    readonly address: string;
    readonly callingAE: string;
    readonly calledAE: string;
}

/** Data for ASSOCIATION_ACKNOWLEDGED event. */
interface AssociationAcknowledgedData {
    readonly maxSendPDV: number;
}

/** Data for C_STORE_REQUEST event. */
interface CStoreRequestData {
    readonly raw: string;
}

/** Data for STORED_FILE event. */
interface StoredFileData {
    readonly filePath: string;
}

/** Data for REFUSING_ASSOCIATION event. */
interface RefusingAssociationData {
    readonly reason: string;
}

/** Data for CANNOT_START_LISTENER event. */
interface CannotStartListenerData {
    readonly message: string;
}

// ---------------------------------------------------------------------------
// Regex patterns for dcmrecv verbose output
// ---------------------------------------------------------------------------

/** Event patterns for parsing dcmrecv verbose output. */
const DCMRECV_PATTERNS: readonly EventPattern[] = [
    {
        event: DcmrecvEvent.LISTENING,
        pattern: /listening/i,
        processor: () => undefined,
    },
    {
        event: DcmrecvEvent.ASSOCIATION_RECEIVED,
        pattern: /Association Received\s+(.+?):\s*"([^"]+)"\s*->\s*"([^"]+)"/,
        processor: (match): AssociationReceivedData => ({
            address: match[1] ?? '',
            callingAE: match[2] ?? '',
            calledAE: match[3] ?? '',
        }),
    },
    {
        event: DcmrecvEvent.ASSOCIATION_ACKNOWLEDGED,
        pattern: /Association Acknowledged \(Max Send PDV:\s*(\d+)\)/,
        processor: (match): AssociationAcknowledgedData => ({
            maxSendPDV: Number(match[1]),
        }),
    },
    {
        event: DcmrecvEvent.C_STORE_REQUEST,
        pattern: /Received Store Request/i,
        processor: (match): CStoreRequestData => ({
            raw: match[0] ?? '',
        }),
    },
    {
        event: DcmrecvEvent.STORED_FILE,
        pattern: /Stored received object to file:\s*(.+)/,
        processor: (match): StoredFileData => ({
            filePath: (match[1] ?? '').trim(),
        }),
    },
    {
        event: DcmrecvEvent.ASSOCIATION_RELEASE,
        pattern: /Received Association Release/i,
        processor: () => undefined,
    },
    {
        event: DcmrecvEvent.ASSOCIATION_ABORTED,
        pattern: /Received Association Abort/i,
        processor: () => undefined,
    },
    {
        event: DcmrecvEvent.ECHO_REQUEST,
        pattern: /Received C-ECHO Request/,
        processor: () => undefined,
    },
    {
        event: DcmrecvEvent.CANNOT_START_LISTENER,
        pattern: /cannot (?:start SCP and )?listen on port/i,
        processor: (match): CannotStartListenerData => ({
            message: match[0] ?? '',
        }),
    },
    {
        event: DcmrecvEvent.REFUSING_ASSOCIATION,
        pattern: /Refusing Association\s*\((.+)\)/,
        processor: (match): RefusingAssociationData => ({
            reason: match[1] ?? '',
        }),
    },
];

/** Events that indicate fatal errors (process should be stopped). */
const DCMRECV_FATAL_EVENTS: ReadonlySet<string> = new Set([DcmrecvEvent.CANNOT_START_LISTENER]);

export { DcmrecvEvent, DCMRECV_PATTERNS, DCMRECV_FATAL_EVENTS };
export type {
    DcmrecvEventValue,
    AssociationReceivedData,
    AssociationAcknowledgedData,
    CStoreRequestData,
    StoredFileData,
    RefusingAssociationData,
    CannotStartListenerData,
};
