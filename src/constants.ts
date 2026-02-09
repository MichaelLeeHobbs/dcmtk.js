/**
 * Application-wide constants.
 *
 * All values use `as const` assertions per Rule 3.5 (no traditional enums).
 * All bounds are documented per Rule 8.1 (bounded loops/buffers).
 *
 * @module constants
 */

// ---------------------------------------------------------------------------
// Timeouts (Rule 4.2: mandatory timeouts on all async operations)
// ---------------------------------------------------------------------------

/** Default timeout for short-lived process execution (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Default timeout for long-lived process startup (10 seconds). */
const DEFAULT_START_TIMEOUT_MS = 10_000;

/** Default timeout for graceful shutdown drain (5 seconds). */
const DEFAULT_DRAIN_TIMEOUT_MS = 5_000;

/** Default timeout for multi-line block accumulation in line parser (1 second). */
const DEFAULT_BLOCK_TIMEOUT_MS = 1_000;

// ---------------------------------------------------------------------------
// DICOM network constants
// ---------------------------------------------------------------------------

/** DICOM protocol default PDU sizes. */
const PDU_SIZE = {
    /** Default maximum PDU receive size (16 KB). */
    DEFAULT: 16_384,
    /** Minimum allowed PDU size (4 KB). */
    MIN: 4_096,
    /** Maximum allowed PDU size (128 KB). */
    MAX: 131_072,
} as const;

/** Default DICOM port used by DCMTK tools. */
const DEFAULT_DICOM_PORT = 104;

// ---------------------------------------------------------------------------
// Platform-specific known DCMTK install paths
// ---------------------------------------------------------------------------

/** Known DCMTK binary locations on Windows. */
const WINDOWS_SEARCH_PATHS = ['C:\\Program Files\\DCMTK\\bin', 'C:\\Program Files (x86)\\DCMTK\\bin', 'C:\\ProgramData\\chocolatey\\bin'] as const;

/** Known DCMTK binary locations on Unix/macOS. */
const UNIX_SEARCH_PATHS = ['/usr/local/bin', '/usr/bin', '/opt/local/bin', '/opt/homebrew/bin'] as const;

// ---------------------------------------------------------------------------
// Required DCMTK binaries (minimum set for core functionality)
// ---------------------------------------------------------------------------

/** Binaries that must be present for the library to function. */
const REQUIRED_BINARIES = ['dcm2json', 'dcm2xml', 'dcmodify', 'dcmdump', 'dcmrecv', 'dcmsend', 'echoscu'] as const;

// ---------------------------------------------------------------------------
// Bounded limits (Rule 8.1: all loops and buffers must have upper bounds)
// ---------------------------------------------------------------------------

/** Maximum stdout/stderr buffer size before truncation (10 MB). */
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/** Maximum lines accumulated in multi-line block parser. */
const MAX_BLOCK_LINES = 1_000;

/** Maximum number of event patterns a line parser can hold. */
const MAX_EVENT_PATTERNS = 200;

/** Maximum loop iterations for iterative traversal (e.g., nested sequences). */
const MAX_TRAVERSAL_DEPTH = 50;

export {
    DEFAULT_TIMEOUT_MS,
    DEFAULT_START_TIMEOUT_MS,
    DEFAULT_DRAIN_TIMEOUT_MS,
    DEFAULT_BLOCK_TIMEOUT_MS,
    PDU_SIZE,
    DEFAULT_DICOM_PORT,
    WINDOWS_SEARCH_PATHS,
    UNIX_SEARCH_PATHS,
    REQUIRED_BINARIES,
    MAX_BUFFER_BYTES,
    MAX_BLOCK_LINES,
    MAX_EVENT_PATTERNS,
    MAX_TRAVERSAL_DEPTH,
};
