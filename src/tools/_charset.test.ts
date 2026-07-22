import { describe, it, expect } from 'vitest';
import { resolveCharsetContext, decodeDicomText, normalizeCharsetName, DEFAULT_CONTEXT } from './_charset';
import type { CharsetContext } from './_charset';

/** Resolves a context or fails the test. */
function ctx(specific: string | undefined, assume?: string, fallback?: string): CharsetContext {
    const result = resolveCharsetContext(specific, assume, fallback);
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    return result.value;
}

/** Decodes a latin1-notated byte string under the given SpecificCharacterSet. */
function decode(specific: string | undefined, byteString: string): string {
    return decodeDicomText(Buffer.from(byteString, 'latin1'), ctx(specific));
}

describe('resolveCharsetContext', () => {
    it('returns the default (ASCII) context when 0008,0005 is absent', () => {
        const result = resolveCharsetContext(undefined);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe(DEFAULT_CONTEXT);
    });

    it('treats an empty/blank 0008,0005 as the default repertoire', () => {
        expect(ctx('').iso2022).toBe(false);
        expect(ctx('  ').terms).toEqual(['ISO_IR 6']);
    });

    it('resolves single-byte charsets', () => {
        expect(ctx('ISO_IR 100').iso2022).toBe(false);
        expect(ctx('ISO_IR 192').terms).toEqual(['ISO_IR 192']);
    });

    it('marks multi-valued and ISO 2022 charsets as iso2022', () => {
        expect(ctx('ISO 2022 IR 6\\ISO 2022 IR 87').iso2022).toBe(true);
        expect(ctx('ISO 2022 IR 149').iso2022).toBe(true);
    });

    it('maps an empty first value to the default repertoire term', () => {
        expect(ctx('\\ISO 2022 IR 149').terms[0]).toBe('ISO 2022 IR 6');
    });

    it('applies charsetAssume only when 0008,0005 is absent', () => {
        expect(ctx(undefined, 'latin-1').terms).toEqual(['ISO_IR 100']);
        expect(ctx('ISO_IR 144', 'latin-1').terms).toEqual(['ISO_IR 144']);
    });

    it('accepts DICOM defined terms and aliases for charsetAssume', () => {
        expect(ctx(undefined, 'ISO_IR 144').terms).toEqual(['ISO_IR 144']);
        expect(ctx(undefined, 'utf-8').terms).toEqual(['ISO_IR 192']);
    });

    it('errors on an unsupported charset without a fallback', () => {
        const result = resolveCharsetContext('ISO_IR 999');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('ISO_IR 999');
    });

    it('uses the fallback for an unsupported charset', () => {
        expect(ctx('ISO_IR 999', undefined, 'latin-1').terms).toEqual(['ISO_IR 100']);
    });

    it('errors on an unsupported charsetAssume without a fallback', () => {
        const result = resolveCharsetContext(undefined, 'klingon');
        expect(result.ok).toBe(false);
    });

    it('falls back when charsetAssume is unsupported', () => {
        expect(ctx(undefined, 'klingon', 'latin-1').terms).toEqual(['ISO_IR 100']);
    });

    it('errors when the fallback itself is unsupported', () => {
        const result = resolveCharsetContext('ISO_IR 999', undefined, 'also-bad');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toContain('also-bad');
    });
});

describe('normalizeCharsetName', () => {
    it('passes through defined terms', () => {
        expect(normalizeCharsetName('ISO_IR 100')).toBe('ISO_IR 100');
        expect(normalizeCharsetName('ISO 2022 IR 87')).toBe('ISO 2022 IR 87');
        expect(normalizeCharsetName('GB18030')).toBe('GB18030');
    });

    it('maps DCMTK-style aliases case-insensitively', () => {
        expect(normalizeCharsetName('Latin-1')).toBe('ISO_IR 100');
        expect(normalizeCharsetName('UTF-8')).toBe('ISO_IR 192');
        expect(normalizeCharsetName('cyrillic')).toBe('ISO_IR 144');
        expect(normalizeCharsetName('shift_jis')).toBe('ISO_IR 13');
    });

    it('returns undefined for unknown names', () => {
        expect(normalizeCharsetName('klingon')).toBeUndefined();
    });
});

