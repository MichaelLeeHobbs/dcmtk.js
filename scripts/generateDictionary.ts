/**
 * Generates the DICOM dictionary lookup file from DCMTK's `dicom.dic`.
 *
 * Usage: npx tsx scripts/generateDictionary.ts
 *
 * Input:  _configs/dicom.dic — vendored verbatim from DCMTK
 *         (https://github.com/DCMTK/dcmtk, dcmdata/data/dicom.dic).
 *         Refresh by dropping in a newer upstream copy and re-running this script.
 * Output: src/data/dictionary.json
 *
 * The upstream file is tab-separated: `tag<TAB>VR<TAB>keyword<TAB>VM<TAB>version`.
 * A tag is either a plain `(gggg,eeee)` or a *repeating* range using DCMTK's
 * notation, where the optional middle letter restricts the range to odd (`o`),
 * even (`e`), or unrestricted (`u`) values:
 *
 *   (6000-60FF,0010)          group range, no restriction letter
 *   (0009-o-FFFF,0010-u-00FF) odd group range, unrestricted element range
 *   (0020,3100-31FF)          element range only
 *
 * Output shape:
 *   {
 *     "exact":     { "00100010": { "vr": "PN", "name": "PatientName", "vm": [1, 1], "retired": false } },
 *     "repeating": [ { "groupStart": "6000", "groupEnd": "60FF", "groupParity": "even",
 *                      "elementStart": "0010", "elementEnd": "0010", "elementParity": "any",
 *                      "vr": "US", "name": "OverlayRows", "vm": [1, 1], "retired": false } ]
 *   }
 *
 * Two deliberate divergences from the raw upstream data:
 *
 * 1. Standard group ranges carry no restriction letter upstream, so `(6001,0010)`
 *    would match OverlayRows. Odd groups are *always* private (PS3.5 §7.8.1), so
 *    standard group ranges are emitted with `"even"` parity.
 * 2. The `PRIVATE`, `ILLEGAL`, and `GENERIC` pseudo-entries (PrivateCreator,
 *    IllegalGroupLength, GenericGroupLength, ...) are dropped. They are DCMTK
 *    parser placeholders spanning every odd group / every group; keeping them
 *    would make `lookupTag()` claim to know every private tag ever written.
 *
 * DCMTK-internal VR aliases (lowercase) are normalized:
 *   ox → OW, xs → US, lt → OW, px → OW, up → UL, na → (skipped)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Standard VR codes for validation
const STANDARD_VRS = new Set([
    'AE',
    'AS',
    'AT',
    'CS',
    'DA',
    'DS',
    'DT',
    'FD',
    'FL',
    'IS',
    'LO',
    'LT',
    'OB',
    'OD',
    'OF',
    'OL',
    'OV',
    'OW',
    'PN',
    'SH',
    'SL',
    'SQ',
    'SS',
    'ST',
    'SV',
    'TM',
    'UC',
    'UI',
    'UL',
    'UN',
    'UR',
    'US',
    'UT',
    'UV',
]);

// DCMTK-internal VR aliases → standard VR
const VR_ALIASES: Record<string, string> = {
    ox: 'OW', // OB or OW → default to OW
    xs: 'US', // SS or US → default to US
    lt: 'OW', // US, SS, or OW → default to OW
    px: 'OW', // OB or OW (pixel data) → default to OW
    up: 'UL', // UL (pointer)
};

/** Version tokens that mark DCMTK parser placeholders rather than registry entries. */
const PSEUDO_VERSIONS = new Set(['PRIVATE', 'ILLEGAL', 'GENERIC']);

type Parity = 'any' | 'even' | 'odd';

interface Range {
    start: string;
    end: string;
    parity: Parity;
}

interface OutputEntry {
    vr: string;
    name: string;
    vm: [number, number | null];
    retired: boolean;
}

interface RepeatingEntry extends OutputEntry {
    groupStart: string;
    groupEnd: string;
    groupParity: Parity;
    elementStart: string;
    elementEnd: string;
    elementParity: Parity;
}

