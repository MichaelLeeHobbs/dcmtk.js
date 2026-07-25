/**
 * Bounded head-read for the pure-JS DICOM parser (#35, #39).
 *
 * `dicom2json` only ever emits bare `{ vr }` for bulk binary VRs, so for large
 * files the bulk of the bytes (PixelData and friends) are read and then
 * discarded. This module reads only what the JSON Model needs: bulk-value
 * discovery is delegated to `@ubercode/dicom-parser`'s `parseHeadAsync` (which
 * walks the file with the real tokenizer over ranged reads), and the reported
 * ranges are elided from a synthetic Part-10 buffer — each skipped element
 * keeps its header with the length field rewritten to zero, so the buffer
 * parses identically to the full file through the same converter.
 *
 * Correctness rules:
 * - Only ranges the fork proves bulk are elided; anything it copied
 *   (sequences, text, ambiguous VRs) is read verbatim.
 * - Truncated files (`unexpected-eof`), parse failures, deflated transfer
 *   syntax, and defined-length encapsulated pixel data (rare; the elided value
 *   would hide the item structure the full parse keys on) fall back to reading
 *   the whole file, so behavior — including warnings — matches a full read.
 *
 * @module _boundedRead
 * @internal
 */

import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { parseHeadAsync } from '@ubercode/dicom-parser';
import type { HeadResult, RangeReader } from '@ubercode/dicom-parser';
import type { Result } from '../types';
import { ok, err } from '../types';
import { BOUNDED_READ_THRESHOLD_BYTES } from '../constants';
import { lookupTag } from '../dicom/dictionary';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAG_PIXEL_DATA = 0x7fe00010;
const TS_IMPLICIT_LE = '1.2.840.10008.1.2';

/** Transfer syntaxes whose pixel data is native (not encapsulated in fragments). */
const NATIVE_TRANSFER_SYNTAXES: ReadonlySet<string> = new Set(['1.2.840.10008.1.2', '1.2.840.10008.1.2.1', '1.2.840.10008.1.2.2', '1.2.840.10008.1.2.1.99']);

/** Bound on single-read retries when the OS returns short reads (Rule 8.1). */
const MAX_READ_CALLS = 10_000;

/** Bound on fragment items validated per encapsulated element (Rule 8.1). */
const MAX_FRAGMENT_HOPS = 100_000;

const UNDEFINED_LENGTH = 0xffffffff;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for {@link readDicomHead}. */
interface BoundedReadOptions {
    /** Overall deadline for the read, in ms. */
    readonly timeoutMs: number;
    /** External abort signal. */
    readonly signal?: AbortSignal | undefined;
    /** Files at or below this size are read whole. Defaults to {@link BOUNDED_READ_THRESHOLD_BYTES}. */
    readonly thresholdBytes?: number | undefined;
}

/** Abort/deadline context threaded through the reads. */
interface Guard {
    readonly deadline: number;
    readonly timeoutMs: number;
    readonly signal: AbortSignal | undefined;
}

// ---------------------------------------------------------------------------
// Low-level IO
// ---------------------------------------------------------------------------

/** Reads exactly `length` bytes at `position`, or errs (EOF counts as an error). */
async function readRange(handle: FileHandle, position: number, length: number): Promise<Result<Buffer>> {
    const buffer = Buffer.alloc(length);
    let total = 0;
    for (let i = 0; i < MAX_READ_CALLS && total < length; i++) {
        const { bytesRead } = await handle.read(buffer, total, length - total, position + total);
        /* v8 ignore next 3 -- EOF mid-read only occurs if the file shrinks concurrently */
        if (bytesRead === 0) {
            return err(new Error(`unexpected EOF at offset ${String(position + total)}`));
        }
        total += bytesRead;
    }
    /* v8 ignore next 3 -- unreachable: the loop errs on EOF and otherwise fills the buffer */
    if (total < length) {
        return err(new Error(`short read at offset ${String(position)}`));
    }
    return ok(buffer);
}

