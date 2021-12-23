const findDCMTK = require('../findDCMTK')
const DCMProcess = require('../DCMProcess')
const events = require('../events')
// todo
//     'D: Association Rejected:',
//     'D: Result: Rejected Permanent, Source: Service User',
//     'D: Reason: No Reason',
//     'F: cannot negotiate network association: DUL Association Rejected',
//     'D: Cleaning up internal association and network structures'

// todo
//     'E: No Acceptable Presentation Contexts',
//     'E: cannot negotiate network association: No acceptable Presentation Contexts',
//     'I: Releasing Association',
//     'D: Cleaning up internal association and network structures',

/**
 * DCM Receiver
 * @type {DCMRecv}
 */
class DCMSend extends DCMProcess {
  #port
  #AETitle
  #acseTimeout
  #dimseTimeout
  #maxPDU
  #peer
  #inputFileFormat
  #inputFiles
  #scanPattern
  #recurse
  #decompress
  #compression
  #noHalt
  #noIllegalProposal
  #noUidChecks
  #calledAETitle
  #association
  #timeout
  #maxSendPDU
  #reportFile

  /**
   *
   * @classdesc Class representing a DCM Sender
   * @class DCMSend
   * @param {string} peer ip or hostname of DICOM peer
   * @param {number} [port=104] port number to listen on
   * @param {('formatOrData'|'format'|'data')} inputFileFormat formatOrData; read file format or data set, format; read file format only (default), data; read
   * data set without file meta information
   * @param {('dicomdir'|'scan')} inputFiles
   * @param {string} scanPattern pattern for filename matching (wildcards) only with inputFiles = scan
   * @param {boolean} [recurse=false] recurse within specified directories
   * @param {('never'|'lossless'|'lossy')} decompress never; never decompress compressed data sets, lossless; only decompress lossless compression (default),
   * lossy; decompress both lossy and lossless compression
   * @param {number} compression 0=uncompressed, 1=fastest, 9=best compression
   * @param {boolean} [noHalt=false] do not halt on first invalid input file or if unsuccessful store encountered
   * @param {boolean} [noIllegalProposal=false] do not propose any presentation context that does not contain the default transfer syntax (if needed)
   * @param {boolean} [noUidChecks=false] do not check UID values of input files
   * @param {string} [AETitle='DCMSEND'] set my AE title
   * @param {string} [calledAETitle='ANY-SCP'] set called AE title of peer (default: ANY-SCP)
   * @param {('multi'|'single')} [association='multi'] multi; use multiple associations (one after the other) if needed to transfer the instances (default),
   * single; always use a single association
   * @param {number} timeout timeout for connection requests (default: unlimited)
   * @param {number} [acseTimeout=30] seconds timeout for ACSE messages
   * @param {number} dimseTimeout seconds timeout for DIMSE messages (default: unlimited)
   * @param {number} [maxPDU=131072] set max receive pdu to number of bytes (4096..131072)
   * @param {number} [maxSendPDU=131072] restrict max send pdu to n bytes (4096..131072)
   * @param {string} reportFile create a detailed report on the transfer (if successful) and write it to text file reportFile
   */
  constructor({
                peer, port = 104,
                inputFileFormat, inputFiles, scanPattern, recurse, decompress, compression,
                noHalt, noIllegalProposal, noUidChecks, AETitle, calledAETitle, association, timeout,
                acseTimeout = 30, dimseTimeout, maxPDU = 131072, maxSendPDU = 131072, reportFile,
              }) {
    super({binary: findDCMTK().dcmsend, events})

    this.#port = port
    this.#AETitle = AETitle
    this.#acseTimeout = acseTimeout
    this.#dimseTimeout = dimseTimeout
    this.#maxPDU = maxPDU
    this.#peer = peer
    this.#inputFileFormat = inputFileFormat
    this.#inputFiles = inputFiles
    this.#scanPattern = scanPattern
    this.#recurse = recurse
    this.#decompress = decompress
    this.#compression = compression
    this.#noHalt = noHalt
    this.#noIllegalProposal = noIllegalProposal
    this.#noUidChecks = noUidChecks
    this.#calledAETitle = calledAETitle
    this.#association = association
    this.#timeout = timeout
    this.#maxSendPDU = maxSendPDU
    this.#reportFile = reportFile

    if (maxPDU % maxSendPDU !== 0) {
      throw new Error(`Invalid maxPDU ${maxPDU} and maxSendPDU ${maxSendPDU}! maxPDU % maxSendPDU === 0 must be true!`)
    }
  }

  /**
   *
   * @param peer
   * @param port
   * @param dcmFileIn
   * @param AETitle
   * @param calledAETitle
   * @return {string[]}
   */
  #buildCommand({peer, port, dcmFileIn, AETitle, calledAETitle}) {
    const command = []
    this.peer = peer || this.peer
    this.port = port || this.port
    this.AETitle = AETitle || this.AETitle
    this.calledAETitle = calledAETitle || this.calledAETitle

    if (!this.peer) {
      throw new Error('"peer" cannot be undefined.')
    }
    if (!this.port) {
      throw new Error('"port" cannot be undefined.')
    }
    if (!dcmFileIn) {
      throw new Error('"dcmFileIn" cannot be undefined.')
    }

    command.push(this.peer, this.port, dcmFileIn, '--debug')

