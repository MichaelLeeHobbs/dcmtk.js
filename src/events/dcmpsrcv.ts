/**
 * Event patterns and types for dcmpsrcv output parsing.
 *
 * Defines regex patterns that match DCMTK dcmpsrcv (viewer network receiver)
 * verbose output. Shares several patterns with dcmrecv/storescp since
 * dcmpsrcv handles incoming DICOM associations and C-STORE operations.
 *
 * @module events/dcmpsrcv
 */

import type { EventPattern } from '../parsers/EventPattern';

// ---------------------------------------------------------------------------
// Event constants (as const, not enum — Rule 3.5)
// ---------------------------------------------------------------------------

/** Events emitted by dcmpsrcv process output. */
const DcmpsrcvEvent = {
    LISTENING: 'LISTENING',
    DATABASE_READY: 'DATABASE_READY',
    ASSOCIATION_RECEIVED: 'ASSOCIATION_RECEIVED',
    ASSOCIATION_ACKNOWLEDGED: 'ASSOCIATION_ACKNOWLEDGED',
    ECHO_REQUEST: 'ECHO_REQUEST',
    C_STORE_REQUEST: 'C_STORE_REQUEST',
    FILE_DELETED: 'FILE_DELETED',
    ASSOCIATION_RELEASE: 'ASSOCIATION_RELEASE',
    ASSOCIATION_ABORTED: 'ASSOCIATION_ABORTED',
    CANNOT_START_LISTENER: 'CANNOT_START_LISTENER',
    CONFIG_ERROR: 'CONFIG_ERROR',
    TERMINATING: 'TERMINATING',
} as const;

type DcmpsrcvEventValue = (typeof DcmpsrcvEvent)[keyof typeof DcmpsrcvEvent];

// ---------------------------------------------------------------------------
// Event data interfaces (all readonly)
// ---------------------------------------------------------------------------

/** Data for LISTENING event. */
interface ReceiverListeningData {
    readonly receiverId: string;
    readonly port: number;
}

/** Data for DATABASE_READY event. */
interface ReceiverDatabaseReadyData {
    readonly directory: string;
}

/** Data for ASSOCIATION_RECEIVED event. */
interface ReceiverAssociationReceivedData {
    readonly peerInfo: string;
}

/** Data for ASSOCIATION_ACKNOWLEDGED event. */
interface ReceiverAssociationAcknowledgedData {
    readonly maxSendPDV: number;
}

/** Data for ECHO_REQUEST event. */
interface ReceiverEchoRequestData {
    readonly messageId: number;
}

/** Data for C_STORE_REQUEST event. */
interface ReceiverCStoreRequestData {
    readonly raw: string;
}

/** Data for FILE_DELETED event. */
interface FileDeletedData {
    readonly filePath: string;
}

/** Data for CANNOT_START_LISTENER event. */
interface ReceiverCannotStartListenerData {
    readonly message: string;
}

/** Data for CONFIG_ERROR event. */
interface ReceiverConfigErrorData {
    readonly message: string;
}

// ---------------------------------------------------------------------------
// Regex patterns for dcmpsrcv verbose output
// ---------------------------------------------------------------------------

/** Event patterns for parsing dcmpsrcv verbose output. */
const DCMPSRCV_PATTERNS: readonly EventPattern[] = [
    {
        event: DcmpsrcvEvent.LISTENING,
        pattern: /Receiver\s+(\S+)\s+on port\s+(\d+)/,
        processor: (match): ReceiverListeningData => ({
            receiverId: match[1] ?? '',
            port: Number(match[2]),
        }),
    },
    {
        event: DcmpsrcvEvent.DATABASE_READY,
        pattern: /Using database in directory\s+'([^']+)'/,
        processor: (match): ReceiverDatabaseReadyData => ({
            directory: match[1] ?? '',
        }),
    },
    {
        event: DcmpsrcvEvent.ASSOCIATION_RECEIVED,
        pattern: /Association Received\s*\(([^)]+)\)/,
        processor: (match): ReceiverAssociationReceivedData => ({
            peerInfo: (match[1] ?? '').trim(),
        }),
    },
    {
        event: DcmpsrcvEvent.ASSOCIATION_ACKNOWLEDGED,
        pattern: /Association Acknowledged \(Max Send PDV:\s*(\d+)\)/,
        processor: (match): ReceiverAssociationAcknowledgedData => ({
            maxSendPDV: Number(match[1]),
        }),
    },
    {
        event: DcmpsrcvEvent.ECHO_REQUEST,
        pattern: /Received Echo SCP RQ:\s*MsgID\s+(\d+)/,
        processor: (match): ReceiverEchoRequestData => ({
            messageId: Number(match[1]),
        }),
    },
    {
        event: DcmpsrcvEvent.C_STORE_REQUEST,
        pattern: /Received Store SCP/i,
        processor: (match): ReceiverCStoreRequestData => ({
            raw: match[0] ?? '',
        }),
    },
    {
        event: DcmpsrcvEvent.FILE_DELETED,
        pattern: /Deleting Image File:\s*(.+)/,
        processor: (match): FileDeletedData => ({
            filePath: (match[1] ?? '').trim(),
        }),
    },
    {
        event: DcmpsrcvEvent.ASSOCIATION_RELEASE,
        pattern: /Association Release/i,
        processor: () => undefined,
    },
    {
        event: DcmpsrcvEvent.ASSOCIATION_ABORTED,
        pattern: /Association Abort/i,
        processor: () => undefined,
    },
    {
        event: DcmpsrcvEvent.CANNOT_START_LISTENER,
        pattern: /cannot listen on port/i,
        processor: (match): ReceiverCannotStartListenerData => ({
            message: match[0] ?? '',
        }),
    },
    {
        event: DcmpsrcvEvent.CONFIG_ERROR,
        pattern: /can't open configuration file|missing configuration file|no application entity title|no or invalid port number/i,
        processor: (match): ReceiverConfigErrorData => ({
            message: match[0] ?? '',
        }),
    },
    {
        event: DcmpsrcvEvent.TERMINATING,
        pattern: /Terminating all receivers/i,
        processor: () => undefined,
    },
];

/** Events that indicate fatal errors (process should be stopped). */
const DCMPSRCV_FATAL_EVENTS: ReadonlySet<string> = new Set([DcmpsrcvEvent.CANNOT_START_LISTENER, DcmpsrcvEvent.CONFIG_ERROR]);

export { DcmpsrcvEvent, DCMPSRCV_PATTERNS, DCMPSRCV_FATAL_EVENTS };
export type {
    DcmpsrcvEventValue,
    ReceiverListeningData,
    ReceiverDatabaseReadyData,
    ReceiverAssociationReceivedData,
    ReceiverAssociationAcknowledgedData,
    ReceiverEchoRequestData,
    ReceiverCStoreRequestData,
    FileDeletedData,
    ReceiverCannotStartListenerData,
    ReceiverConfigErrorData,
};
