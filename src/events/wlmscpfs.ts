/**
 * Event patterns and types for wlmscpfs output parsing.
 *
 * Defines regex patterns that match DCMTK wlmscpfs (Worklist Management SCP)
 * verbose output, along with typed event data interfaces for each event.
 *
 * @module events/wlmscpfs
 */

import type { EventPattern } from '../parsers/EventPattern';

// ---------------------------------------------------------------------------
// Event constants (as const, not enum — Rule 3.5)
// ---------------------------------------------------------------------------

/** Events emitted by wlmscpfs process output. */
const WlmscpfsEvent = {
    LISTENING: 'LISTENING',
    ASSOCIATION_RECEIVED: 'ASSOCIATION_RECEIVED',
    ASSOCIATION_ACKNOWLEDGED: 'ASSOCIATION_ACKNOWLEDGED',
    C_FIND_REQUEST: 'C_FIND_REQUEST',
    ASSOCIATION_RELEASE: 'ASSOCIATION_RELEASE',
    ASSOCIATION_ABORTED: 'ASSOCIATION_ABORTED',
    ECHO_REQUEST: 'ECHO_REQUEST',
    CANNOT_START_LISTENER: 'CANNOT_START_LISTENER',
} as const;

type WlmscpfsEventValue = (typeof WlmscpfsEvent)[keyof typeof WlmscpfsEvent];

// ---------------------------------------------------------------------------
// Event data interfaces (all readonly)
// ---------------------------------------------------------------------------

/** Data for LISTENING event. */
interface WlmListeningData {
    readonly port: number;
}

/** Data for ASSOCIATION_RECEIVED event. */
interface WlmAssociationReceivedData {
    readonly peerInfo: string;
}

/** Data for ASSOCIATION_ACKNOWLEDGED event. */
interface WlmAssociationAcknowledgedData {
    readonly maxSendPDV: number;
}

/** Data for C_FIND_REQUEST event. */
interface WlmCFindRequestData {
    readonly raw: string;
}

/** Data for CANNOT_START_LISTENER event. */
interface WlmCannotStartListenerData {
    readonly message: string;
}

// ---------------------------------------------------------------------------
// Regex patterns for wlmscpfs verbose output
// ---------------------------------------------------------------------------

/** Event patterns for parsing wlmscpfs verbose output. */
const WLMSCPFS_PATTERNS: readonly EventPattern[] = [
    {
        event: WlmscpfsEvent.LISTENING,
        pattern: /listening on port\s+(\d+)/i,
        processor: (match): WlmListeningData => ({
            port: Number(match[1]),
        }),
    },
    {
        event: WlmscpfsEvent.ASSOCIATION_RECEIVED,
        pattern: /Association Received\s*(.+)/,
        processor: (match): WlmAssociationReceivedData => ({
            peerInfo: (match[1] ?? '').trim(),
        }),
    },
    {
        event: WlmscpfsEvent.ASSOCIATION_ACKNOWLEDGED,
        pattern: /Association Acknowledged \(Max Send PDV:\s*(\d+)\)/,
        processor: (match): WlmAssociationAcknowledgedData => ({
            maxSendPDV: Number(match[1]),
        }),
    },
    {
        event: WlmscpfsEvent.C_FIND_REQUEST,
        pattern: /Received (?:C-FIND|Find) Request/i,
        processor: (match): WlmCFindRequestData => ({
            raw: match[0] ?? '',
        }),
    },
    {
        event: WlmscpfsEvent.ASSOCIATION_RELEASE,
        pattern: /Association Release/i,
        processor: () => undefined,
    },
    {
        event: WlmscpfsEvent.ASSOCIATION_ABORTED,
        pattern: /Association Abort/i,
        processor: () => undefined,
    },
    {
        event: WlmscpfsEvent.ECHO_REQUEST,
        pattern: /Received (?:C-ECHO|Echo) Request/i,
        processor: () => undefined,
    },
    {
        event: WlmscpfsEvent.CANNOT_START_LISTENER,
        pattern: /cannot listen|cannot initialise network/i,
        processor: (match): WlmCannotStartListenerData => ({
            message: match[0] ?? '',
        }),
    },
];

/** Events that indicate fatal errors (process should be stopped). */
const WLMSCPFS_FATAL_EVENTS: ReadonlySet<string> = new Set([WlmscpfsEvent.CANNOT_START_LISTENER]);

export { WlmscpfsEvent, WLMSCPFS_PATTERNS, WLMSCPFS_FATAL_EVENTS };
export type {
    WlmscpfsEventValue,
    WlmListeningData,
    WlmAssociationReceivedData,
    WlmAssociationAcknowledgedData,
    WlmCFindRequestData,
    WlmCannotStartListenerData,
};
