/**
 * Event patterns and types for dcmprscp output parsing.
 *
 * Defines regex patterns that match DCMTK dcmprscp (print management SCP)
 * verbose output, along with typed event data interfaces for each event.
 *
 * @module events/dcmprscp
 */

import type { EventPattern } from '../parsers/EventPattern';

// ---------------------------------------------------------------------------
// Event constants (as const, not enum — Rule 3.5)
// ---------------------------------------------------------------------------

/** Events emitted by dcmprscp process output. */
const DcmprscpEvent = {
    DATABASE_READY: 'DATABASE_READY',
    ASSOCIATION_RECEIVED: 'ASSOCIATION_RECEIVED',
    ASSOCIATION_ACKNOWLEDGED: 'ASSOCIATION_ACKNOWLEDGED',
    ASSOCIATION_RELEASE: 'ASSOCIATION_RELEASE',
    ASSOCIATION_ABORTED: 'ASSOCIATION_ABORTED',
    CANNOT_START_LISTENER: 'CANNOT_START_LISTENER',
    CONFIG_ERROR: 'CONFIG_ERROR',
} as const;

type DcmprscpEventValue = (typeof DcmprscpEvent)[keyof typeof DcmprscpEvent];

// ---------------------------------------------------------------------------
// Event data interfaces (all readonly)
// ---------------------------------------------------------------------------

/** Data for DATABASE_READY event. */
interface DatabaseReadyData {
    readonly directory: string;
}

/** Data for ASSOCIATION_RECEIVED event. */
interface PrintAssociationReceivedData {
    readonly peerInfo: string;
}

/** Data for ASSOCIATION_ACKNOWLEDGED event. */
interface PrintAssociationAcknowledgedData {
    readonly maxSendPDV: number;
}

/** Data for CANNOT_START_LISTENER event. */
interface PrintCannotStartListenerData {
    readonly message: string;
}

/** Data for CONFIG_ERROR event. */
interface ConfigErrorData {
    readonly message: string;
}

// ---------------------------------------------------------------------------
// Regex patterns for dcmprscp verbose output
// ---------------------------------------------------------------------------

/** Event patterns for parsing dcmprscp verbose output. */
const DCMPRSCP_PATTERNS: readonly EventPattern[] = [
    {
        event: DcmprscpEvent.DATABASE_READY,
        pattern: /Using database in directory\s+'([^']+)'/,
        processor: (match): DatabaseReadyData => ({
            directory: match[1] ?? '',
        }),
    },
    {
        event: DcmprscpEvent.ASSOCIATION_RECEIVED,
        pattern: /Association Received\s*\(([^)]+)\)/,
        processor: (match): PrintAssociationReceivedData => ({
            peerInfo: (match[1] ?? '').trim(),
        }),
    },
    {
        event: DcmprscpEvent.ASSOCIATION_ACKNOWLEDGED,
        pattern: /Association Acknowledged \(Max Send PDV:\s*(\d+)\)/,
        processor: (match): PrintAssociationAcknowledgedData => ({
            maxSendPDV: Number(match[1]),
        }),
    },
    {
        event: DcmprscpEvent.ASSOCIATION_RELEASE,
        pattern: /Association Release/i,
        processor: () => undefined,
    },
    {
        event: DcmprscpEvent.ASSOCIATION_ABORTED,
        pattern: /Association Abort/i,
        processor: () => undefined,
    },
    {
        event: DcmprscpEvent.CANNOT_START_LISTENER,
        pattern: /cannot initialise network|cannot listen/i,
        processor: (match): PrintCannotStartListenerData => ({
            message: match[0] ?? '',
        }),
    },
    {
        event: DcmprscpEvent.CONFIG_ERROR,
        pattern: /can't open configuration file|no (?:default )?print scp/i,
        processor: (match): ConfigErrorData => ({
            message: match[0] ?? '',
        }),
    },
];

/** Events that indicate fatal errors (process should be stopped). */
const DCMPRSCP_FATAL_EVENTS: ReadonlySet<string> = new Set([DcmprscpEvent.CANNOT_START_LISTENER, DcmprscpEvent.CONFIG_ERROR]);

export { DcmprscpEvent, DCMPRSCP_PATTERNS, DCMPRSCP_FATAL_EVENTS };
export type {
    DcmprscpEventValue,
    DatabaseReadyData,
    PrintAssociationReceivedData,
    PrintAssociationAcknowledgedData,
    PrintCannotStartListenerData,
    ConfigErrorData,
};