interface Stats {
    exact: number;
    repeating: number;
    skippedNa: number;
    skippedPseudo: number;
    aliasNormalized: number;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const RESTRICTION_PARITY: Record<string, Parity> = { o: 'odd', e: 'even', u: 'any' };

/**
 * Parses one half of a DCMTK tag spec: `gggg`, `gggg-hhhh`, or `gggg-x-hhhh`.
 *
 * `defaultRangeParity` applies only when a range carries no restriction letter.
 */
function parseRange(spec: string, defaultRangeParity: Parity): Range | undefined {
    const plain = /^([0-9A-Fa-f]{4})$/.exec(spec);
    if (plain !== null) {
        const value = plain[1].toUpperCase();
        return { start: value, end: value, parity: 'any' };
    }

    const ranged = /^([0-9A-Fa-f]{4})-(?:([oeu])-)?([0-9A-Fa-f]{4})$/.exec(spec);
    if (ranged === null) return undefined;

    const letter = ranged[2];
    const parity = letter === undefined ? defaultRangeParity : RESTRICTION_PARITY[letter];
    return { start: ranged[1].toUpperCase(), end: ranged[3].toUpperCase(), parity: parity ?? 'any' };
}

/**
 * Parses a VM spec into `[min, max]`, where `max` is null when unbounded.
 *
 * `n` means unbounded (`1-n`), and `N-Mn` means "any multiple of M, at least N"
 * which is likewise unbounded above.
 */
function parseVm(spec: string): [number, number | null] | undefined {
    const single = /^(\d+)$/.exec(spec);
    if (single !== null) {
        const value = Number(single[1]);
        return [value, value];
    }

    const range = /^(\d+)-(\d+)?n?$/.exec(spec);
    if (range === null) return undefined;

    // "1-n" and "2-2n" are both unbounded above; "1-8" is not.
    return [Number(range[1]), spec.endsWith('n') ? null : Number(range[2])];
}

/** Splits a dictionary line into its tab-separated fields. */
function splitFields(line: string): readonly string[] {
    return line
        .split('\t')
        .map(field => field.trim())
        .filter(field => field.length > 0);
}

// ---------------------------------------------------------------------------
// Line processing
// ---------------------------------------------------------------------------

interface ParsedLine {
    group: Range;
    element: Range;
    entry: OutputEntry;
}

/** Resolves the VR for a line, normalizing DCMTK aliases; undefined when the line should be skipped. */
function resolveVr(rawVr: string, tag: string, name: string, stats: Stats): string | undefined {
    if (rawVr === 'na') {
        stats.skippedNa++;
        return undefined;
    }

    const alias = VR_ALIASES[rawVr];
    const vr = alias ?? rawVr;
    if (alias !== undefined) stats.aliasNormalized++;

    if (!STANDARD_VRS.has(vr)) {
        console.warn(`  WARNING: unknown VR "${rawVr}" for tag ${tag}, name=${name}`);
        return undefined;
    }
    return vr;
}

/** Converts one `dicom.dic` line into an entry, or undefined when it should be skipped. */
function parseLine(line: string, stats: Stats): ParsedLine | undefined {
    const fields = splitFields(line);
    if (fields.length < 5) {
        console.warn(`  WARNING: malformed line (${String(fields.length)} fields): ${line}`);
        return undefined;
    }

    const [tag, rawVr, name, vmSpec, version] = fields;
    if (PSEUDO_VERSIONS.has(version)) {
        stats.skippedPseudo++;
        return undefined;
    }

    const vr = resolveVr(rawVr, tag, name, stats);
    if (vr === undefined) return undefined;

    const tagMatch = /^\(([^,]+),([^)]+)\)$/.exec(tag);
    if (tagMatch === null) {
        console.warn(`  WARNING: unparseable tag ${tag}, name=${name}`);
        return undefined;
    }

