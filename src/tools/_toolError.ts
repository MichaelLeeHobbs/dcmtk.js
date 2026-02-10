/**
 * Standardized error factory for tool wrappers.
 *
 * Produces consistent error messages that include the tool name, sanitized
 * arguments (truncated), exit code, and a stderr excerpt.
 *
 * @module _toolError
 * @internal
 */

/** Maximum length for the arguments portion of the error message. */
const MAX_ARGS_LENGTH = 200;

/** Maximum length for the stderr excerpt in the error message. */
const MAX_STDERR_LENGTH = 500;

/**
 * Truncates a string to a maximum length, appending "..." if truncated.
 *
 * @param value - The string to truncate
 * @param maxLength - The maximum allowed length
 * @returns The original string or a truncated version
 */
function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.substring(0, maxLength)}...`;
}

/**
 * Creates a standardized Error for a tool wrapper failure.
 *
 * @param toolName - The DCMTK binary name (e.g., "dcm2xml")
 * @param args - The command-line arguments passed to the tool
 * @param exitCode - The process exit code
 * @param stderr - The captured stderr output
 * @returns An Error with a descriptive message
 */
function createToolError(toolName: string, args: readonly string[], exitCode: number, stderr: string): Error {
    const argsStr = truncate(args.join(' '), MAX_ARGS_LENGTH);
    const stderrStr = truncate(stderr.trim(), MAX_STDERR_LENGTH);
    const parts = [`${toolName} failed (exit code ${String(exitCode)})`];
    if (argsStr.length > 0) {
        parts.push(`args: ${argsStr}`);
    }
    if (stderrStr.length > 0) {
        parts.push(`stderr: ${stderrStr}`);
    }
    return new Error(parts.join(' | '));
}

export { createToolError, truncate, MAX_ARGS_LENGTH, MAX_STDERR_LENGTH };
