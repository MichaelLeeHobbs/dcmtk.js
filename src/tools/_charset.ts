/**
 * DICOM character set decoding for the pure-JS parser.
 *
 * Maps SpecificCharacterSet (0008,0005) defined terms to JavaScript decoders
 * and decodes raw element bytes into JS strings, including ISO 2022 code
 * extensions (escape-sequence switching) for the common CJK cases:
 * Japanese (ISO 2022 IR 13/87), Korean (ISO 2022 IR 149), and
 * Chinese (ISO 2022 IR 58).
 *
 * Values are decoded to full strings first; multi-value and person-name
 * splitting happens on the decoded string, which avoids delimiter-byte
 * collisions inside multi-byte encodings (e.g. 0x5C as a trailing byte
 * in GBK/Shift_JIS/JIS X 0208 sequences).
 *
 * @module _charset
 * @internal
 */

import type { Result } from '../types';
import { ok, err } from '../types';

/** How to decode a run of bytes. */
type SegmentDecoder =
    /** ISO-8859-1: every byte maps to U+00xx. Also used for ASCII. */
    | { readonly kind: 'latin1' }
    /** A WHATWG TextDecoder label (e.g. 'iso-8859-5', 'utf-8', 'euc-kr'). */
    | { readonly kind: 'label'; readonly label: string }
    /** JIS X 0208 two-byte GL codes: re-wrapped with its ISO 2022 escape and decoded as iso-2022-jp. */
    | { readonly kind: 'iso2022jp'; readonly escape: readonly number[] }
    /** JIS X 0201 katakana (GR single-byte, 0xA1-0xDF): decoded as shift_jis. */
    | { readonly kind: 'katakana' };

const LATIN1: SegmentDecoder = { kind: 'latin1' };

/** Builds a label decoder. */
function label(name: string): SegmentDecoder {
    return { kind: 'label', label: name };
}

/**
 * Single-byte and non-extension charsets: DICOM defined term → decoder.
 * WHATWG maps some ISO labels to their Windows supersets (e.g. iso-8859-9 →
 * windows-1254); the differences are confined to the C1 control range
 * 0x80-0x9F, which DICOM text does not use.
 */
const CHARSET_DECODERS: Readonly<Record<string, SegmentDecoder>> = {
    'ISO_IR 6': LATIN1,
    'ISO_IR 100': LATIN1,
    'ISO_IR 101': label('iso-8859-2'),
    'ISO_IR 109': label('iso-8859-3'),
    'ISO_IR 110': label('iso-8859-4'),
    'ISO_IR 144': label('iso-8859-5'),
    'ISO_IR 127': label('iso-8859-6'),
    'ISO_IR 126': label('iso-8859-7'),
    'ISO_IR 138': label('iso-8859-8'),
    'ISO_IR 148': label('iso-8859-9'),
    'ISO_IR 203': label('iso-8859-15'),
    'ISO_IR 13': label('shift_jis'),
    'ISO_IR 166': label('windows-874'),
    'ISO_IR 192': label('utf-8'),
    GB18030: label('gb18030'),
    GBK: label('gbk'),
};

/**
 * Initial decoder for ISO 2022 charsets (before any escape sequence).
 * Terms designating multi-byte G0 sets (IR 87/159) start in ASCII — the
 * multi-byte set is only active after its escape sequence.
 */
const ISO2022_INITIAL: Readonly<Record<string, SegmentDecoder>> = {
    'ISO 2022 IR 6': LATIN1,
    'ISO 2022 IR 13': label('shift_jis'),
    'ISO 2022 IR 87': LATIN1,
    'ISO 2022 IR 159': LATIN1,
    'ISO 2022 IR 149': label('euc-kr'),
    'ISO 2022 IR 58': label('gbk'),
    'ISO 2022 IR 100': LATIN1,
    'ISO 2022 IR 101': label('iso-8859-2'),
    'ISO 2022 IR 109': label('iso-8859-3'),
    'ISO 2022 IR 110': label('iso-8859-4'),
    'ISO 2022 IR 144': label('iso-8859-5'),
    'ISO 2022 IR 127': label('iso-8859-6'),
    'ISO 2022 IR 126': label('iso-8859-7'),
    'ISO 2022 IR 138': label('iso-8859-8'),
    'ISO 2022 IR 148': label('iso-8859-9'),
    'ISO 2022 IR 166': label('windows-874'),
    'ISO 2022 IR 203': label('iso-8859-15'),
};

/**
 * ISO 2022 escape sequences (bytes after ESC, as a string key) → decoder
 * for the following run. Per DICOM PS3.5 Table 6.3-1.
 */
