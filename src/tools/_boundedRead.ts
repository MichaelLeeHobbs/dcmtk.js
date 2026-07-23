/**
 * Bounded head-read for the pure-JS DICOM parser (#35).
 *
 * `dicom2json` only ever emits bare `{ vr }` for bulk binary VRs, and DICOM
 * elements are stored in ascending tag order — so for large files the bulk of
 * the bytes (PixelData and friends) are read and then discarded. This module
 * reads only what the JSON Model actually needs: it reads the file in chunks,
 * probes each chunk with `dicom-parser`, and when the parse stops inside a
 * bulk-VR value it rewrites that element's length to zero in the assembled
 * buffer and resumes reading after the value. The result is a well-formed
 * synthetic Part-10 buffer whose parse output is identical to the full file's
 * — with peak memory proportional to the metadata, not the file.
 *
 * Correctness rules:
 * - A skip happens ONLY when the stall point is provably a bulk-VR element
 *   (defined length, or undefined-length OB/OW encapsulated pixel data whose
 *   fragments are hopped via 8-byte header reads). Every ambiguous case grows
 *   the buffer instead, degrading to a full read.
 * - A successful probe is accepted ONLY once the entire file has been
 *   consumed (read or skipped) — a parse that happens to succeed on a
 *   truncated buffer is never trusted.
 * - Deflated transfer syntax, files at or below the size threshold, and any
 *   structural surprise fall back to reading the whole file.
 *
 * @module _boundedRead
 * @internal
 */

import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import dicomParser from 'dicom-parser';
import type { DataSet, Element } from 'dicom-parser';
import type { Result } from '../types';
import { ok, err } from '../types';
import { BOUNDED_READ_CHUNK_BYTES, BOUNDED_READ_THRESHOLD_BYTES } from '../constants';
import { implicitVrLookup } from './_p10ToJson';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TS_IMPLICIT_LE = '1.2.840.10008.1.2';
const TS_EXPLICIT_BE = '1.2.840.10008.1.2.2';
const TS_DEFLATED_LE = '1.2.840.10008.1.2.1.99';

/** VRs whose values the converter never loads (bare `{ vr }` output). */
const BULK_VRS = new Set(['OB', 'OW', 'OD', 'OF', 'OL', 'OV', 'UN']);

/** VRs encoded with the 12-byte (long) explicit header form. */
const LONG_FORM_VRS = new Set(['OB', 'OW', 'OF', 'OD', 'OL', 'OV', 'SQ', 'UC', 'UR', 'UT', 'UN', 'SV', 'UV']);

const UNDEFINED_LENGTH = 0xffffffff;

/** Longest element header (explicit long form). */
const MAX_HEADER_BYTES = 12;

/** Bound on skip/grow iterations per file (Rule 8.1). */
const MAX_ITERATIONS = 10_000;

/** Bound on encapsulated fragment hops per element (Rule 8.1). */
const MAX_FRAGMENT_HOPS = 100_000;

/** Bound on single-read retries when the OS returns short reads (Rule 8.1). */
const MAX_READ_CALLS = 10_000;

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
    /** Initial/incremental chunk size. Defaults to {@link BOUNDED_READ_CHUNK_BYTES}. */
    readonly chunkBytes?: number | undefined;
}

/** Mutable state of one bounded read. */
interface ReadState {
    readonly handle: FileHandle;
    readonly fileSize: number;
    readonly chunkBytes: number;
    readonly explicitVr: boolean;
    readonly bigEndian: boolean;
    readonly metaEnd: number;
    readonly deadline: number;
    readonly signal: AbortSignal | undefined;
    /** The synthetic buffer: file bytes read so far, minus skipped bulk values (their headers rewritten to length 0). */
    assembled: Buffer;
    /** Next unread file offset. Invariant: filePos - assembled.length = total bytes skipped. */
    filePos: number;
    /** Bytes to append on the next grow (doubles on consecutive grows). */
    growSize: number;
}

/** A parsed element header at a stall point. */
interface ElementHeader {
    /** Tag as 8 lowercase hex chars ('7fe00010'). */
    readonly tag: string;
    readonly vr: string;
    readonly length: number;
    readonly headerLen: number;
    /** Offset of the length field within the header (for rewriting). */
    readonly lengthOffset: number;
}

