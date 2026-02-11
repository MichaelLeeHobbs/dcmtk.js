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

import { normalize } from 'node:path';
import type { Result } from './types';
import { ok, err } from './types';
import {
    DICOM_TAG_PATTERN,
    AE_TITLE_PATTERN,
    UID_PATTERN,
    DICOM_TAG_PATH_PATTERN,
    AE_TITLE_MIN_LENGTH,
    AE_TITLE_MAX_LENGTH,
    UID_MAX_LENGTH,
    PORT_MIN,
    PORT_MAX,
    PATH_TRAVERSAL_PATTERN,
} from './patterns';

declare const __brand: unique symbol;

/** Intersects a base type with a phantom brand property for nominal typing. */
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

// ---------------------------------------------------------------------------
// Branded types
// ---------------------------------------------------------------------------

/**
 * A validated DICOM tag string, e.g. `"(0010,0010)"`.
 *
 * @remarks
 * Branded types enforce type safety when passing values between functions.
 * They are not required for direct API calls (which validate internally via Zod).
 * Use {@link createDicomTag} to obtain a branded value from a raw string.
 */
type DicomTag = Brand<string, 'DicomTag'>;

/**
 * A validated AE Title (1-16 chars: uppercase letters, digits, spaces, hyphens).
 *
 * @remarks
 * Branded types enforce type safety when passing values between functions.
 * They are not required for direct API calls (which validate internally via Zod).
 * Use {@link createAETitle} to obtain a branded value from a raw string.
 */
type AETitle = Brand<string, 'AETitle'>;

/**
 * A validated DICOM tag path, e.g. `"(0040,A730)[0].(0010,0010)"`.
 *
 * @remarks
 * Branded types enforce type safety when passing values between functions.
 * They are not required for direct API calls (which validate internally via Zod).
 * Use {@link createDicomTagPath} to obtain a branded value from a raw string.
 */
type DicomTagPath = Brand<string, 'DicomTagPath'>;

/**
 * A validated SOP Class UID (dotted numeric OID, 1-64 chars).
 *
 * @remarks
 * Branded types enforce type safety when passing values between functions.
 * They are not required for direct API calls (which validate internally via Zod).
 * Use {@link createSOPClassUID} to obtain a branded value from a raw string.
 */
type SOPClassUID = Brand<string, 'SOPClassUID'>;

/**
 * A validated Transfer Syntax UID (dotted numeric OID, 1-64 chars).
 *
 * @remarks
 * Branded types enforce type safety when passing values between functions.
 * They are not required for direct API calls (which validate internally via Zod).
 * Use {@link createTransferSyntaxUID} to obtain a branded value from a raw string.
 */
type TransferSyntaxUID = Brand<string, 'TransferSyntaxUID'>;

/**
 * A validated filesystem path to a DICOM file.
 *
 * @remarks
 * Branded types enforce type safety when passing values between functions.
 * They are not required for direct API calls (which validate internally via Zod).
 * Use {@link createDicomFilePath} to obtain a branded value from a raw string.
 */
type DicomFilePath = Brand<string, 'DicomFilePath'>;

/**
 * A validated network port number (1-65535).
 *
 * @remarks
 * Branded types enforce type safety when passing values between functions.
 * They are not required for direct API calls (which validate internally via Zod).
 * Use {@link createPort} to obtain a branded value from a raw number.
 */
type Port = Brand<number, 'Port'>;

// Validation patterns and constants imported from ./patterns

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
 * Validates that the path is non-empty and does not contain path traversal sequences.
 *
 * @param input - A filesystem path string
 * @returns A Result containing the branded DicomFilePath or an error
 */
function createDicomFilePath(input: string): Result<DicomFilePath> {
    if (input.length === 0) {
        return err(new Error('Invalid DICOM file path: empty string'));
    }
    if (PATH_TRAVERSAL_PATTERN.test(input)) {
        return err(new Error(`Invalid DICOM file path: path traversal detected in "${input}"`));
    }
    const normalized = normalize(input);
    return ok(normalized as DicomFilePath);
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
