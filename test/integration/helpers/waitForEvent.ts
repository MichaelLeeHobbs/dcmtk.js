import type { EventEmitter } from 'node:events';

/**
 * Returns a promise that resolves when the given event is emitted,
 * or rejects after a timeout.
 *
 * @param emitter - The event emitter to listen on
 * @param event - The event name to wait for
 * @param timeoutMs - Timeout in milliseconds (default 30000)
 * @returns A promise resolving to the first argument emitted with the event
 */
function waitForEvent<T = unknown>(emitter: EventEmitter, event: string, timeoutMs = 30_000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const handler = (data: T): void => {
            clearTimeout(timer);
            resolve(data);
        };

        const timer = setTimeout(() => {
            emitter.removeListener(event, handler);
            reject(new Error(`Timeout waiting for event "${event}" after ${timeoutMs}ms`));
        }, timeoutMs);

        emitter.once(event, handler);
    });
}

export { waitForEvent };
