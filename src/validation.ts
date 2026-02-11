/**
 * Runtime validation schemas and parse functions.
 *
 * All external inputs are validated at module boundaries using Zod (Rule 7.2).
 * Each schema has a corresponding parse function returning `Result<BrandedType>`.
 * Internal code trusts branded types without re-validation.
 *
 * @module validation
 */

import { z } from 'zod';
import type { Result } from './types';
import { ok, err } from './types';
import type { AETitle, DicomTag, DicomTagPath, SOPClassUID, TransferSyntaxUID, Port } from './brands';
import {
    DICOM_TAG_PATTERN,
    AE_TITLE_PATTERN,
    UID_PATTERN,
    TAG_PATH_SEGMENT,
    AE_TITLE_MIN_LENGTH,
    AE_TITLE_MAX_LENGTH,
    UID_MAX_LENGTH,
    PORT_MIN,
    PORT_MAX,
} from './patterns';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Schema for DICOM AE Titles: 1-16 chars, letters/digits/spaces/hyphens. */
const AETitleSchema = z.string().min(AE_TITLE_MIN_LENGTH).max(AE_TITLE_MAX_LENGTH).regex(AE_TITLE_PATTERN);

/** Schema for network port numbers: integer 1-65535. */
const PortSchema = z.number().int().min(PORT_MIN).max(PORT_MAX);

/** Schema for DICOM tags: (XXXX,XXXX) where X is a hex digit. */
const DicomTagSchema = z.string().regex(DICOM_TAG_PATTERN);

/** Schema for DICOM tag paths: dot-separated tags with optional array indices. */
const DicomTagPathSchema = z
    .string()
    .min(1)
    .regex(new RegExp(`^${TAG_PATH_SEGMENT.source}(\\.${TAG_PATH_SEGMENT.source})*$`));

/** Schema for DICOM UIDs: dotted numeric OID, 1-64 chars. */
const UIDSchema = z.string().min(1).max(UID_MAX_LENGTH).regex(UID_PATTERN);

// ---------------------------------------------------------------------------
// Parse functions — bridge Zod results to Result<BrandedType>
// ---------------------------------------------------------------------------

/**
 * Validates unknown input as an AE Title.
 *
 * @param input - The unknown input to validate
 * @returns Result containing a branded AETitle or an error
 */
function parseAETitle(input: unknown): Result<AETitle> {
    const parsed = AETitleSchema.safeParse(input);
    if (!parsed.success) {
        return err(new Error(`Invalid AE Title: ${parsed.error.message}`));
    }
    return ok(parsed.data as AETitle);
}

/**
 * Validates unknown input as a network port.
 *
 * @param input - The unknown input to validate
 * @returns Result containing a branded Port or an error
 */
function parsePort(input: unknown): Result<Port> {
    const parsed = PortSchema.safeParse(input);
    if (!parsed.success) {
        return err(new Error(`Invalid port: ${parsed.error.message}`));
    }
    return ok(parsed.data as Port);
}

/**
 * Validates unknown input as a DICOM tag.
 *
 * @param input - The unknown input to validate
 * @returns Result containing a branded DicomTag or an error
 */
function parseDicomTag(input: unknown): Result<DicomTag> {
    const parsed = DicomTagSchema.safeParse(input);
    if (!parsed.success) {
        return err(new Error(`Invalid DICOM tag: ${parsed.error.message}`));
    }
    return ok(parsed.data as DicomTag);
}

/**
 * Validates unknown input as a DICOM tag path.
 *
 * @param input - The unknown input to validate
 * @returns Result containing a branded DicomTagPath or an error
 */
function parseDicomTagPath(input: unknown): Result<DicomTagPath> {
    const parsed = DicomTagPathSchema.safeParse(input);
    if (!parsed.success) {
        return err(new Error(`Invalid DICOM tag path: ${parsed.error.message}`));
    }
    return ok(parsed.data as DicomTagPath);
}

/**
 * Validates unknown input as a SOP Class UID.
 *
 * @param input - The unknown input to validate
 * @returns Result containing a branded SOPClassUID or an error
 */
function parseSOPClassUID(input: unknown): Result<SOPClassUID> {
    const parsed = UIDSchema.safeParse(input);
    if (!parsed.success) {
        return err(new Error(`Invalid SOP Class UID: ${parsed.error.message}`));
    }
    return ok(parsed.data as SOPClassUID);
}

/**
 * Validates unknown input as a Transfer Syntax UID.
 *
 * @param input - The unknown input to validate
 * @returns Result containing a branded TransferSyntaxUID or an error
 */
function parseTransferSyntaxUID(input: unknown): Result<TransferSyntaxUID> {
    const parsed = UIDSchema.safeParse(input);
    if (!parsed.success) {
        return err(new Error(`Invalid Transfer Syntax UID: ${parsed.error.message}`));
    }
    return ok(parsed.data as TransferSyntaxUID);
}

export { AETitleSchema, PortSchema, DicomTagSchema, DicomTagPathSchema, UIDSchema };
export { parseAETitle, parsePort, parseDicomTag, parseDicomTagPath, parseSOPClassUID, parseTransferSyntaxUID };
