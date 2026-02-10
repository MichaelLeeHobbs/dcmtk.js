/**
 * Event patterns and types for storescp output parsing.
 *
 * Extends dcmrecv patterns with storescp-specific events like
 * file storage progress and subdirectory creation.
 *
 * @module events/storescp
 */

import type { EventPattern } from '../parsers/EventPattern';
import { DcmrecvEvent, DCMRECV_PATTERNS, DCMRECV_FATAL_EVENTS } from './dcmrecv';

// ---------------------------------------------------------------------------
// Event constants (superset of dcmrecv — Rule 3.5)
// ---------------------------------------------------------------------------

/** Events emitted by storescp process output. */
const StorescpEvent = {
    ...DcmrecvEvent,
    STORING_FILE: 'STORING_FILE',
    SUBDIRECTORY_CREATED: 'SUBDIRECTORY_CREATED',
} as const;

type StorescpEventValue = (typeof StorescpEvent)[keyof typeof StorescpEvent];

// ---------------------------------------------------------------------------
// Additional event data interfaces
// ---------------------------------------------------------------------------

/** Data for STORING_FILE event. */
interface StoringFileData {
    readonly filePath: string;
}

/** Data for SUBDIRECTORY_CREATED event. */
interface SubdirectoryCreatedData {
    readonly directory: string;
}

// ---------------------------------------------------------------------------
// storescp-specific patterns
// ---------------------------------------------------------------------------

const STORESCP_ADDITIONAL_PATTERNS: readonly EventPattern[] = [
    {
        event: StorescpEvent.STORING_FILE,
        pattern: /storing DICOM file:\s*(.+)/i,
        processor: (match): StoringFileData => ({
            filePath: (match[1] ?? '').trim(),
        }),
    },
    {
        event: StorescpEvent.SUBDIRECTORY_CREATED,
        pattern: /created new subdirectory[:\s]*(.+)/i,
        processor: (match): SubdirectoryCreatedData => ({
            directory: (match[1] ?? '').trim(),
        }),
    },
];

/** Combined event patterns for parsing storescp verbose output. */
const STORESCP_PATTERNS: readonly EventPattern[] = [...DCMRECV_PATTERNS, ...STORESCP_ADDITIONAL_PATTERNS];

/** Events that indicate fatal errors (process should be stopped). */
const STORESCP_FATAL_EVENTS: ReadonlySet<string> = new Set([...DCMRECV_FATAL_EVENTS]);

export { StorescpEvent, STORESCP_PATTERNS, STORESCP_FATAL_EVENTS };
export type { StorescpEventValue, StoringFileData, SubdirectoryCreatedData };
