/**
 * Generates a minimal dcmqrscp.cfg configuration file for integration tests.
 *
 * @module test/integration/helpers/generateQRConfig
 */

interface MoveDestination {
    readonly name: string;
    readonly aeTitle: string;
    readonly host: string;
    readonly port: number;
}

interface QRConfigOptions {
    readonly port: number;
    readonly aeTitle: string;
    readonly storageArea: string;
    readonly moveDestinations?: readonly MoveDestination[];
}

/**
 * Generates dcmqrscp.cfg content for integration tests.
 *
 * @param options - Configuration options for the Q/R SCP
 * @returns The config file content as a string
 */
function generateQRConfig(options: QRConfigOptions): string {
    const hostEntries = (options.moveDestinations ?? []).map(d => `${d.name} = (${d.aeTitle}, ${d.host}, ${d.port})`).join('\n');

    return [
        `NetworkTCPPort  = ${options.port}`,
        'MaxPDUSize      = 16384',
        'MaxAssociations = 16',
        '',
        'HostTable BEGIN',
        hostEntries,
        'HostTable END',
        '',
        'VendorTable BEGIN',
        'VendorTable END',
        '',
        'AETable BEGIN',
        `${options.aeTitle} ${options.storageArea.replace(/\\/g, '/')} RW (200, 1024mb) ANY`,
        'AETable END',
        '',
    ].join('\n');
}

export { generateQRConfig };
export type { QRConfigOptions, MoveDestination };