const ESCAPE_DECODERS: Readonly<Record<string, SegmentDecoder>> = {
    '(B': LATIN1, // G0 = ASCII
    '(J': LATIN1, // G0 = JIS X 0201 romaji
    ')I': { kind: 'katakana' }, // G1 = JIS X 0201 katakana
    '$@': { kind: 'iso2022jp', escape: [0x1b, 0x24, 0x40] }, // G0 = JIS X 0208-1978
    $B: { kind: 'iso2022jp', escape: [0x1b, 0x24, 0x42] }, // G0 = JIS X 0208
    '$(D': { kind: 'iso2022jp', escape: [0x1b, 0x24, 0x28, 0x44] }, // G0 = JIS X 0212
    '$)C': label('euc-kr'), // G1 = KS X 1001
    '$)A': label('gbk'), // G1 = GB 2312
    '-A': LATIN1, // G1 = ISO-8859-1
    '-B': label('iso-8859-2'),
    '-C': label('iso-8859-3'),
    '-D': label('iso-8859-4'),
    '-F': label('iso-8859-7'),
    '-G': label('iso-8859-6'),
    '-H': label('iso-8859-8'),
    '-L': label('iso-8859-5'),
    '-M': label('iso-8859-9'),
    '-T': label('windows-874'),
    '-b': label('iso-8859-15'),
};

/** Aliases accepted for charsetAssume/charsetFallback (lowercased) → DICOM defined term. */
const CHARSET_ALIASES: Readonly<Record<string, string>> = {
    ascii: 'ISO_IR 6',
    'latin-1': 'ISO_IR 100',
    latin1: 'ISO_IR 100',
    'iso-8859-1': 'ISO_IR 100',
    'latin-2': 'ISO_IR 101',
    'latin-3': 'ISO_IR 109',
    'latin-4': 'ISO_IR 110',
    'latin-5': 'ISO_IR 148',
    'latin-9': 'ISO_IR 203',
    cyrillic: 'ISO_IR 144',
    arabic: 'ISO_IR 127',
    greek: 'ISO_IR 126',
    hebrew: 'ISO_IR 138',
    thai: 'ISO_IR 166',
    'shift-jis': 'ISO_IR 13',
    shift_jis: 'ISO_IR 13',
    'utf-8': 'ISO_IR 192',
    utf8: 'ISO_IR 192',
    gb18030: 'GB18030',
    gbk: 'GBK',
};

/** Cache of TextDecoder instances by label ('' = construction failed). */
const decoderCache = new Map<string, TextDecoder | undefined>();

/** Returns a cached TextDecoder for a label, or undefined if unsupported. */
function getTextDecoder(labelName: string): TextDecoder | undefined {
    if (decoderCache.has(labelName)) {
        return decoderCache.get(labelName);
    }
    let decoder: TextDecoder | undefined;
    try {
        decoder = new TextDecoder(labelName);
    } catch {
        decoder = undefined;
    }
    decoderCache.set(labelName, decoder);
    return decoder;
}

/** Decodes bytes as ISO-8859-1 (every byte → U+00xx). */
function decodeLatin1(bytes: Uint8Array): string {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('latin1');
}

/** Decodes a single run of bytes with the given segment decoder. */
function decodeSegment(bytes: Uint8Array, decoder: SegmentDecoder): string {
    if (bytes.length === 0) return '';
    switch (decoder.kind) {
        case 'latin1':
            return decodeLatin1(bytes);
        case 'label': {
            const td = getTextDecoder(decoder.label);
            /* v8 ignore next -- labels in the tables are validated by resolveCharsets */
            if (td === undefined) return decodeLatin1(bytes);
            return td.decode(bytes);
        }
        case 'iso2022jp': {
            const td = getTextDecoder('iso-2022-jp');
            /* v8 ignore next -- iso-2022-jp is always available in Node with ICU */
            if (td === undefined) return decodeLatin1(bytes);
            const wrapped = new Uint8Array(decoder.escape.length + bytes.length);
            wrapped.set(decoder.escape, 0);
            wrapped.set(bytes, decoder.escape.length);
            return td.decode(wrapped);
        }
        case 'katakana': {
            const td = getTextDecoder('shift_jis');
            /* v8 ignore next -- shift_jis is always available in Node with ICU */
            if (td === undefined) return decodeLatin1(bytes);
            return td.decode(bytes);
        }
    }
}

/** A recognized ISO 2022 escape sequence within a byte run. */
interface EscapeMatch {
    /** The bytes after ESC as a string key into ESCAPE_DECODERS. */
    readonly key: string;
    /** Total length of the escape sequence including the ESC byte. */
    readonly length: number;
}

/**
 * Reads an ISO 2022 escape sequence starting at `start` (which must point at
 * an ESC byte). Intermediate bytes are 0x20-0x2F, the final byte 0x30-0x7E.
 */
function readEscape(bytes: Uint8Array, start: number): EscapeMatch {
    let i = start + 1;
    while (i < bytes.length && (bytes[i] as number) >= 0x20 && (bytes[i] as number) <= 0x2f) {
        i++;
    }
    if (i < bytes.length && (bytes[i] as number) >= 0x30 && (bytes[i] as number) <= 0x7e) {
        i++;
    }
    const seq = bytes.subarray(start + 1, i);
    return { key: decodeLatin1(seq), length: i - start };
}

/**
 * Decodes a byte run containing ISO 2022 escape sequences. Each escape
 * switches the decoder for the following segment; unrecognized escapes
 * leave the current decoder active.
 */
