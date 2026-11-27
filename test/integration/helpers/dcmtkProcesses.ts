import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

interface RunningProcess {
    readonly pid: number;
    readonly commandLine: string;
}

function listWindows(binary: string): RunningProcess[] {
    const script = `Get-CimInstance Win32_Process -Filter "Name='${binary}.exe'" | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`;
    const out = execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', windowsHide: true });
    return out
        .split(/\r?\n/)
        .filter(line => line.trim().length > 0)
        .map(line => {
            const [pid = '0', ...rest] = line.trim().split(' ');
            return { pid: Number(pid), commandLine: rest.join(' ') };
        });
}

// /proc rather than `ps`: BusyBox (the CI image) and procps disagree on flags for listing every process.
function listLinux(binary: string): RunningProcess[] {
    const found: RunningProcess[] = [];
    for (const entry of readdirSync('/proc')) {
        if (!/^\d+$/.test(entry)) continue;
        try {
            const commandLine = readFileSync(`/proc/${entry}/cmdline`, 'utf8').split('\0').join(' ').trim();
            if (commandLine.split(' ')[0]?.endsWith(binary) === true) found.push({ pid: Number(entry), commandLine });
        } catch {
            // Exited while we were reading
        }
    }
    return found;
}

/**
 * PIDs of running `binary` processes whose command line has `port` as a whole argument.
 *
 * Matching on the port ties a process to the test that started it, so parallel tests and unrelated DCMTK processes
 * on the machine are not counted.
 */
function dcmtkProcessesOnPort(binary: string, port: number): number[] {
    const all = process.platform === 'win32' ? listWindows(binary) : listLinux(binary);
    const portArg = new RegExp(`(^|\\s)${String(port)}(\\s|$)`);
    return all.filter(p => portArg.test(p.commandLine)).map(p => p.pid);
}

async function pollDcmtkProcesses(binary: string, port: number, done: (pids: number[]) => boolean, timeoutMs: number): Promise<number[]> {
    const deadline = Date.now() + timeoutMs;
    let pids = dcmtkProcessesOnPort(binary, port);
    while (!done(pids) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 200));
        pids = dcmtkProcessesOnPort(binary, port);
    }
    return pids;
}

/** Polls until no matching process is left, or the timeout passes; returns the PIDs still running. */
function waitForNoDcmtkProcesses(binary: string, port: number, timeoutMs = 5_000): Promise<number[]> {
    return pollDcmtkProcesses(binary, port, pids => pids.length === 0, timeoutMs);
}

/** Polls until a matching process is running, or the timeout passes; returns the PIDs found. */
function waitForDcmtkProcess(binary: string, port: number, timeoutMs = 10_000): Promise<number[]> {
    return pollDcmtkProcesses(binary, port, pids => pids.length > 0, timeoutMs);
}

/** Last-resort cleanup so a failing test does not leave strays behind for the next run. */
function killDcmtkProcessesOnPort(binary: string, port: number): void {
    for (const pid of dcmtkProcessesOnPort(binary, port)) {
        try {
            process.kill(pid);
        } catch {
            // Already gone
        }
    }
}

export { waitForDcmtkProcess, waitForNoDcmtkProcesses, killDcmtkProcessesOnPort };
