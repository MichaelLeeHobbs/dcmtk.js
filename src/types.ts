/**
 * Represents the outcome of an operation that can succeed or fail.
 *
 * @typeParam T - The type of the success value
 * @typeParam E - The type of the error (defaults to Error)
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number> {
 *     if (b === 0) {
 *         return err(new Error('Division by zero'));
 *     }
 *     return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.ok) {
 *     console.log(result.value); // 5
 * } else {
 *     console.error(result.error.message);
 * }
 * ```
 */
type Result<T, E = Error> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/**
 * Creates a successful Result containing the given value.
 *
 * @param value - The success value to wrap
 * @returns A Result representing success
 *
 * @example
 * ```ts
 * const result = ok(42);
 * // result.ok === true, result.value === 42
 * ```
 */
function ok<T>(value: T): Result<T, never> {
    return { ok: true, value };
}

/**
 * Creates a failed Result containing the given error.
 *
 * @param error - The error to wrap
 * @returns A Result representing failure
 *
 * @example
 * ```ts
 * const result = err(new Error('not found'));
 * // result.ok === false, result.error.message === 'not found'
 * ```
 */
function err<E>(error: E): Result<never, E> {
    return { ok: false, error };
}

/**
 * Exhaustive check helper for discriminated unions and switch statements.
 * Calling this in a default case ensures all variants are handled at compile time.
 *
 * @param x - A value that should be of type `never` if all cases are handled
 * @returns Never returns; always throws
 * @throws Always throws an Error indicating an unhandled case
 *
 * @example
 * ```ts
 * type Shape = { kind: 'circle' } | { kind: 'square' };
 *
 * function area(shape: Shape): number {
 *     switch (shape.kind) {
 *         case 'circle': return Math.PI;
 *         case 'square': return 1;
 *         default: assertUnreachable(shape);
 *     }
 * }
 * ```
 */
function assertUnreachable(x: never): never {
    throw new Error(`Exhaustive check failed: ${JSON.stringify(x)}`);
}

// ---------------------------------------------------------------------------
// Process result types (Rule 7.1: immutable)
// ---------------------------------------------------------------------------

/**
 * The result of executing a short-lived DCMTK binary.
 * All properties are readonly to enforce immutability.
 */
interface DcmtkProcessResult {
    /** The captured stdout output from the process. */
    readonly stdout: string;
    /** The captured stderr output from the process. */
    readonly stderr: string;
    /** The exit code of the process (0 typically means success). */
    readonly exitCode: number;
}

// ---------------------------------------------------------------------------
// Common option types (Rule 8.4: options objects for > 4 params)
// ---------------------------------------------------------------------------

/**
 * Options for short-lived DCMTK process execution.
 * Provides configurable timeout and abort support per Rule 4.2.
 */
interface ExecOptions {
    /** Working directory for the child process. */
    readonly cwd?: string | undefined;
    /** Timeout in milliseconds. Defaults to DEFAULT_TIMEOUT_MS. */
    readonly timeoutMs?: number | undefined;
    /** AbortSignal for external cancellation. */
    readonly signal?: AbortSignal | undefined;
}

/**
 * Options for spawning a DCMTK process with user-supplied arguments.
 * Uses spawn() instead of exec() to avoid shell injection (Rule 7.4).
 */
interface SpawnOptions extends ExecOptions {
    /** Additional environment variables merged with process.env. */
    readonly env?: Readonly<Record<string, string>> | undefined;
}

// ---------------------------------------------------------------------------
// Event types (Rule 8.3: discriminated unions)
// ---------------------------------------------------------------------------

/**
 * Line source discriminant for output parsing.
 */
type LineSource = 'stdout' | 'stderr';

/**
 * A single line of output from a DCMTK process.
 */
interface ProcessLine {
    readonly source: LineSource;
    readonly text: string;
}

export { ok, err, assertUnreachable };
export type { Result, DcmtkProcessResult, ExecOptions, SpawnOptions, LineSource, ProcessLine };
