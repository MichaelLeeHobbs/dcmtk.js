/**
 * Repairs malformed JSON output from the dcm2json binary.
 *
 * DCMTK's dcm2json sometimes emits invalid JSON for numeric-string VRs
 * (DS, IS) by producing unquoted numbers in arrays:
 * ```json
 * "Value": [1.5, 2.0]        // invalid — DS values must be strings
 * "Value": ["1.5", "2.0"]    // valid
 * ```
 *
 * This module detects and repairs these patterns before JSON.parse.
 *
 * @module _repairJson
 * @internal
 */

/**
 * Pattern matching "Value" arrays in DICOM JSON.
 * Captures: (prefix including `[`)(inner content)(closing `]`).
 */
const VALUE_ARRAY_PATTERN = /("Value"\s*:\s*\[)([\s\S]*?)(\])/g;

/**
 * Matches a bare (unquoted) numeric literal.
 * Handles integers, decimals, scientific notation, and negative values.
 */
const BARE_NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Quotes a bare number token, leaving already-quoted strings unchanged.
 *
 * @param token - A trimmed token from inside a Value array
 * @returns The token, quoted if it was a bare number
 */
function quoteIfBareNumber(token: string): string {
    const trimmed = token.trim();
    if (BARE_NUMBER.test(trimmed)) {
        return `"${trimmed}"`;
    }
    return trimmed;
}

/**
 * Repairs the inner content of a "Value" array by quoting bare numbers.
 *
 * @param inner - The content between `[` and `]`
 * @returns Repaired content with bare numbers quoted
 */
function repairInner(inner: string): string {
    const trimmed = inner.trim();
    if (trimmed.length === 0) return inner;

    // Split on commas that are not inside quotes
    const tokens: string[] = [];
    let current = '';
    let inString = false;

    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i]!;
        if (ch === '"' && (i === 0 || trimmed[i - 1] !== '\\')) {
            inString = !inString;
            current += ch;
        } else if (ch === ',' && !inString) {
            tokens.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    tokens.push(current);

    return tokens.map(quoteIfBareNumber).join(', ');
}

/**
 * Repairs malformed dcm2json output by quoting unquoted numeric values in "Value" arrays.
 *
 * @param raw - The raw JSON string from dcm2json
 * @returns The repaired JSON string safe for JSON.parse
 */
function repairJson(raw: string): string {
    return raw.replace(VALUE_ARRAY_PATTERN, (_match, prefix: string, inner: string, suffix: string) => {
        return `${prefix}${repairInner(inner)}${suffix}`;
    });
}

export { repairJson };
