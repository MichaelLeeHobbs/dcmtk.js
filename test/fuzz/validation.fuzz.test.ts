/**
 * Property-based fuzz tests for branded type factory functions and validation schemas.
 *
 * Exercises createDicomTag, createAETitle, createPort, createDicomTagPath,
 * createSOPClassUID, createTransferSyntaxUID, and createDicomFilePath
 * with randomly generated inputs.
 *
 * @module fuzz/validation
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    createDicomTag,
    createAETitle,
    createPort,
    createDicomTagPath,
    createSOPClassUID,
    createTransferSyntaxUID,
    createDicomFilePath,
} from '../../src/brands';
import { parseAETitle, parsePort, parseDicomTag, parseDicomTagPath, parseSOPClassUID } from '../../src/validation';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const hexDigit = fc.mapToConstant(
    { num: 10, build: v => String.fromCharCode(0x30 + v) },
    { num: 6, build: v => String.fromCharCode(0x41 + v) },
    { num: 6, build: v => String.fromCharCode(0x61 + v) }
);

const hexQuad = fc.tuple(hexDigit, hexDigit, hexDigit, hexDigit).map(ds => ds.join(''));

const validDicomTag = fc.tuple(hexQuad, hexQuad).map(([g, e]) => `(${g},${e})`);

const aeChar = fc.mapToConstant(
    { num: 26, build: v => String.fromCharCode(0x41 + v) },
    { num: 26, build: v => String.fromCharCode(0x61 + v) },
    { num: 10, build: v => String.fromCharCode(0x30 + v) },
    { num: 1, build: () => ' ' },
    { num: 1, build: () => '-' }
);

const validAETitle = fc.array(aeChar, { minLength: 1, maxLength: 16 }).map(cs => cs.join(''));

const validPort = fc.integer({ min: 1, max: 65535 });

const uidSegment = fc.stringMatching(/^[0-9]{1,8}$/);

const validUID = fc
    .array(uidSegment, { minLength: 1, maxLength: 8 })
    .map(segs => segs.join('.'))
    .filter(s => s.length >= 1 && s.length <= 64);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validation fuzz tests', () => {
    describe('createDicomTag', () => {
        it('accepts all well-formed tags', () => {
            fc.assert(
                fc.property(validDicomTag, tag => {
                    const result = createDicomTag(tag);
                    expect(result.ok).toBe(true);
                }),
                { numRuns: 500 }
            );
        });

        it('rejects all random strings without parens/comma', () => {
            fc.assert(
                fc.property(
                    fc.string().filter(s => !s.includes('(') && !s.includes(',')),
                    input => {
                        const result = createDicomTag(input);
                        expect(result.ok).toBe(false);
                    }
                ),
                { numRuns: 200 }
            );
        });

        it('never throws regardless of input', () => {
            fc.assert(
                fc.property(fc.string(), input => {
                    expect(() => createDicomTag(input)).not.toThrow();
                }),
                { numRuns: 200 }
            );
        });
    });

    describe('createAETitle', () => {
        it('accepts all well-formed AE titles', () => {
            fc.assert(
                fc.property(validAETitle, ae => {
                    const result = createAETitle(ae);
                    expect(result.ok).toBe(true);
                }),
                { numRuns: 500 }
            );
        });

        it('rejects empty strings', () => {
            const result = createAETitle('');
            expect(result.ok).toBe(false);
        });

        it('rejects strings longer than 16 chars', () => {
            fc.assert(
                fc.property(fc.string({ minLength: 17, maxLength: 100 }), input => {
                    const result = createAETitle(input);
                    expect(result.ok).toBe(false);
                }),
                { numRuns: 500 }
            );
        });

        it('never throws regardless of input', () => {
            fc.assert(
                fc.property(fc.string(), input => {
                    expect(() => createAETitle(input)).not.toThrow();
                }),
                { numRuns: 200 }
            );
        });
    });

    describe('createPort', () => {
        it('accepts all valid port numbers', () => {
            fc.assert(
                fc.property(validPort, port => {
                    const result = createPort(port);
                    expect(result.ok).toBe(true);
                }),
                { numRuns: 500 }
            );
        });

        it('rejects numbers outside range', () => {
            fc.assert(
                fc.property(fc.oneof(fc.integer({ min: -1000, max: 0 }), fc.integer({ min: 65536, max: 100000 })), input => {
                    const result = createPort(input);
                    expect(result.ok).toBe(false);
                }),
                { numRuns: 500 }
            );
        });

        it('rejects non-integer numbers', () => {
            fc.assert(
                fc.property(
                    fc.double({ min: 0.01, max: 65535, noNaN: true }).filter(n => !Number.isInteger(n)),
                    input => {
                        const result = createPort(input);
                        expect(result.ok).toBe(false);
                    }
                ),
                { numRuns: 500 }
            );
        });

        it('never throws regardless of input', () => {
            fc.assert(
                fc.property(fc.double({ noNaN: true }), input => {
                    expect(() => createPort(input)).not.toThrow();
                }),
                { numRuns: 200 }
            );
        });
    });

    describe('createSOPClassUID / createTransferSyntaxUID', () => {
        it('accepts all well-formed UIDs', () => {
            fc.assert(
                fc.property(validUID, uid => {
                    expect(createSOPClassUID(uid).ok).toBe(true);
                    expect(createTransferSyntaxUID(uid).ok).toBe(true);
                }),
                { numRuns: 500 }
            );
        });

        it('rejects UIDs over 64 characters', () => {
            fc.assert(
                fc.property(fc.string({ minLength: 65, maxLength: 200 }), input => {
                    expect(createSOPClassUID(input).ok).toBe(false);
                    expect(createTransferSyntaxUID(input).ok).toBe(false);
                }),
                { numRuns: 100 }
            );
        });
    });

    describe('createDicomFilePath', () => {
        it('accepts any non-empty string', () => {
            fc.assert(
                fc.property(fc.string({ minLength: 1 }), input => {
                    const result = createDicomFilePath(input);
                    expect(result.ok).toBe(true);
                }),
                { numRuns: 500 }
            );
        });

        it('rejects empty string', () => {
            expect(createDicomFilePath('').ok).toBe(false);
        });
    });

    describe('createDicomTagPath', () => {
        it('never throws for arbitrary strings', () => {
            fc.assert(
                fc.property(fc.string(), input => {
                    expect(() => createDicomTagPath(input)).not.toThrow();
                }),
                { numRuns: 200 }
            );
        });
    });

    describe('parse functions agree with create functions', () => {
        it('parseDicomTag and createDicomTag agree on valid tags', () => {
            fc.assert(
                fc.property(validDicomTag, tag => {
                    expect(parseDicomTag(tag).ok).toBe(createDicomTag(tag).ok);
                }),
                { numRuns: 300 }
            );
        });

        it('parseAETitle and createAETitle agree on valid AE titles', () => {
            fc.assert(
                fc.property(validAETitle, ae => {
                    expect(parseAETitle(ae).ok).toBe(createAETitle(ae).ok);
                }),
                { numRuns: 300 }
            );
        });

        it('parsePort and createPort agree on valid ports', () => {
            fc.assert(
                fc.property(validPort, port => {
                    expect(parsePort(port).ok).toBe(createPort(port).ok);
                }),
                { numRuns: 300 }
            );
        });

        it('parseSOPClassUID and createSOPClassUID agree on valid UIDs', () => {
            fc.assert(
                fc.property(validUID, uid => {
                    expect(parseSOPClassUID(uid).ok).toBe(createSOPClassUID(uid).ok);
                }),
                { numRuns: 300 }
            );
        });

        it('parseDicomTagPath and createDicomTagPath agree on random strings', () => {
            fc.assert(
                fc.property(fc.string(), input => {
                    expect(parseDicomTagPath(input).ok).toBe(createDicomTagPath(input).ok);
                }),
                { numRuns: 300 }
            );
        });
    });
});
