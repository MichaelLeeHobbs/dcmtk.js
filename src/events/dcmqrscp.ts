/**
 * Event patterns and types for dcmqrscp output parsing.
 *
 * Defines regex patterns that match DCMTK dcmqrscp (Query/Retrieve SCP)
 * verbose output, along with typed event data interfaces for each event.
 *
 * @module events/dcmqrscp
 */

import type { EventPattern } from '../parsers/EventPattern';

// ---------------------------------------------------------------------------
// Event constants (as const, not enum — Rule 3.5)
// ---------------------------------------------------------------------------

/** Events emitted by dcmqrscp process output. */
const DcmqrscpEvent = {
    LISTENING: 'LISTENING',
    ASSOCIATION_RECEIVED: 'ASSOCIATION_RECEIVED',
    ASSOCIATION_ACKNOWLEDGED: 'ASSOCIATION_ACKNOWLEDGED',
    C_FIND_REQUEST: 'C_FIND_REQUEST',
    C_MOVE_REQUEST: 'C_MOVE_REQUEST',
    C_GET_REQUEST: 'C_GET_REQUEST',
    C_STORE_REQUEST: 'C_STORE_REQUEST',
    ASSOCIATION_RELEASE: 'ASSOCIATION_RELEASE',
    ASSOCIATION_ABORTED: 'ASSOCIATION_ABORTED',
    CANNOT_START_LISTENER: 'CANNOT_START_LISTENER',
} as const;

type DcmqrscpEventValue = (typeof DcmqrscpEvent)[keyof typeof DcmqrscpEvent];

// ---------------------------------------------------------------------------
// Event data interfaces (all readonly)
// ---------------------------------------------------------------------------

/** Data for LISTENING event. */
interface QRListeningData {
    readonly port: number;
}

/** Data for ASSOCIATION_RECEIVED event. */
interface QRAssociationReceivedData {
    readonly peerInfo: string;
}

/** Data for ASSOCIATION_ACKNOWLEDGED event. */
interface QRAssociationAcknowledgedData {
    readonly maxSendPDV: number;
}

/** Data for C_FIND_REQUEST event. */
interface QRCFindRequestData {
    readonly raw: string;
}

/** Data for C_MOVE_REQUEST event. */
interface QRCMoveRequestData {
    readonly raw: string;
}

/** Data for C_GET_REQUEST event. */
interface QRCGetRequestData {
    readonly raw: string;
}

/** Data for C_STORE_REQUEST event. */
interface QRCStoreRequestData {
    readonly raw: string;
}

/** Data for CANNOT_START_LISTENER event. */
interface QRCannotStartListenerData {
    readonly message: string;
}

// ---------------------------------------------------------------------------
// Regex patterns for dcmqrscp verbose output
// ---------------------------------------------------------------------------

/** Event patterns for parsing dcmqrscp verbose output. */
const DCMQRSCP_PATTERNS: readonly EventPattern[] = [
    {
        event: DcmqrscpEvent.LISTENING,
        pattern: /listening on port\s+(\d+)/i,
        processor: (match): QRListeningData => ({
            port: Number(match[1]),
        }),
    },
    {
        event: DcmqrscpEvent.ASSOCIATION_RECEIVED,
        pattern: /Association Received\s*(.+)/,
        processor: (match): QRAssociationReceivedData => ({
            peerInfo: (match[1] ?? '').trim(),
        }),
    },
    {
        event: DcmqrscpEvent.ASSOCIATION_ACKNOWLEDGED,
        pattern: /Association Acknowledged \(Max Send PDV:\s*(\d+)\)/,
        processor: (match): QRAssociationAcknowledgedData => ({
            maxSendPDV: Number(match[1]),
        }),
    },
    {
        event: DcmqrscpEvent.C_FIND_REQUEST,
        pattern: /Received Find (?:SCP )?Request/i,
        processor: (match): QRCFindRequestData => ({
            raw: match[0] ?? '',
        }),
    },
    {
        event: DcmqrscpEvent.C_MOVE_REQUEST,
        pattern: /Received Move (?:SCP )?Request/i,
        processor: (match): QRCMoveRequestData => ({
            raw: match[0] ?? '',
        }),
    },
    {
        event: DcmqrscpEvent.C_GET_REQUEST,
        pattern: /Received Get (?:SCP )?Request/i,
        processor: (match): QRCGetRequestData => ({
            raw: match[0] ?? '',
        }),
    },
    {
        event: DcmqrscpEvent.C_STORE_REQUEST,
        pattern: /Received Store (?:SCP )?Request/i,
        processor: (match): QRCStoreRequestData => ({
            raw: match[0] ?? '',
        }),
    },
    {
        event: DcmqrscpEvent.ASSOCIATION_RELEASE,
        pattern: /Association Release/i,
        processor: () => undefined,
    },
    {
        event: DcmqrscpEvent.ASSOCIATION_ABORTED,
        pattern: /Association Abort/i,
        processor: () => undefined,
    },
    {
        event: DcmqrscpEvent.CANNOT_START_LISTENER,
        pattern: /cannot listen|cannot initialise network/i,
        processor: (match): QRCannotStartListenerData => ({
            message: match[0] ?? '',
        }),
    },
];

/** Events that indicate fatal errors (process should be stopped). */
const DCMQRSCP_FATAL_EVENTS: ReadonlySet<string> = new Set([DcmqrscpEvent.CANNOT_START_LISTENER]);

export { DcmqrscpEvent, DCMQRSCP_PATTERNS, DCMQRSCP_FATAL_EVENTS };
export type {
    DcmqrscpEventValue,
    QRListeningData,
    QRAssociationReceivedData,
    QRAssociationAcknowledgedData,
    QRCFindRequestData,
    QRCMoveRequestData,
    QRCGetRequestData,
    QRCStoreRequestData,
    QRCannotStartListenerData,
};
