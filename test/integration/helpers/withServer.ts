import type { DcmtkProcess } from '../../../src/DcmtkProcess';

/**
 * Runs a test function with a server, guaranteeing cleanup via try/finally.
 *
 * Starts the server, runs the test, then stops the server. If stop fails,
 * uses Symbol.dispose as fallback.
 *
 * @param server - A DcmtkProcess-based server instance (already created)
 * @param testFn - The async test function to run while the server is alive
 */
async function withServer<T extends DcmtkProcess>(server: T, testFn: (server: T) => Promise<void>): Promise<void> {
    const startResult = await server.start();
    if (!startResult.ok) {
        throw new Error(`Server failed to start: ${startResult.error.message}`);
    }

    try {
        await testFn(server);
    } finally {
        try {
            await server.stop();
        } catch {
            // Fallback: force dispose
            if (Symbol.dispose in server) {
                (server as unknown as Disposable)[Symbol.dispose]();
            }
        }
    }
}

export { withServer };
