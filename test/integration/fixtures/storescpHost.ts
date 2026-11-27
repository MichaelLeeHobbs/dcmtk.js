// Child process for the orphan test: runs a StoreSCP until it is killed. Usage: storescpHost.ts <port> <outputDir>
import { StoreSCP } from '../../../src';

const [port = '', outputDirectory = ''] = process.argv.slice(2);
const created = StoreSCP.create({ port: Number(port), outputDirectory });
if (!created.ok) throw created.error;
const started = await created.value.start();
if (!started.ok) throw started.error;
process.stdout.write('ready\n');
setInterval(() => {}, 1_000);