/** What to do after a probe. */
type ProbeAction =
    | { readonly kind: 'done' }
    | { readonly kind: 'fullRead' }
    | { readonly kind: 'grow' }
    | { readonly kind: 'skipDefined'; readonly headerEnd: number; readonly valueLength: number }
    | { readonly kind: 'skipEncapsulated'; readonly headerStart: number; readonly headerEnd: number };

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
function checkAbort(state: Pick<ReadState, 'deadline' | 'signal'>): Error | undefined {
    if (state.signal?.aborted === true) {
        return new Error('aborted');
    }
    if (Date.now() > state.deadline) {
        return new Error('timed out');
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Meta probe
// ---------------------------------------------------------------------------

/** Minimal typing for dicom-parser's untyped readPart10Header export. */
interface MetaHeader {
    readonly position?: number;
    readonly elements: Record<string, Element | undefined>;
}

const readPart10Header = (dicomParser as unknown as { readPart10Header: (byteArray: Uint8Array) => MetaHeader }).readPart10Header;

/** Parsed file meta info needed to drive the bounded read. */
interface MetaInfo {
    readonly metaEnd: number;
    readonly transferSyntax: string;
}

/** Reads the file meta group from the head chunk. Returns undefined on any surprise (caller falls back to a full read). */
function probeMeta(head: Buffer): MetaInfo | undefined {
    let meta: MetaHeader;
    try {
        meta = readPart10Header(head);
    } catch {
        return undefined;
    }
    const tsElement = meta.elements['x00020010'];
    if (meta.position === undefined || tsElement === undefined) {
        return undefined;
    }
    const transferSyntax = head
        .subarray(tsElement.dataOffset, tsElement.dataOffset + tsElement.length)
        .toString('latin1')
        .replace(/[\0 ]+$/u, '');
    return { metaEnd: meta.position, transferSyntax };
}

// ---------------------------------------------------------------------------
// Probe + decision
// ---------------------------------------------------------------------------

/** Outcome of parsing the assembled buffer with dicom-parser. */
interface ProbeResult {
    readonly dataSet: DataSet | undefined;
    readonly threw: boolean;
}

/** True when the thrown value carries a partially parsed dataset. */
function hasPartialDataSet(e: unknown): e is { readonly dataSet: DataSet } {
    return typeof e === 'object' && e !== null && 'dataSet' in e;
}

/** Parses the assembled buffer, capturing the partial dataset on failure. */
function probeParse(assembled: Buffer): ProbeResult {
    try {
        return { dataSet: dicomParser.parseDicom(assembled, { vrCallback: implicitVrLookup }), threw: false };
    } catch (e: unknown) {
        return { dataSet: hasPartialDataSet(e) ? e.dataSet : undefined, threw: true };
    }
}

/** The element with the largest extent (dataOffset + length), or undefined when empty. */
function maxExtentElement(dataSet: DataSet): Element | undefined {
    let best: Element | undefined;
    let bestEnd = -1;
    for (const key of Object.keys(dataSet.elements)) {
        const element = dataSet.elements[key];
        /* v8 ignore next -- keys come from the object itself */
        if (element === undefined) continue;
        const end = element.dataOffset + element.length;
        if (end > bestEnd) {
            bestEnd = end;
            best = element;
        }
    }
    return best;
}

/** Formats a tag from group/element numbers as 8 lowercase hex chars. */
function formatTag(group: number, elementNum: number): string {
    return group.toString(16).padStart(4, '0') + elementNum.toString(16).padStart(4, '0');
}

/** Reads the element header at `position` in the assembled buffer, or undefined when unparseable. */
function parseElementHeader(assembled: Buffer, position: number, state: Pick<ReadState, 'explicitVr' | 'bigEndian'>): ElementHeader | undefined {
    if (position + MAX_HEADER_BYTES > assembled.length) {
        return undefined;
    }
    if (!state.explicitVr) {
        const tag = formatTag(assembled.readUInt16LE(position), assembled.readUInt16LE(position + 2));
        const vr = implicitVrLookup(`x${tag}`) ?? 'UN';
        return { tag, vr, length: assembled.readUInt32LE(position + 4), headerLen: 8, lengthOffset: 4 };
    }
    const tag = state.bigEndian
        ? formatTag(assembled.readUInt16BE(position), assembled.readUInt16BE(position + 2))
        : formatTag(assembled.readUInt16LE(position), assembled.readUInt16LE(position + 2));
    const vr = assembled.subarray(position + 4, position + 6).toString('latin1');
    if (!/^[A-Z]{2}$/u.test(vr)) {
        return undefined;
    }
    if (LONG_FORM_VRS.has(vr)) {
        const length = state.bigEndian ? assembled.readUInt32BE(position + 8) : assembled.readUInt32LE(position + 8);
        return { tag, vr, length, headerLen: 12, lengthOffset: 8 };
    }
    const length = state.bigEndian ? assembled.readUInt16BE(position + 6) : assembled.readUInt16LE(position + 6);
    return { tag, vr, length, headerLen: 8, lengthOffset: 6 };
}

/**
 * Decision for a probe that threw.
 *
 * Two stall shapes:
 * - the incomplete element was recorded before the "buffer overrun" throw
 *   (defined-length value extending past the buffer) — its extent exceeds the
 *   buffer, so it is resolved like the success case via {@link decideOversized};
 * - the throw happened mid-header, inside sequence items, or inside
 *   encapsulated fragments (element not recorded) — the stall element's header
 *   sits at the end of the last recorded element, so it is parsed from there.
 */
function decideAfterThrow(probe: ProbeResult, state: ReadState): ProbeAction {
    if (state.filePos >= state.fileSize) {
        return { kind: 'fullRead' };
    }
    /* v8 ignore next 3 -- parse failures before the data set starts cannot occur once probeMeta succeeded */
    if (probe.dataSet === undefined) {
        return { kind: 'grow' };
    }
    const last = maxExtentElement(probe.dataSet);
    const maxEnd = last === undefined ? state.metaEnd : last.dataOffset + last.length;
    if (last !== undefined && maxEnd > state.assembled.length) {
        return decideOversized(last, last.hadUndefinedLength === true, state);
    }
    const header = parseElementHeader(state.assembled, maxEnd, state);
    if (header === undefined) {
        return { kind: 'grow' };
    }
    return decideWithHeader(state, maxEnd, header, header.length === UNDEFINED_LENGTH);
}

/**
 * Final skip/grow decision once a stall element's header is known.
 *
 * Undefined-length hopping is restricted to explicit little-endian PixelData
 * (7FE0,0010) — the only element the full parse treats as encapsulated
 * fragments and normalizes to OB. Any other undefined-length element grows,
 * so its parse (and output VR) stays byte-identical to the full path.
 */
function decideWithHeader(state: ReadState, position: number, header: ElementHeader, undefinedLength: boolean): ProbeAction {
    if (undefinedLength) {
        if (header.tag === '7fe00010' && (header.vr === 'OB' || header.vr === 'OW') && state.explicitVr && !state.bigEndian) {
            rewriteHeader(state.assembled, position, header, true);
            return { kind: 'skipEncapsulated', headerStart: position, headerEnd: position + header.headerLen };
        }
        return { kind: 'grow' };
    }
    if (BULK_VRS.has(header.vr)) {
        return rewriteAndSkip(state, position, header);
    }
    return { kind: 'grow' };
}

/**
 * Rewrites the length field of the header at `position` to zero (zero is
 * endianness-neutral). `forceObVr` additionally rewrites the VR bytes to OB —
 * used for encapsulated skips so the output matches the full parse, which
 * normalizes encapsulated pixel data to OB (PS3.5 A.4).
 */
function rewriteHeader(assembled: Buffer, position: number, header: ElementHeader, forceObVr: boolean): void {
    /* v8 ignore next 3 -- short-form VRs are never bulk, so skips only rewrite 4-byte lengths */
    if (header.lengthOffset === 6) {
        assembled.writeUInt16LE(0, position + header.lengthOffset);
    } else {
        assembled.writeUInt32LE(0, position + header.lengthOffset);
    }
    if (forceObVr) {
        assembled.write('OB', position + 4, 'latin1');
    }
}

/** Zeroes the header length and returns the defined-length skip action. */
function rewriteAndSkip(state: ReadState, position: number, header: ElementHeader): ProbeAction {
    rewriteHeader(state.assembled, position, header, false);
    return { kind: 'skipDefined', headerEnd: position + header.headerLen, valueLength: header.length };
}

/**
 * Decision for a probe that parsed cleanly.
 *
 * A clean parse of a partial buffer happens in two shapes:
 * - an oversized defined-length value: dicom-parser seeks past the end
 *   without error, leaving the last element's extent beyond the buffer;
 * - a silently truncated undefined-length value: its length is clamped to
 *   the buffer end. This is indistinguishable from a delimiter landing
 *   exactly on the chunk boundary — both resolve identically, because the
 *   fragment hop re-walks the item chain in the file and lands on the true
 *   end either way.
 */
function decideAfterSuccess(probe: ProbeResult, state: ReadState): ProbeAction {
    /* v8 ignore next -- a clean parse always has a dataset */
    if (probe.dataSet === undefined) return { kind: 'fullRead' };
    const last = maxExtentElement(probe.dataSet);
    const maxEnd = last === undefined ? state.metaEnd : last.dataOffset + last.length;
    const undefinedAtEnd = last?.hadUndefinedLength === true && maxEnd >= state.assembled.length;
    if (state.filePos >= state.fileSize) {
        // Whole file consumed. If maxEnd still exceeds the buffer the file
        // itself ends mid-value; the assembled buffer then matches what a
        // full read would contain, so the normal path handles it identically.
        return { kind: 'done' };
    }
    if (maxEnd <= state.assembled.length && !undefinedAtEnd) {
        return { kind: 'grow' };
    }
    /* v8 ignore next -- maxEnd > length implies an element exists */
    if (last === undefined) return { kind: 'grow' };
    return decideOversized(last, undefinedAtEnd, state);
}

/** Decision for a completed-probe element that extends to or beyond the buffer end. */
function decideOversized(last: Element, undefinedAtEnd: boolean, state: ReadState): ProbeAction {
    const headerStart = findHeaderStart(state.assembled, last, state);
    if (headerStart === undefined) {
        return { kind: 'grow' };
    }
    const header = parseElementHeader(state.assembled, headerStart, state);
    /* v8 ignore next -- the same header already parsed via dicom-parser */
    if (header === undefined) return { kind: 'grow' };
    /* v8 ignore next 3 -- defensive cross-check: both lengths come from the same header bytes */
    if (!undefinedAtEnd && header.length !== last.length) {
        return { kind: 'grow' };
    }
    return decideWithHeader(state, headerStart, header, undefinedAtEnd);
}

/** Locates the header start of an element from its value offset, validating the round trip. */
function findHeaderStart(assembled: Buffer, element: Element, state: Pick<ReadState, 'explicitVr' | 'bigEndian'>): number | undefined {
    const candidates = state.explicitVr ? [12, 8] : [8];
    for (const headerLen of candidates) {
        const start = element.dataOffset - headerLen;
        if (start < 0) continue;
        const header = parseElementHeader(assembled, start, state);
        if (header !== undefined && header.headerLen === headerLen) {
            return start;
        }
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Skip application
// ---------------------------------------------------------------------------

/** File offset corresponding to a position in the assembled buffer's tail region. */
function fileOffsetOf(state: ReadState, assembledPos: number): number {
    return state.filePos - (state.assembled.length - assembledPos);
}

/**
 * Truncates the assembled buffer after a skipped element's header and
 * repositions the file cursor. Errs when the declared value extends beyond
 * EOF — the file is truncated, and the full-read path must handle it so the
 * error behavior matches a full parse exactly.
 */
function applyDefinedSkip(state: ReadState, headerEnd: number, valueLength: number): Result<void> {
    const valueStartInFile = fileOffsetOf(state, headerEnd);
    if (valueStartInFile + valueLength > state.fileSize) {
        return err(new Error('declared value length extends beyond EOF'));
    }
    state.filePos = valueStartInFile + valueLength;
    state.assembled = state.assembled.subarray(0, headerEnd);
    state.growSize = state.chunkBytes;
    return ok(undefined);
}

/** Hops encapsulated fragments via 8-byte item headers; returns the file offset after the sequence delimiter. */
async function hopFragments(handle: FileHandle, start: number, fileSize: number): Promise<Result<number>> {
    let position = start;
    for (let i = 0; i < MAX_FRAGMENT_HOPS; i++) {
        if (position + 8 > fileSize) {
            return err(new Error('encapsulated data truncated'));
        }
        const headerResult = await readRange(handle, position, 8);
        if (!headerResult.ok) {
            return err(headerResult.error);
        }
        const group = headerResult.value.readUInt16LE(0);
        const elementNum = headerResult.value.readUInt16LE(2);
        const itemLength = headerResult.value.readUInt32LE(4);
        if (group !== 0xfffe) {
            return err(new Error('unexpected tag between fragments'));
        }
        if (elementNum === 0xe0dd) {
            return ok(position + 8);
        }
        if (elementNum !== 0xe000 || itemLength === UNDEFINED_LENGTH) {
            return err(new Error('malformed fragment item'));
        }
        position += 8 + itemLength;
    }
    /* v8 ignore next -- requires >100k fragments in one element */
    return err(new Error('fragment count exceeded bound'));
}

/** Applies an encapsulated skip: hop the fragments in the file, then truncate after the (rewritten) header. */
async function applyEncapsulatedSkip(state: ReadState, headerEnd: number): Promise<Result<void>> {
    const valueStartInFile = fileOffsetOf(state, headerEnd);
    const afterDelimiter = await hopFragments(state.handle, valueStartInFile, state.fileSize);
    if (!afterDelimiter.ok) {
        return err(afterDelimiter.error);
    }
    state.filePos = afterDelimiter.value;
    state.assembled = state.assembled.subarray(0, headerEnd);
    state.growSize = state.chunkBytes;
    return ok(undefined);
}

/** Appends the next chunk of file bytes to the assembled buffer, doubling the grow size. */
async function appendChunk(state: ReadState): Promise<Result<void>> {
    const length = Math.min(state.growSize, state.fileSize - state.filePos);
    /* v8 ignore next 2 -- decision functions never grow when the file is exhausted */
    if (length <= 0) return err(new Error('no bytes left to grow'));
    const chunk = await readRange(state.handle, state.filePos, length);
    if (!chunk.ok) {
        return err(chunk.error);
    }
    state.assembled = Buffer.concat([state.assembled, chunk.value]);
    state.filePos += length;
    state.growSize = Math.min(state.growSize * 2, state.fileSize);
    return ok(undefined);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Applies one decision to the state. 'continue' means probe again; anything else ends the loop. */
async function applyAction(action: ProbeAction, state: ReadState): Promise<'continue' | 'done' | 'fullRead'> {
    switch (action.kind) {
        case 'done':
            return 'done';
        case 'fullRead':
            return 'fullRead';
        case 'grow':
            return (await appendChunk(state)).ok ? 'continue' : 'fullRead';
        case 'skipDefined':
            return applyDefinedSkip(state, action.headerEnd, action.valueLength).ok ? 'continue' : 'fullRead';
        case 'skipEncapsulated':
            return (await applyEncapsulatedSkip(state, action.headerEnd)).ok ? 'continue' : 'fullRead';
    }
}

/** Runs the probe/skip/grow loop until the file is consumed or a fallback is needed. */
async function boundedLoop(state: ReadState): Promise<Result<Buffer> | 'fullRead'> {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const abort = checkAbort(state);
        if (abort !== undefined) {
            return err(abort);
        }
        const probe = probeParse(state.assembled);
        const action = probe.threw ? decideAfterThrow(probe, state) : decideAfterSuccess(probe, state);
        const outcome = await applyAction(action, state);
        if (outcome === 'done') {
            return ok(state.assembled);
        }
        if (outcome === 'fullRead') {
            return 'fullRead';
        }
    }
    /* v8 ignore next -- requires >10k skip/grow rounds in one file */
    return 'fullRead';
}

/** Reads the whole file through the open handle. */
async function readWhole(handle: FileHandle, fileSize: number, state: Pick<ReadState, 'deadline' | 'signal'>): Promise<Result<Buffer>> {
    const abort = checkAbort(state);
    if (abort !== undefined) {
        return err(abort);
    }
    return readRange(handle, 0, fileSize);
}

/** Bounded read implementation once the file handle is open. */
async function readWithHandle(handle: FileHandle, options: BoundedReadOptions): Promise<Result<Buffer>> {
    const fileSize = (await handle.stat()).size;
    const deadline = Date.now() + options.timeoutMs;
    const guard = { deadline, signal: options.signal };
    const threshold = options.thresholdBytes ?? BOUNDED_READ_THRESHOLD_BYTES;
    const chunkBytes = options.chunkBytes ?? BOUNDED_READ_CHUNK_BYTES;
    if (fileSize <= threshold) {
        return readWhole(handle, fileSize, guard);
    }
    const headResult = await readRange(handle, 0, Math.min(chunkBytes, fileSize));
    /* v8 ignore next 3 -- the stat already succeeded; a failing head read implies a concurrent truncation */
    if (!headResult.ok) {
        return err(headResult.error);
    }
    const meta = probeMeta(headResult.value);
    if (meta === undefined || meta.transferSyntax === TS_DEFLATED_LE) {
        return readWhole(handle, fileSize, guard);
    }
    const state: ReadState = {
        handle,
        fileSize,
        chunkBytes,
        explicitVr: meta.transferSyntax !== TS_IMPLICIT_LE,
        bigEndian: meta.transferSyntax === TS_EXPLICIT_BE,
        metaEnd: meta.metaEnd,
        deadline,
        signal: options.signal,
        assembled: headResult.value,
        filePos: headResult.value.length,
        growSize: chunkBytes,
    };
    const result = await boundedLoop(state);
    if (result === 'fullRead') {
        return readWhole(handle, fileSize, guard);
    }
    return result;
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
        return await readWithHandle(handle, options);
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
