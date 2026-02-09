/**
 * Branded types for domain primitives.
 *
 * Branded types use TypeScript's structural type system to prevent accidental
 * mixing of semantically different values that share the same underlying type.
 * A `DicomTag` cannot be used where an `AETitle` is expected, even though both
 * are strings at runtime.
 *
 * @module brands
 */

import type { Result } from './types';
import { ok, err } from './types';

declare const __brand: unique symbol;

/** Intersects a base type with a phantom brand property for nominal typing. */
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

// ---------------------------------------------------------------------------
// Branded types
// ---------------------------------------------------------------------------

/** A validated DICOM tag string, e.g. `"(0010,0010)"`. */
type DicomTag = Brand<string, 'DicomTag'>;

/** A validated AE Title (1-16 chars: uppercase letters, digits, spaces, hyphens). */
type AETitle = Brand<string, 'AETitle'>;

/** A validated DICOM tag path, e.g. `"(0040,A730)[0].(0010,0010)"`. */
type DicomTagPath = Brand<string, 'DicomTagPath'>;

/** A validated SOP Class UID (dotted numeric OID, 1-64 chars). */
type SOPClassUID = Brand<string, 'SOPClassUID'>;

/** A validated Transfer Syntax UID (dotted numeric OID, 1-64 chars). */
type TransferSyntaxUID = Brand<string, 'TransferSyntaxUID'>;

/** A validated filesystem path to a DICOM file. */
type DicomFilePath = Brand<string, 'DicomFilePath'>;

/** A validated network port number (1-65535). */
type Port = Brand<number, 'Port'>;

// ---------------------------------------------------------------------------
// Validation patterns
// ---------------------------------------------------------------------------

const DICOM_TAG_PATTERN = /^\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)$/;
const AE_TITLE_PATTERN = /^[A-Za-z0-9 -]+$/;
const UID_PATTERN = /^[0-9]+(\.[0-9]+)*$/;
const TAG_PATH_SEGMENT = /\([0-9A-Fa-f]{4},[0-9A-Fa-f]{4}\)(\[\d+\])?/;
const DICOM_TAG_PATH_PATTERN = new RegExp(`^${TAG_PATH_SEGMENT.source}(\\.${TAG_PATH_SEGMENT.source})*$`);

const AE_TITLE_MIN_LENGTH = 1;
const AE_TITLE_MAX_LENGTH = 16;
const UID_MAX_LENGTH = 64;
const PORT_MIN = 1;
const PORT_MAX = 65535;

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Creates a validated DicomTag from a raw string.
 *
 * @param input - A string expected to be in format `(XXXX,XXXX)` where X is a hex digit
 * @returns A Result containing the branded DicomTag or an error
 */
function createDicomTag(input: string): Result<DicomTag> {
    if (!DICOM_TAG_PATTERN.test(input)) {
        return err(new Error(`Invalid DICOM tag: "${input}". Expected format (XXXX,XXXX) where X is a hex digit`));
    }
    return ok(input as DicomTag);
}

/**
 * Creates a validated AETitle from a raw string.
 *
 * @param input - A string expected to be 1-16 chars of letters, digits, spaces, or hyphens
 * @returns A Result containing the branded AETitle or an error
 */
function createAETitle(input: string): Result<AETitle> {
    if (input.length < AE_TITLE_MIN_LENGTH || input.length > AE_TITLE_MAX_LENGTH) {
        return err(new Error(`Invalid AE Title: "${input}". Must be ${AE_TITLE_MIN_LENGTH}-${AE_TITLE_MAX_LENGTH} characters`));
    }
    if (!AE_TITLE_PATTERN.test(input)) {
        return err(new Error(`Invalid AE Title: "${input}". Only letters, digits, spaces, and hyphens are allowed`));
    }
    return ok(input as AETitle);
}

/**
 * Creates a validated DicomTagPath from a raw string.
 *
 * @param input - A dot-separated path of DICOM tags with optional array indices
 * @returns A Result containing the branded DicomTagPath or an error
 */
function createDicomTagPath(input: string): Result<DicomTagPath> {
    if (input.length === 0) {
        return err(new Error('Invalid DICOM tag path: empty string'));
    }
    if (!DICOM_TAG_PATH_PATTERN.test(input)) {
        return err(new Error(`Invalid DICOM tag path: "${input}". Expected format like (XXXX,XXXX) or (XXXX,XXXX)[0].(XXXX,XXXX)`));
    }
    return ok(input as DicomTagPath);
}

/**
 * Creates a validated SOPClassUID from a raw string.
 *
 * @param input - A dotted numeric OID string, 1-64 characters
 * @returns A Result containing the branded SOPClassUID or an error
 */
function createSOPClassUID(input: string): Result<SOPClassUID> {
    if (input.length === 0 || input.length > UID_MAX_LENGTH) {
        return err(new Error(`Invalid SOP Class UID: "${input}". Must be 1-${UID_MAX_LENGTH} characters`));
    }
    if (!UID_PATTERN.test(input)) {
        return err(new Error(`Invalid SOP Class UID: "${input}". Must be a dotted numeric OID`));
    }
    return ok(input as SOPClassUID);
}

/**
 * Creates a validated TransferSyntaxUID from a raw string.
 *
 * @param input - A dotted numeric OID string, 1-64 characters
 * @returns A Result containing the branded TransferSyntaxUID or an error
 */
function createTransferSyntaxUID(input: string): Result<TransferSyntaxUID> {
    if (input.length === 0 || input.length > UID_MAX_LENGTH) {
        return err(new Error(`Invalid Transfer Syntax UID: "${input}". Must be 1-${UID_MAX_LENGTH} characters`));
    }
    if (!UID_PATTERN.test(input)) {
        return err(new Error(`Invalid Transfer Syntax UID: "${input}". Must be a dotted numeric OID`));
    }
    return ok(input as TransferSyntaxUID);
}

/**
 * Creates a branded DicomFilePath from a raw string.
 * Validates that the path is non-empty.
 *
 * @param input - A filesystem path string
 * @returns A Result containing the branded DicomFilePath or an error
 */
function createDicomFilePath(input: string): Result<DicomFilePath> {
    if (input.length === 0) {
        return err(new Error('Invalid DICOM file path: empty string'));
    }
    return ok(input as DicomFilePath);
}

/**
 * Creates a validated Port from a raw number.
 *
 * @param input - A number expected to be an integer between 1 and 65535
 * @returns A Result containing the branded Port or an error
 */
function createPort(input: number): Result<Port> {
    if (!Number.isInteger(input) || input < PORT_MIN || input > PORT_MAX) {
        return err(new Error(`Invalid port: ${String(input)}. Must be an integer between ${PORT_MIN} and ${PORT_MAX}`));
    }
    return ok(input as Port);
}

export { createDicomTag, createAETitle, createDicomTagPath, createSOPClassUID, createTransferSyntaxUID, createDicomFilePath, createPort };
export type { Brand, DicomTag, AETitle, DicomTagPath, SOPClassUID, TransferSyntaxUID, DicomFilePath, Port };