function decodeIso2022(bytes: Uint8Array, initial: SegmentDecoder): string {
    let out = '';
    let current = initial;
    let segStart = 0;
    let i = 0;
    while (i < bytes.length) {
        if (bytes[i] !== 0x1b) {
            i++;
            continue;
        }
        out += decodeSegment(bytes.subarray(segStart, i), current);
        const esc = readEscape(bytes, i);
        current = ESCAPE_DECODERS[esc.key] ?? current;
        i += esc.length;
        segStart = i;
    }
    out += decodeSegment(bytes.subarray(segStart), current);
    return out;
}

/** A resolved character-set configuration for one dataset. */
interface CharsetContext {
    /** The normalized charset terms (first value of 0008,0005 first). */
    readonly terms: readonly string[];
    /** Whether ISO 2022 escape processing applies. */
    readonly iso2022: boolean;
    /** Decoder for non-2022 charsets, or the initial decoder for ISO 2022. */
    readonly initial: SegmentDecoder;
}

/** The default context (ISO_IR 6 / ASCII). */
const DEFAULT_CONTEXT: CharsetContext = { terms: ['ISO_IR 6'], iso2022: false, initial: LATIN1 };

/** Normalizes a user-supplied charset name (alias or defined term) to a defined term, or undefined. */
function normalizeCharsetName(input: string): string | undefined {
    const trimmed = input.trim();
    if (CHARSET_DECODERS[trimmed] !== undefined || ISO2022_INITIAL[trimmed] !== undefined) {
        return trimmed;
    }
    return CHARSET_ALIASES[trimmed.toLowerCase()];
}

/** Builds a context from validated terms. */
function buildContext(terms: readonly string[]): CharsetContext | undefined {
    const iso2022 = terms.length > 1 || terms.some(t => t.startsWith('ISO 2022'));
    const first = terms[0] ?? 'ISO_IR 6';
    const initial = iso2022 ? ISO2022_INITIAL[first] : CHARSET_DECODERS[first];
    if (initial === undefined) return undefined;
    return { terms, iso2022, initial };
}

/** Parses raw SpecificCharacterSet values into normalized terms. An empty first value means the default repertoire. */
function parseSpecificCharacterSet(raw: string): string[] {
    const values = raw.split('\\').map(v => v.trim());
    return values.map((v, idx) => (v === '' && idx === 0 ? 'ISO 2022 IR 6' : v)).filter(v => v !== '');
}

/** Resolves a context from terms, falling back per configuration. */
function contextFromTerms(terms: readonly string[], fallback: string | undefined, source: string): Result<CharsetContext> {
    const context = buildContext(terms);
    if (context !== undefined) {
        return ok(context);
    }
    if (fallback !== undefined) {
        const fallbackTerm = normalizeCharsetName(fallback);
        const fallbackContext = fallbackTerm !== undefined ? buildContext([fallbackTerm]) : undefined;
        if (fallbackContext !== undefined) {
            return ok(fallbackContext);
        }
        return err(new Error(`Unsupported charset fallback '${fallback}' (while handling unsupported ${source})`));
    }
    return err(new Error(`Unsupported character set: ${source} — provide charsetFallback (e.g. 'latin-1') to decode best-effort`));
}

/**
 * Resolves the character-set context for a dataset.
 *
 * @param specificCharacterSet - Raw SpecificCharacterSet (0008,0005) value, or undefined if absent
 * @param charsetAssume - Charset to assume when 0008,0005 is absent (alias or defined term)
 * @param charsetFallback - Charset to use when the specified charset is unsupported
 * @returns A Result with the resolved context
 */
function resolveCharsetContext(specificCharacterSet: string | undefined, charsetAssume?: string, charsetFallback?: string): Result<CharsetContext> {
    if (specificCharacterSet === undefined || specificCharacterSet.trim() === '') {
        if (charsetAssume === undefined) {
            return ok(DEFAULT_CONTEXT);
        }
        const term = normalizeCharsetName(charsetAssume);
        if (term === undefined) {
            return contextFromTerms([charsetAssume], charsetFallback, `charsetAssume '${charsetAssume}'`);
        }
        return contextFromTerms([term], charsetFallback, `charsetAssume '${charsetAssume}'`);
    }
    const terms = parseSpecificCharacterSet(specificCharacterSet);
    return contextFromTerms(terms, charsetFallback, `'${specificCharacterSet}' (0008,0005)`);
}

/**
 * Decodes raw DICOM text bytes using the resolved character-set context.
 * Multi-value / person-name splitting must be done on the returned string.
 *
 * @param bytes - The raw value bytes
 * @param context - The context from {@link resolveCharsetContext}
 * @returns The decoded string
 */
function decodeDicomText(bytes: Uint8Array, context: CharsetContext): string {
    if (context.iso2022) {
        return decodeIso2022(bytes, context.initial);
    }
    return decodeSegment(bytes, context.initial);
}

export { resolveCharsetContext, decodeDicomText, normalizeCharsetName, DEFAULT_CONTEXT };
export type { CharsetContext };
