/**
 * Shared validation regex patterns and constants.
 *
 * Centralises all DICOM-related validation patterns so that brands,
 * validation schemas, and server modules reference a single source
 * of truth rather than maintaining duplicated copies.
 *
 * @module patterns
 */

// ---------------------------------------------------------------------------
// DICOM tag and UID patterns
// ---------------------------------------------------------------------------

/** Matches a DICOM tag in `(XXXX,XXXX)` format where X is a hex digit. */
const DICOM_TAG_PATTERN = /^\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)$/;

/** Matches a DICOM AE Title: letters, digits, spaces, and hyphens. */
const AE_TITLE_PATTERN = /^[A-Za-z0-9 -]+$/;

/** Matches a dotted numeric OID (e.g. `1.2.840.10008`). */
const UID_PATTERN = /^[0-9]+(\.[0-9]+)*$/;

/** Matches a single DICOM tag path segment with optional array index. */
const TAG_PATH_SEGMENT = /\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)(\[\d+\])?/;

/** Matches a full dot-separated DICOM tag path (e.g. `(0040,A730)[0].(0010,0010)`). */
const DICOM_TAG_PATH_PATTERN = new RegExp(`^${TAG_PATH_SEGMENT.source}(\\.${TAG_PATH_SEGMENT.source})*$`);

// ---------------------------------------------------------------------------
// Validation constants
// ---------------------------------------------------------------------------

/** Minimum length for an AE Title. */
const AE_TITLE_MIN_LENGTH = 1;

/** Maximum length for an AE Title. */
const AE_TITLE_MAX_LENGTH = 16;

/** Maximum length for a DICOM UID. */
const UID_MAX_LENGTH = 64;

/** Minimum valid network port number. */
const PORT_MIN = 1;

/** Maximum valid network port number. */
const PORT_MAX = 65535;

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

/** Pattern matching `..` as a path segment (between separators, or at start/end). */
const PATH_TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Returns true if the path does not contain traversal sequences.
 *
 * @param p - The filesystem path to check
 * @returns `true` when the path is safe (no `..` segments)
 */
function isSafePath(p: string): boolean {
    return !PATH_TRAVERSAL_PATTERN.test(p);
}

export {
    DICOM_TAG_PATTERN,
    AE_TITLE_PATTERN,
    UID_PATTERN,
    TAG_PATH_SEGMENT,
    DICOM_TAG_PATH_PATTERN,
    AE_TITLE_MIN_LENGTH,
    AE_TITLE_MAX_LENGTH,
    UID_MAX_LENGTH,
    PORT_MIN,
    PORT_MAX,
    PATH_TRAVERSAL_PATTERN,
    isSafePath,
};