    if (this.inputFileFormat === 'formatOrData') {
      command.push('--read-file')
    } else if (this.inputFileFormat === 'format') {
      command.push('--read-file-only')
    } else if (this.inputFileFormat === 'data') {
      command.push('--read-dataset')
    }

    if (this.inputFiles === 'dicomdir') {
      command.push('--read-from-dicomdir')
    } else if (this.inputFiles === 'scan') {
      command.push('--scan-directories')
    }

    if (this.scanPattern) {
      if (this.inputFiles !== 'scan') {
        throw new Error('"scanPattern" called without "inputFileFormat = scan".')
      }
      command.push('--scan-pattern', this.scanPattern)
    }

    if (this.recurse) {
      command.push('--recurse')
    }

    if (this.decompress === 'never') {
      command.push('--decompress-never')
    } else if (this.decompress === 'lossless') {
      command.push('--decompress-lossless')
    } else if (this.decompress === 'lossy') {
      command.push('--decompress-lossy')
    }

    if (this.compression !== undefined) {
      command.push('--compression-level', this.compression)
    }

    if (this.noHalt) {
      command.push('--no-halt')
    }

    if (this.noIllegalProposal) {
      command.push('--no-illegal-proposal')
    }

    if (this.noUidChecks) {
      command.push('--no-uid-checks')
    }

    if (this.AETitle) {
      command.push('--aetitle', this.AETitle)
    }

    if (this.calledAETitle) {
      command.push('--call', this.calledAETitle)
    }

    if (this.association === 'multi') {
      command.push('--multi-associations')
    }

    if (this.association === 'single') {
      command.push('--single-associations')
    }

    if (this.timeout) {
      command.push('--timeout', this.timeout)
    }

    if (this.acseTimeout) {
      command.push('--acse-timeout', this.acseTimeout)
    }

    if (this.dimseTimeout) {
      command.push('--dimse-timeout', this.dimseTimeout)
    }

    if (this.maxPDU) {
      command.push('--max-pdu', this.maxPDU)
    }

    if (this.maxSendPDU) {
      command.push('--max-send-pdu', this.maxSendPDU)
    }

    if (this.reportFile) {
      command.push('--create-report-file', this.reportFile)
    }

    return command
  }

  /**
   * Send dicom
   * @param {string} [peer=] ip or hostname of DICOM peer
   * @param {number} [port=] port number to listen on
   * @param {string} dcmFileIn DICOM file or directory to be transmitted
   * @param {string=} [AETitle='DCMSEND'] my AE title
   * @param {string=} [calledAETitle='ANY-SCP'] called AE title of peer (default: ANY-SCP)
   */
  send({peer, port, dcmFileIn, AETitle, calledAETitle}) {
    return new Promise((resolve, reject) => {
      this.start(this.#buildCommand({peer, port, dcmFileIn, AETitle, calledAETitle}), 100)
      this.once('exit', (msg) => resolve(msg))
    })
  }

  async listDecoders() {
    return await this.execute([this._binary, '--debug', '--list-decoders'])
  }

  //region Getters/Setters
  get peer() {
    return this.#peer
  }

  set peer(value) {
    this.#peer = value
  }

  get port() {
    return this.#port
  }

  set port(value) {
    this.#port = value
  }

  get inputFileFormat() {
    return this.#inputFileFormat
  }

  set inputFileFormat(value) {
    this.#inputFileFormat = value
  }

  get inputFiles() {
    return this.#inputFiles
  }

  set inputFiles(value) {
    this.#inputFiles = value
  }

  get scanPattern() {
    return this.#scanPattern
  }

  set scanPattern(value) {
    this.#scanPattern = value
  }

  get recurse() {
    return this.#recurse
  }

  set recurse(value) {
    this.#recurse = value
  }

  get decompress() {
    return this.#decompress
  }

  set decompress(value) {
    this.#decompress = value
  }

  get compression() {
    return this.#compression
  }

  set compression(value) {
    this.#compression = value
  }

  get noHalt() {
    return this.#noHalt
  }

  set noHalt(value) {
    this.#noHalt = value
  }

  get noIllegalProposal() {
    return this.#noIllegalProposal
  }

  set noIllegalProposal(value) {
    this.#noIllegalProposal = value
  }

  get noUidChecks() {
    return this.#noUidChecks
  }

  set noUidChecks(value) {
    this.#noUidChecks = value
  }

  get AETitle() {
    return this.#AETitle
  }

  set AETitle(value) {
    this.#AETitle = value
  }

  get calledAETitle() {
    return this.#calledAETitle
  }

  set calledAETitle(value) {
    this.#calledAETitle = value
  }

  get association() {
    return this.#association
  }

  set association(value) {
    this.#association = value
  }

  get timeout() {
    return this.#timeout
  }

  set timeout(value) {
    this.#timeout = value
  }

  get acseTimeout() {
    return this.#acseTimeout
  }

  set acseTimeout(value) {
    this.#acseTimeout = value
  }

  get dimseTimeout() {
    return this.#dimseTimeout
  }

  set dimseTimeout(value) {
    this.#dimseTimeout = value
  }

  get maxPDU() {
    return this.#maxPDU
  }

  set maxPDU(value) {
    this.#maxPDU = value
  }

  get maxSendPDU() {
    return this.#maxSendPDU
  }

  set maxSendPDU(value) {
    this.#maxSendPDU = value
  }

  get reportFile() {
    return this.#reportFile
  }

  set reportFile(value) {
    this.#reportFile = value
  }

  //endregion
}

module.exports = DCMSend
