const findDCMTK = require('../findDCMTK')
const DCMProcess = require('../DCMProcess')
const dimseMessage = require('../events/dimseMessage')
// const pdu = require('../parsers/pdu')
const statusSummary = require('../events/dcmSend/statusSummary')
const addingDICOMFile = require('../events/dcmSend/addingDICOMFile')
const aAssociateAC = require('../events/aAssociateAC')
const aAssociateRQ = require('../events/aAssociateRQ')

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

const parsers = [
  {event: 'starting', regex: /^(?<level>\w): \$(?<message>dcmtk: (?<binary>[^]*?) (?<version>v\d+\.\d+.\d+) (?<date>[^]*?)) \$/},
  // {event: '', regex: /^(?<level>\w): (?<message>determining input files) .../},
  {event: 'checkingInputFiles', regex: /^(?<level>\w): (?<message>checking input files) .../},
  // {event: '', regex: /^(?<level>\w): (?<message>multiple associations allowed) \(option --multi-associations used\)/},
  // {
  //   event: '',
  //   regex: /^(?<level>\w): (?<message>preparing presentation context for SOP Class \/ Transfer Syntax: XRayAngiographicImageStorage \/ JPEG Baseline)/
  // },
  // {
  //   event: '',
  // eslint-disable-next-line max-len
  //   regex: /^(?<level>\w): (?<message>transfer syntax uses a lossy compression but we are not allowed to decompress it, so we are not proposing any uncompressed transfer syntax)/
  // },
  // {event: '', regex: /^(?<level>\w): (?<message>added new presentation context with ID \d*)/},
  // {
  //   event: '',
  // eslint-disable-next-line max-len
  //   regex: /^(?<level>\w): (?<message>same SOP Class UID and compatible Transfer Syntax UID as for another SOP instance, reusing the presentation context with ID \d*)/
  // },
  // {event: '', regex: /^(?<level>\w): (?<message>starting association #\d*)/},
  // {event: '', regex: /^(?<level>\w): (?<message>initializing network) .../},
  {event: 'sendingSOPInstances', regex: /^(?<level>\w): (?<message>sending SOP instances) .../},
  // {event: '', regex: /^(?<level>\w): (?<message>Configured a total of \d* presentation contexts for SCU)/},
  // {event: '', regex: /^(?<level>\w): (?<message>negotiating network association) .../},
  {event: 'requestingAssociation', regex: /^(?<level>\w): (?<message>Requesting Association)/},
  // {event: '', regex: /^(?<level>\w): (?<message>setting network send timeout to \d+ seconds)/},
  // {event: '', regex: /^(?<level>\w): (?<message>setting network receive timeout to \d+ seconds)/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>Constructing Associate RQ PDU)/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>Parsing an A-ASSOCIATE PDU)/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>checking whether SOP Class UID and SOP Instance UID in dataset are consistent with transfer list)/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>getting SOP Class UID, SOP Instance UID and Transfer Syntax UID from DICOM dataset)/},
  // {event: '', regex: /^(?<level>\w): (?<message>Sending C-STORE Request)/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>DcmDataset::read\(\) TransferSyntax="(?<transferSyntax>[^]*?)")/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>DcmMetaInfo::checkAndReadPreamble\(\) TransferSyntax="(?<transferSyntax>[^]*?)")/},
  {event: 'cStoreResponse', regex: /^(?<level>\w): (?<message>Received C-STORE Response)/},
  {event: 'sendingSOPInstance', regex: /^(?<level>\w): (?<message>sending SOP instance from file: (?<file>[^]*))\n/},
  {event: 'associationAccepted', regex: /^(?<level>\w): (?<message>Association Accepted \(Max Send PDV: (?<maxSendPDV>[^]*)\))\n/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>DcmSequenceOfItems: Length of item in sequence PixelData (?<tag>\([^]*?\)) is odd)\n/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>DcmElement::compact\(\) removed element value of (?<tag>\([^]*?\)) with (?<bytes>[^]*?) bytes)\n/},
  {event: 'releasingAssociation', regex: /^(?<level>\w): (?<message>Releasing Association)\n/},
  // {event: '', regex: /^(?<level>\w): (?<ignore>Cleaning up internal association and network structures)\n/},
  {
    event: 'totalInstances',
    // eslint-disable-next-line max-len
    regex: /^(?<level>\w): (?<message>in total, there are (?<totalInstances>[^]*?) SOP instances to be sent, (?<invalidInstances>[^]*?) invalid files are ignored)/
  },
  // {event: 'sendSummary', type: 'block', ...statusSummary},
  statusSummary,
  // {event: 'addingDICOMFile', type: 'block', ...addingDICOMFile},
  addingDICOMFile,
  // {event: 'aAssociateAC', type: 'block', ...aAssociateAC},
  aAssociateAC,
  // {event: 'aAssociateRQ', type: 'block', ...aAssociateRQ},
  aAssociateRQ,
  // {event: 'pdu', type: 'block', ...pdu},
  // {event: 'dimseMessage', type: 'block', ...dimseMessage},
  dimseMessage,
]

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
   * @param {number} [maxPDU=16384] set max receive pdu to number of bytes (4096..131072)
   * @param {number} maxSendPDU restrict max send pdu to n bytes (4096..131072)
   * @param {string} reportFile create a detailed report on the transfer (if successful) and write it to text file reportFile
   */
  constructor({
                peer, port = 104,
                inputFileFormat, inputFiles, scanPattern, recurse, decompress, compression,
                noHalt, noIllegalProposal, noUidChecks, AETitle, calledAETitle, association, timeout,
                acseTimeout = 30, dimseTimeout, maxPDU = 16384, maxSendPDU, reportFile,
              }) {
    super({_binary: findDCMTK().dcmsend, _parsers: parsers})

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
      this.start(this.#buildCommand({peer, port, dcmFileIn, AETitle, calledAETitle}))
      this.on('exit', (msg) => resolve(msg))
    })
  }

  async listDecoders() {
    return await this.execute([this._binary, '--debug', '--list-decoders'])
  }

  //endregion
}

module.exports = DCMSend


// const dcmSend = new DCMSend({
//   peer: '127.0.0.1', port: 104,
//   // dcmFileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\dicomSamples',
//   dcmFileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\dicomSamplesBad',
//   inputFiles: 'scan', recurse: true, compression: 0,
//   noHalt: true, noIllegalProposal: false, noUidChecks: true,
//   AETitle: 'dcmSend', calledAETitle: undefined,
//   timeout: 15, maxPDU: 131072, maxSendPDU: 131072, reportFile: undefined,
// })
// dcmSend.send({dcmFileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\dicomSamples\\1010_brain_mr_12_jpg'})
//   .then((msg) => console.log(JSON.stringify(msg, null, 2)))


// const dcmSend2 = new DCMSend({
//   peer: '127.0.0.1', port: 104,
//   // dcmFileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\dicomSamples',
//   dcmFileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\dicomSamplesBad',
//   inputFiles: 'scan', recurse: true, compression: 0,
//   noHalt: true, noIllegalProposal: false, noUidChecks: true,
//   AETitle: 'dcmSend2', calledAETitle: undefined,
//   timeout: 15, maxPDU: 131072, maxSendPDU: 131072, reportFile: undefined,
// })
// dcmSend2.send({dcmFileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\dicomSamples\\other'})
//   .then((msg) => console.log(JSON.stringify(msg, null, 2)))


// dcmSend.on('starting', (msg) => console.log(JSON.stringify(msg, null, 2)))
// dcmSend.send({dcmFileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\dicomSamplesBad'})


