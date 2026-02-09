# ADR-002: Vitest Over Jest

## Status

Accepted

## Context

The original project used Jest with Babel transforms. For the TypeScript rewrite, we need a test framework that supports TypeScript natively without additional transform configuration.

Options considered:

1. **Jest + ts-jest**: Requires ts-jest transform, adds configuration complexity, slower due to transpilation step.
2. **Jest + SWC**: Faster transforms but still requires configuration and a separate SWC dependency.
3. **Vitest**: Native TypeScript/ESM support, Vite-powered fast execution, Jest-compatible API, built-in coverage via v8.

## Decision

Use Vitest as the test framework with `@vitest/coverage-v8` for coverage reporting.

## Consequences

- **Positive:** Zero-config TypeScript support, no transform plugins needed.
- **Positive:** ESM-first aligns with the project's `"type": "module"` setting.
- **Positive:** Jest-compatible API minimizes learning curve.
- **Positive:** Built-in watch mode with HMR for fast development cycles.
- **Negative:** Vitest is newer than Jest; fewer community resources and plugins available.
