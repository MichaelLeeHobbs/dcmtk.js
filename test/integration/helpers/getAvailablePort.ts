import { createServer } from 'node:net';

/**
 * Finds an available TCP port by binding to port 0.
 * The OS assigns a random available port, which is read and returned.
 *
 * @returns A promise resolving to an available port number
 */
function getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (addr === null || typeof addr === 'string') {
                server.close();
                reject(new Error('Could not determine port'));
                return;
            }
            const port = addr.port;
            server.close(() => {
                resolve(port);
            });
        });
        server.on('error', reject);
    });
}

export { getAvailablePort };