    // A standard group range with no restriction letter still covers even groups
    // only — odd groups are private by definition (PS3.5 §7.8.1).
    const group = parseRange(tagMatch[1], 'even');
    const element = parseRange(tagMatch[2], 'any');
    const vm = parseVm(vmSpec);
    if (group === undefined || element === undefined || vm === undefined) {
        console.warn(`  WARNING: unparseable tag/VM for ${tag} (vm="${vmSpec}"), name=${name}`);
        return undefined;
    }

    return { group, element, entry: { vr, name, vm, retired: version.includes('retired') } };
}

/** True when the parsed line covers exactly one tag. */
function isExact(parsed: ParsedLine): boolean {
    return parsed.group.start === parsed.group.end && parsed.element.start === parsed.element.end;
}

function toRepeating(parsed: ParsedLine): RepeatingEntry {
    return {
        groupStart: parsed.group.start,
        groupEnd: parsed.group.end,
        groupParity: parsed.group.parity,
        elementStart: parsed.element.start,
        elementEnd: parsed.element.end,
        elementParity: parsed.element.parity,
        ...parsed.entry,
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface Collected {
    exact: Record<string, OutputEntry>;
    repeating: RepeatingEntry[];
}

function collect(lines: readonly string[], stats: Stats): Collected {
    const exact: Record<string, OutputEntry> = {};
    const repeating: RepeatingEntry[] = [];
    const names = new Set<string>();

    for (const line of lines) {
        if (!line.startsWith('(')) continue;

        const parsed = parseLine(line, stats);
        if (parsed === undefined) continue;

        if (names.has(parsed.entry.name)) {
            console.warn(`  WARNING: duplicate keyword ${parsed.entry.name}`);
        }
        names.add(parsed.entry.name);

        if (!isExact(parsed)) {
            repeating.push(toRepeating(parsed));
            stats.repeating++;
            continue;
        }

        const key = `${parsed.group.start}${parsed.element.start}`;
        if (exact[key] !== undefined) {
            console.warn(`  WARNING: duplicate tag key ${key}, name=${parsed.entry.name}`);
            continue;
        }
        exact[key] = parsed.entry;
        stats.exact++;
    }

    return { exact, repeating };
}

function main(): void {
    const projectRoot = path.resolve(import.meta.dirname, '..');
    const inputPath = path.join(projectRoot, '_configs', 'dicom.dic');
    const outputPath = path.join(projectRoot, 'src', 'data', 'dictionary.json');

    console.log(`Reading: ${inputPath}`);
    const lines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/);

    const stats: Stats = { exact: 0, repeating: 0, skippedNa: 0, skippedPseudo: 0, aliasNormalized: 0 };
    const collected = collect(lines, stats);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const json = JSON.stringify(collected, null, 2);
    fs.writeFileSync(outputPath, json + '\n', 'utf8');

    const sizeKB = Math.round(Buffer.byteLength(json, 'utf8') / 1024);
    console.log(`\nDone.`);
    console.log(`  Exact tags:       ${String(stats.exact)}`);
    console.log(`  Repeating tags:   ${String(stats.repeating)}`);
    console.log(`  Skipped (na):     ${String(stats.skippedNa)}`);
    console.log(`  Skipped (pseudo): ${String(stats.skippedPseudo)}`);
    console.log(`  VR normalized:    ${String(stats.aliasNormalized)}`);
    console.log(`  Output size:      ~${String(sizeKB)}KB`);
    console.log(`  Output:           ${outputPath}`);

    // Validate output is parseable and complete
    const verify = JSON.parse(fs.readFileSync(outputPath, 'utf8')) as { exact: Record<string, unknown>; repeating: unknown[] };
    const verifyExact = Object.keys(verify.exact).length;
    if (verifyExact !== stats.exact || verify.repeating.length !== stats.repeating) {
        console.error(
            `  ERROR: verification failed. Expected ${String(stats.exact)}/${String(stats.repeating)}, got ${String(verifyExact)}/${String(verify.repeating.length)}`
        );
        process.exit(1);
    }
    console.log(`  Verified:         ${String(verifyExact)} exact + ${String(verify.repeating.length)} repeating ✓`);
}

main();
