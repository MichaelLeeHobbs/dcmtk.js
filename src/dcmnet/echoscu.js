const path = require('path')
const {exec} = require('child_process')

// These comments are in honor of Pacmano - https://mirthconnect.slack.com/archives/DKE0F4P2N
const execute = async (command) => {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => err ?
            reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), command}) :
            resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), command})
        )
    })
}


async function echoscu({host, port = 104, options = {}}) {
    // const echoSCUPath = path.resolve(`${dcmtkPath.trim()}/echoscu`)
    const echoSCUPath = process.env.DCMTK_ECHOSCU
    let command = [echoSCUPath, host, port, '--debug']

    // ## general options
    //  -h    --help
    //          print this help text and exit
    //
    //        --version
    //          print version information and exit
    if (options.version) {
        command.push(`--version`)
        return execute(command.join(' '))
    }

    //
    //        --arguments
    //          print expanded command line arguments
    //
    //  -q    --quiet
    //          quiet mode, print no warnings and errors
    //
    //  -v    --verbose
    //          verbose mode, print processing details
    //
    //  -d    --debug
    //          debug mode, print debug information
    //
    //  -ll   --log-level  [l]evel: string constant
    //          (fatal, error, warn, info, debug, trace)
    //          use level l for the logger
    //
    //  -lc   --log-config  [f]ilename: string
    //          use config file f for the logger

    // ## network options
    // ### application entity titles:
    //  -aet  --aetitle  [a]etitle: string
    //           set my calling AE title (default: ECHOSCU)
    //
    if (options.callingAETitle) command.push(`-aet ${options.callingAETitle}`)

    //   -aec  --call  [a]etitle: string
    //           set called AE title of peer (default: ANY-SCP)
    if (options.calledAETitle) command.push(`-aec ${options.calledAETitle}`)

    // ### association negotiation debugging:
    //   -pts  --propose-ts  [n]umber: integer (1..38)
    //           propose n transfer syntaxes
    //
    if (options.proposeTransferSyntaxes) command.push(`-pts ${options.proposeTransferSyntaxes}`)

    //   -ppc  --propose-pc  [n]umber: integer (1..128)
    //           propose n presentation contexts
    if (options.proposePresentationContexts) command.push(`-ppc ${options.proposePresentationContexts}`)

    // ### association negotiation debugging:
    //   -to   --timeout  [s]econds: integer (default: unlimited)
    //           timeout for connection requests
    //
    if (options.timeout) command.push(`-to ${options.timeout}`)

    //   -ts   --socket-timeout  [s]econds: integer (default: 60)
    //           timeout for network socket (0 for none)
    //
    if (options.socketTimeout) command.push(`-ts ${options.socketTimeout}`)

    //   -ta   --acse-timeout  [s]econds: integer (default: 30)
    //           timeout for ACSE messages
    //
    if (options.acseTimeout) command.push(`-ta ${options.acseTimeout}`)

    //   -td   --dimse-timeout  [s]econds: integer (default: unlimited)
    //           timeout for DIMSE messages
    //
    if (options.dimseTimeout) command.push(`-td ${options.dimseTimeout}`)

    //   -pdu  --max-pdu  [n]umber of bytes: integer (4096..131072)
    //           set max receive pdu to n bytes (default: 16384)
    //
    if (options.maxPDU) command.push(`-pdu ${options.maxPDU}`)

    //         --repeat  [n]umber: integer
    //           repeat n times
    //
    if (options.repeat) command.push(`--repeat ${options.repeat}`)

    //         --abort
    //           abort association instead of releasing it
    if (options.abort) command.push(`--abort`)

    return execute(command.join(' '))
    // command = command.join(' ')
    // return new Promise((resolve, reject) => {
    //     exec(command, (err, stdout, stderr) => err ?
    //         reject({message: `FAILED: ${stdout}\n${stderr}`.trim()}) :
    //         resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim()})
    //     )
    // })
}

module.exports = echoscu