/** Returns an error when the deadline passed or the signal aborted, undefined otherwise. */
function checkAbort(guard: Guard): Error | undefined {
    if (guard.signal?.aborted === true) {
        return new Error('aborted');
    }
    if (Date.now() > guard.deadline) {
        return new Error(`timed out after ${String(guard.timeoutMs)}ms`);
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Head discovery (delegated to the fork's parseHeadAsync)
// ---------------------------------------------------------------------------

/** VR resolver for implicit transfer syntaxes, backed by the tag dictionary (core Tag form). */
function coreVrLookup(tag: number): string | undefined {
    return lookupTag(tag.toString(16).padStart(8, '0'))?.vr;
}

/** Runs the fork's head walk over a file handle. */
async function discoverHead(handle: FileHandle, fileSize: number): Promise<HeadResult> {
    const reader: RangeReader = {
        size: fileSize,
        read: async (offset: number, length: number): Promise<Uint8Array> => {
            const want = Math.min(length, fileSize - offset);
            if (want <= 0) {
                return new Uint8Array(0);
            }
            const result = await readRange(handle, offset, want);
            if (!result.ok) {
                throw result.error;
            }
            return result.value;
        },
    };
    return parseHeadAsync(reader, { vrLookup: coreVrLookup });
}

/**
 * Whether the head result supports safe elision, or the whole file must be
 * read. Truncated files must fall back so the full path owns the (identical)
 * clamp-and-warn behavior; a head that skipped nothing has no elision to do.
 */
function headUsable(head: HeadResult): boolean {
    if (!head.ok || head.error !== undefined || head.bulk.size === 0) {
        return false;
    }
    return !head.warnings.some(w => w.code === 'unexpected-eof');
}

// ---------------------------------------------------------------------------
// Synthetic-buffer assembly
// ---------------------------------------------------------------------------

/** A header patch to apply after concatenation (offsets in the assembled buffer). */
interface Patch {
    /** Position of the 4-byte length field of a skipped element. */
    readonly lengthFieldPos: number;
    /** Rewrite the VR bytes (at lengthFieldPos - 4) to OB — encapsulated normalization. */
    readonly forceObVr: boolean;
}

/**
 * Assembles the synthetic buffer: all file bytes except the bulk value ranges,
 * with each skipped element's length field zeroed. Bulk VRs always use a
 * 4-byte length field (long-form explicit or implicit), so the field sits in
 * the 4 bytes before the value. Encapsulated pixel data additionally gets its
 * VR normalized to OB, matching the full parse's fragment handling.
 */
async function assemble(handle: FileHandle, fileSize: number, head: HeadResult, guard: Guard): Promise<Result<Buffer>> {
    const explicitVr = head.transferSyntax !== TS_IMPLICIT_LE;
    const ranges = [...head.bulk.values()].sort((a, b) => a.offset - b.offset);
    const parts: Buffer[] = [];
    const patches: Patch[] = [];
    let filePos = 0;
    let skipped = 0;
    for (const range of ranges) {
        const abort = checkAbort(guard);
        if (abort !== undefined) {
            return err(abort);
        }
        const keep = await readRange(handle, filePos, range.offset - filePos);
        if (!keep.ok) {
            return err(keep.error);
        }
        parts.push(keep.value);
        patches.push({ lengthFieldPos: range.offset - skipped - 4, forceObVr: explicitVr && range.encapsulated === true });
        filePos = range.offset + range.length;
        skipped += range.length;
    }
    const tail = await readRange(handle, filePos, fileSize - filePos);
    if (!tail.ok) {
        return err(tail.error);
    }
    parts.push(tail.value);
    const assembled = Buffer.concat(parts);
    for (const patch of patches) {
        assembled.writeUInt32LE(0, patch.lengthFieldPos); // four zero bytes — endian-neutral
        if (patch.forceObVr) {
            assembled.write('OB', patch.lengthFieldPos - 4, 'latin1');
        }
    }
    return ok(assembled);
}

/**
 * Detects the rare defined-length encapsulated pixel data (compressed transfer
 * syntax, defined length, value starting with an item tag): the full parse
 * scans its item structure, which elision would hide — those files fall back.
 */
async function hasDefinedLengthEncapsulation(handle: FileHandle, head: HeadResult): Promise<boolean> {
    if (NATIVE_TRANSFER_SYNTAXES.has(head.transferSyntax)) {
        return false;
    }
    for (const [tag, range] of head.bulk) {
        if (tag !== TAG_PIXEL_DATA || range.encapsulated === true || range.length < 4) {
            continue;
        }
        const probe = await readRange(handle, range.offset, 4);
        if (probe.ok && probe.value.readUInt16LE(0) === 0xfffe && probe.value.readUInt16LE(2) === 0xe000) {
            return true;
        }
    }
    return false;
}

/**
 * Strictly validates an encapsulated range's fragment chain: every item must be
 * a defined-length (FFFE,E000) item and the chain must end with the sequence
 * delimiter exactly at the range end. The fork's hop tolerates malformed item
 * streams that the full parse rejects (fork #67) — a file failing this check
 * falls back to a whole read so its error behavior matches a full parse.
 */
async function isValidFragmentChain(handle: FileHandle, range: { readonly offset: number; readonly length: number }): Promise<boolean> {
    const end = range.offset + range.length;
    let at = range.offset;
    for (let i = 0; i < MAX_FRAGMENT_HOPS; i++) {
        if (at + 8 > end) {
            return false;
        }
        const headerResult = await readRange(handle, at, 8);
        if (!headerResult.ok) {
            /* v8 ignore next -- reads inside a fork-measured range cannot fail without concurrent mutation */
            return false;
        }
        const group = headerResult.value.readUInt16LE(0);
        const elementNum = headerResult.value.readUInt16LE(2);
        const itemLength = headerResult.value.readUInt32LE(4);
        if (group !== 0xfffe) {
            return false;
        }
        if (elementNum === 0xe0dd) {
            return at + 8 === end && itemLength === 0;
        }
        if (elementNum !== 0xe000 || itemLength === UNDEFINED_LENGTH) {
            return false;
        }
        at += 8 + itemLength;
    }
    /* v8 ignore next -- requires >100k fragments in one element */
    return false;
}

/** Validates every encapsulated bulk range; any malformed chain forces a whole read. */
async function encapsulatedRangesValid(handle: FileHandle, head: HeadResult): Promise<boolean> {
    for (const range of head.bulk.values()) {
        if (range.encapsulated === true && !(await isValidFragmentChain(handle, range))) {
            return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Reads the whole file through the open handle. */
async function readWhole(handle: FileHandle, fileSize: number, guard: Guard): Promise<Result<Buffer>> {
    const abort = checkAbort(guard);
    if (abort !== undefined) {
        return err(abort);
    }
    return readRange(handle, 0, fileSize);
}

/** Discovery + safety checks: the head result, or undefined when elision must not be used. */
async function usableHead(handle: FileHandle, fileSize: number): Promise<HeadResult | undefined> {
    let head: HeadResult;
    try {
        head = await discoverHead(handle, fileSize);
    } catch {
        return undefined;
    }
    if (!headUsable(head) || (await hasDefinedLengthEncapsulation(handle, head)) || !(await encapsulatedRangesValid(handle, head))) {
        return undefined;
    }
    return head;
}

/** Bounded read implementation once the file handle is open. */
async function readWithHandle(handle: FileHandle, options: BoundedReadOptions): Promise<Result<Buffer>> {
    const fileSize = (await handle.stat()).size;
    const guard: Guard = { deadline: Date.now() + options.timeoutMs, timeoutMs: options.timeoutMs, signal: options.signal };
    const threshold = options.thresholdBytes ?? BOUNDED_READ_THRESHOLD_BYTES;
    const abort = checkAbort(guard);
    if (abort !== undefined) {
        return err(abort);
    }
    if (fileSize <= threshold) {
        return readWhole(handle, fileSize, guard);
    }
    const head = await usableHead(handle, fileSize);
    if (head === undefined) {
        return readWhole(handle, fileSize, guard);
    }
    const assembled = await assemble(handle, fileSize, head, guard);
    if (!assembled.ok) {
        if (assembled.error.message.startsWith('aborted') || assembled.error.message.startsWith('timed out')) {
            return err(assembled.error);
        }
        /* v8 ignore next 2 -- IO failures mid-assembly require concurrent file mutation */
        return readWhole(handle, fileSize, guard);
    }
    return assembled;
}

/**
 * Reads a DICOM Part-10 file for JSON conversion, skipping bulk value bytes.
 *
 * Returns either the whole file or a well-formed synthetic buffer in which
 * skipped bulk elements have zero length — the parse output is identical
 * either way, since bulk VRs are always emitted as bare `{ vr }`.
 *
 * @param inputPath - Path to the DICOM file
 * @param options - Timeout, abort, and size tuning options
 * @returns A Result with the buffer to parse
 */
async function readDicomHead(inputPath: string, options: BoundedReadOptions): Promise<Result<Buffer>> {
    let handle: FileHandle;
    try {
        handle = await open(inputPath, 'r');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(new Error(`failed to read '${inputPath}': ${message}`));
    }
    try {
        const result = await readWithHandle(handle, options);
        if (result.ok) {
            return result;
        }
        return err(new Error(`reading '${inputPath}' failed: ${result.error.message}`));
        /* v8 ignore next 4 -- all internal paths return Results; this guards unexpected throws */
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return err(new Error(`failed to read '${inputPath}': ${message}`));
    } finally {
        await handle.close();
    }
}

export { readDicomHead };
export type { BoundedReadOptions };
