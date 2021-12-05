const {exec} = require('child_process')

const $t = (func) => {
  try {
    return func()
  } catch {
    // do nothing
  }
}

const parseResults = (result, command) => {
  const reAssociations = /Number of associations *: (\d+)/
  const reContexts = /Number of pres\. contexts *: (\d+)/
  const reInstances = /Number of SOP instances *: (\d+)/
  const reSent = /sent to the peer *: (\d+)/
  const reSuccess = /with status SUCCESS *: (\d+)/

  const parsed = {
    log: result,
    command,
    statusSummary: {
      associations: $t(() => parseInt(reAssociations.exec(result)[1])),
      contexts: $t(() => parseInt(reContexts.exec(result)[1])),
      instances: $t(() => parseInt(reInstances.exec(result)[1])),
      sent: $t(() => parseInt(reSent.exec(result)[1])),
      success: $t(() => parseInt(reSuccess.exec(result)[1])),
    }
  }
  return parsed
}

const execute = async (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => err ?
      reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), command}) :
      resolve(parseResults(stdout, command))
    )
  })
}

async function dcmsend(options) {
  let command = [process.env.DCMTK_DCMSEND, '--debug', options.peer, options.port, options.dcmfileIn]
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
  if (options.arguments) {
    command.push(`--arguments`)
    return execute(command.join(' '))
  }
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

  // ## input options
  // ### input file format:
  //
  //   +f    --read-file
  //           read file format or data set
  //
  if (options.readFile) command.push(`--read-file ${options.readFile}`)

  //   +fo   --read-file-only
  //           read file format only (default)
  //
  if (options.readFileOnly) command.push(`--read-file-only`)

  //   -f    --read-dataset
  //           read data set without file meta information
  //
  if (options.readDataset) command.push(`--read-dataset`)

  // ### input files:
  //
  //   +rd   --read-from-dicomdir
  //           read information on input files from DICOMDIR
  //
  if (options.readFromDicomdir) command.push(`--read-from-dicomdir`)

  //   +sd   --scan-directories
  //           scan directories for input files (dcmfile-in)
  //
  if (options.scanDirectories) command.push(`--scan-directories`)

  //   +sp   --scan-pattern  [p]attern: string (only with --scan-directories)
  //           pattern for filename matching (wildcards)
  //
  //           # possibly not available on all systems
  //
  if (options.scanPattern) command.push(`--scan-pattern ${options.scanPattern}`)

  //   -r    --no-recurse
  //           do not recurse within directories (default)
  //
  if (options.noRecurse) command.push(`--no-recurse`)

  //   +r    --recurse
  //           recurse within specified directories
  if (options.recurse) command.push(`--recurse`)

  // ## processing options
  // ### transfer syntax conversion:
  //
  //   -dn   --decompress-never
  //           never decompress compressed data sets
  //
  if (options.decompressNever) command.push(`--decompress-never`)

  //   +dls  --decompress-lossless
  //           only decompress lossless compression (default)
  //
  if (options.decompressLossless) command.push(`--decompress-lossless`)

  //   +dly  --decompress-lossy
  //           decompress both lossy and lossless compression
  //
  if (options.decompressLossy) command.push(`--decompress-lossy`)

  // ### deflate compression level:
  //
  //   +cl   --compression-level  [l]evel: integer (default: 6)
  //           0=uncompressed, 1=fastest, 9=best compression
  //
  if (options.compressionLevel) command.push(`--compression-level ${options.compressionLevel}`)

  // ### other processing options:
  //
  //   -nh   --no-halt
  //           do not halt on first invalid input file
  //           or if unsuccessful store encountered
  //
  if (options.noHalt) command.push(`--no-halt`)

  //   -nip  --no-illegal-proposal
  //           do not propose any presentation context that does
  //           not contain the default transfer syntax (if needed)
  //
  if (options.noIllegalProposal) command.push(`--no-illegal-proposal`)

  //   -nuc  --no-uid-checks
  //           do not check UID values of input files
  if (options.noUidChecks) command.push(`--no-uid-checks`)

  // ## network options
  // ### application entity titles:
  //
  //   -aet  --aetitle  [a]etitle: string
  //           set my calling AE title (default: DCMSEND)
  //
  if (options.callingAETitle) command.push(`--aetitle ${options.callingAETitle}`)

  //   -aec  --call  [a]etitle: string
  //           set called AE title of peer (default: ANY-SCP)
  //
  if (options.calledAETitle) command.push(`--call ${options.calledAETitle}`)

  // association handling:
  //
  //   +ma   --multi-associations
  //           use multiple associations (one after the other)
  //           if needed to transfer the instances (default)
  //
  if (options.multiAssociations) command.push(`--multi-associations`)

  //   -ma   --single-association
  //           always use a single association
  //
  if (options.singleAssociation) command.push(`--single-association`)

  // ### other network options:
  //
  //   -to   --timeout  [s]econds: integer (default: unlimited)
  //           timeout for connection requests
  //
  if (options.timeout) command.push(`--timeout ${options.timeout}`)

  //   -ta   --acse-timeout  [s]econds: integer (default: 30)
  //           timeout for ACSE messages
  //
  if (options.acseTimeout) command.push(`--acse-timeout ${options.acseTimeout}`)

  //   -td   --dimse-timeout  [s]econds: integer (default: unlimited)
  //           timeout for DIMSE messages
  //
  if (options.dimseTimeout) command.push(`--dimse-timeout ${options.dimseTimeout}`)

  //   -pdu  --max-pdu  [n]umber of bytes: integer (4096..131072)
  //           set max receive pdu to n bytes (default: 16384)
  //
  if (options.maxPdu) command.push(`--max-pdu ${options.maxPdu}`)

  //         --max-send-pdu  [n]umber of bytes: integer (4096..131072)
  //           restrict max send pdu to n bytes
  if (options.maxSendPdu) command.push(`--max-send-pdu ${options.maxSendPdu}`)

  // ## output options
  // ### general:
  //
  //   +crf  --create-report-file  [f]ilename: string
  //           create a detailed report on the transfer
  //           (if successful) and write it to text file f
  if (options.createReportFile) command.push(`--create-report-file ${options.createReportFile}`)

  return execute(command.join(' '))
}

module.exports = dcmsend