describe('decodeDicomText — single-byte charsets', () => {
    it('decodes ASCII / default repertoire', () => {
        expect(decode(undefined, 'Smith^John')).toBe('Smith^John');
    });

    it('decodes ISO_IR 100 (Latin-1)', () => {
        expect(decode('ISO_IR 100', 'M\xfcller^J\xf6rg')).toBe('Müller^Jörg');
    });

    it('decodes ISO_IR 144 (Cyrillic)', () => {
        expect(decode('ISO_IR 144', '\xbb\xee\xda\xe1\xd5\xdc\xd1\xe3\xe0\xd3')).toBe('Люксембург');
    });

    it('decodes ISO_IR 126 (Greek)', () => {
        expect(decode('ISO_IR 126', '\xc4\xe9\xef\xed\xf5\xf3\xe9\xef\xf2')).toBe('Διονυσιος');
    });

    it('decodes ISO_IR 127 (Arabic)', () => {
        expect(decode('ISO_IR 127', '\xe2\xc8\xc7\xe6\xea')).toBe('قباني');
    });

    it('decodes ISO_IR 138 (Hebrew)', () => {
        expect(decode('ISO_IR 138', '\xf9\xf8\xe5\xef^\xe3\xe1\xe5\xf8\xe4')).toBe('שרון^דבורה');
    });

    it('decodes ISO_IR 166 (Thai)', () => {
        expect(decode('ISO_IR 166', '\xb9\xc7\xd1\xb2\xb9\xec')).toBe('นวัฒน์');
    });

    it('decodes ISO_IR 192 (UTF-8)', () => {
        const bytes = Buffer.from('Wang^XiaoDong=王^小东', 'utf8').toString('latin1');
        expect(decode('ISO_IR 192', bytes)).toBe('Wang^XiaoDong=王^小东');
    });

    it('decodes GB18030', () => {
        expect(decode('GB18030', 'Wang^XiaoDong=\xcd\xf5^\xd0\xa1\xb6\xab=')).toBe('Wang^XiaoDong=王^小东=');
    });

    it('decodes ISO_IR 13 (Shift_JIS katakana)', () => {
        expect(decode('ISO_IR 13', '\xd4\xcf\xc0\xde^\xc0\xdb\xb3')).toBe('ﾔﾏﾀﾞ^ﾀﾛｳ');
    });

    it('returns empty string for empty input', () => {
        expect(decode('ISO_IR 100', '')).toBe('');
    });
});

describe('decodeDicomText — ISO 2022 code extensions', () => {
    it('decodes the PS3.5 H.3 Japanese example (ISO 2022 IR 87)', () => {
        const bytes = 'Yamada^Tarou=\x1b$B;3ED\x1b(B^\x1b$BB@O:\x1b(B=\x1b$B$d$^$@\x1b(B^\x1b$B$?$m$&\x1b(B';
        expect(decode('ISO 2022 IR 6\\ISO 2022 IR 87', bytes)).toBe('Yamada^Tarou=山田^太郎=やまだ^たろう');
    });

    it('decodes the PS3.5 H.2 Japanese example (ISO 2022 IR 13 + 87)', () => {
        const bytes = '\xd4\xcf\xc0\xde^\xc0\xdb\xb3=\x1b$B;3ED\x1b(J^\x1b$BB@O:\x1b(J=\x1b$B$d$^$@\x1b(J^\x1b$B$?$m$&\x1b(J';
        expect(decode('ISO 2022 IR 13\\ISO 2022 IR 87', bytes)).toBe('ﾔﾏﾀﾞ^ﾀﾛｳ=山田^太郎=やまだ^たろう');
    });

    it('decodes the PS3.5 I.2 Korean example (ISO 2022 IR 149)', () => {
        const bytes = 'Hong^Gildong=\x1b$)C\xfb\xf3^\x1b$)C\xd1\xce\xd4\xd7=\x1b$)C\xc8\xab^\x1b$)C\xb1\xe6\xb5\xbf';
        expect(decode('\\ISO 2022 IR 149', bytes)).toBe('Hong^Gildong=洪^吉洞=홍^길동');
    });

    it('decodes the Chinese ISO 2022 IR 58 example', () => {
        const bytes = 'Zhang^XiaoDong=\x1b$)A\xd5\xc5^\x1b$)A\xd0\xa1\xb6\xab=';
        expect(decode('\\ISO 2022 IR 58', bytes)).toBe('Zhang^XiaoDong=张^小东=');
    });

    it('decodes G1 single-byte designations (ESC - L → ISO-8859-5)', () => {
        expect(decode('ISO 2022 IR 6\\ISO 2022 IR 144', 'abc\x1b-L\xbb\xee\xda')).toBe('abcЛюк');
    });

    it('keeps the current decoder on unrecognized escape sequences', () => {
        expect(decode('ISO 2022 IR 6\\ISO 2022 IR 87', 'abc\x1b%Gdef')).toBe('abcdef');
    });

    it('handles a truncated escape sequence at end of input', () => {
        expect(decode('ISO 2022 IR 6\\ISO 2022 IR 87', 'abc\x1b')).toBe('abc');
        expect(decode('ISO 2022 IR 6\\ISO 2022 IR 87', 'abc\x1b$')).toBe('abc');
    });

    it('decodes an ISO 2022 IR 100 initial designation without escapes', () => {
        expect(decode('ISO 2022 IR 100', 'M\xfcller')).toBe('Müller');
    });
});
