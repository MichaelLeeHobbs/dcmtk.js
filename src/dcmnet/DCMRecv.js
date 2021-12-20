const findDCMTK = require('../findDCMTK')
const DCMProcess = require('../DCMProcess')
const statusSummary = require('../events/dcmSend/statusSummary')
const addingDICOMFile = require('../events/dcmSend/addingDICOMFile')
const aAssociateAC = require('../events/aAssociateAC')
const aAssociateRQ = require('../events/aAssociateRQ')
const dimseMessage = require('../events/dimseMessage')

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
  {event: 'sendSummary', type: 'block', ...statusSummary},
  {event: 'addingDICOMFile', type: 'block', ...addingDICOMFile},
  {event: 'aAssociateAC', type: 'block', ...aAssociateAC},
  {event: 'aAssociateRQ', type: 'block', ...aAssociateRQ},
  // {event: 'pdu', type: 'block', ...pdu},
  {event: 'dimseMessage', type: 'block', ...dimseMessage},
]

/**
 * DCM Receiver
 * @type {DCMRecv}
 */
class DCMRecv extends DCMProcess {
  /**
   *
   * @classdesc Class representing a DCM Receiver
   * @class DCMRecv
   * @param {number} [port=104] port number to listen on
   * @param {Object} configFile
   * @param {string} configFile.filename path to config file
   * @param {string} configFile.profile profile to use
   * @param {string} [AETitle='DCMRECV'] set my AE title
   * @param {boolean} useCalledAETitle always respond with called AE title
   * @param {number} [acseTimeout=30] seconds timeout for ACSE messages
   * @param {number} dimseTimeout seconds timeout for DIMSE messages (default: unlimited)
   * @param {number} [maxPDU=16384] set max receive pdu to number of bytes: integer (4096..131072)
   * @param {boolean} [disableHostnameLookup=false] disable hostname lookup
   * @param {Object} tls
   * @param {boolean} [tls.enable=false]
   * @param {(null|string)} [tls.passwd=null]
   * @param {('pem'|'der')} [tls.format='pem']
   * @param {Object} tls.ca
   * @param {string} tls.ca.file path to certificate file to add to list of certificates
   * @param {string} tls.ca.directory path to directory of certificates to add to list of certificates
   * @param {('bcp195'|'bcp195-nd'|'bcp195-ex'|'basic'|'aes'|null)} [tls.profile='bcp195'] security profile - BCP 195 TLS Profile (default), Non-downgrading
   * BCP 195 TLS Profile, Extended BCP 195 TLS Profile, Basic TLS Secure Transport Connection Profile (retired), AES TLS Secure Transport Connection Profile
   * (retired), Authenticated unencrypted communication (retired, was used in IHE ATNA)
   * @param {Object} tls.cipherSuite
   * @param {string} tls.cipherSuite.name
   * @param {string} tls.cipherSuite.dhparam path to file to read DH parameters for DH/DSS ciphersuites
   * @param {string} outputDirectory
   * @param {string} subdirectory
   * @param {('default'|'unique'|'short'|'system')} filenameGeneration
   * @param {string} filenameExtension
   * @param {('normal'|'preserving'|'ignore')} storageMode
   */
  constructor({
                port = 104, configFile, AETitle, useCalledAETitle = false,
                acseTimeout = 30, dimseTimeout, maxPDU = 16384, disableHostnameLookup = false,
                tls, outputDirectory, subdirectory = false, filenameGeneration, filenameExtension, storageMode
              }) {
    super({_binary: findDCMTK().dcmrecv, _parsers: parsers})

    this._port = port
    this._configFile = configFile
    this._AETitle = AETitle
    this._useCalledAETitle = useCalledAETitle
    this._acseTimeout = acseTimeout
    this._dimseTimeout = dimseTimeout
    this._maxPDU = maxPDU
    this._disableHostnameLookup = disableHostnameLookup
    this._tls = tls
    this._outputDirectory = outputDirectory
    this._subdirectory = subdirectory
    this._filenameGeneration = filenameGeneration
    this._filenameExtension = filenameExtension
    this._storageMode = storageMode
  }

  //region Getters/Setters
  get port() {
    return this._port
  }

  set port(value) {
    this._port = value
  }

  get configFile() {
    return this._configFile
  }

  set configFile(value) {
    this._configFile = value
  }

  get AETitle() {
    return this._AETitle
  }

  set AETitle(value) {
    this._AETitle = value
  }

  get useCalledAETitle() {
    return this._useCalledAETitle
  }

  set useCalledAETitle(value) {
    this._useCalledAETitle = value
  }

  get acseTimeout() {
    return this._acseTimeout
  }

  set acseTimeout(value) {
    this._acseTimeout = value
  }

  get dimseTimeout() {
    return this._dimseTimeout
  }

  set dimseTimeout(value) {
    this._dimseTimeout = value
  }

  get maxPDU() {
    return this._maxPDU
  }

  set maxPDU(value) {
    this._maxPDU = value
  }

  get disableHostnameLookup() {
    return this._disableHostnameLookup
  }

  set disableHostnameLookup(value) {
    this._disableHostnameLookup = value
  }

  get tls() {
    return this._tls
  }

  set tls(value) {
    this._tls = value
  }

  get outputDirectory() {
    return this._outputDirectory
  }

  set outputDirectory(value) {
    this._outputDirectory = value
  }

  get subdirectory() {
    return this._subdirectory
  }

  set subdirectory(value) {
    this._subdirectory = value
  }

  get filenameGeneration() {
    return this._filenameGeneration
  }

  set filenameGeneration(value) {
    this._filenameGeneration = value
  }

  get filenameExtension() {
    return this._filenameExtension
  }

  set filenameExtension(value) {
    this._filenameExtension = value
  }

  get storageMode() {
    return this._storageMode
  }

  set storageMode(value) {
    this._storageMode = value
  }

  _buildCommand() {
    const command = []
    if (this.configFile?.fileName && this.configFile?.profile) {
      command.push('--config-file', this.configFile.fileName, this.configFile.profile)
    }

    if (this.useCalledAETitle) {
      command.push('--use-called-aetitle')
    } else if (this.AETitle) {
      command.push('--aetitle', this.AETitle)
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
    if (this.disableHostnameLookup) {
      command.push('--disable-host-lookup', this.disableHostnameLookup)
    }
    if (this.tls) {
      console.warn('Due to a bug in DCMTK dcmrecv TLS is not support at this time.')
    }

    if (this.outputDirectory) {
      command.push('--output-directory', this.outputDirectory)
    }
    if (this.subdirectory) {
      command.push('--series-date-subdir')
    }

    if (this.filenameGeneration === 'default') {
      command.push('--default-filenames')
    } else if (this.filenameGeneration === 'unique') {
      command.push('--unique-filenames')
    } else if (this.filenameGeneration === 'short') {
      command.push('--short-unique-names')
    } else if (this.filenameGeneration === 'system') {
      command.push('--system-time-names')
    }

    if (this.filenameExtension) {
      command.push('--filename-extension', this.filenameExtension)
    }

    if (this.storageMode === 'normal') {
      command.push('--normal')
    } else if (this.storageMode === 'preserving') {
      if (this.subdirectory) {
        throw new Error('Option \'subdirectory = true\' is not compatible with storageMode = \'preserving\'.')
      }
      command.push('--bit-preserving')
    } else if (this.storageMode === 'ignore') {
      command.push('--ignore')
    }

    return command
  }

  async listCiphers() {
    return console.warn('Due to a bug in DCMTK dcmrecv TLS is not support at this time.')
    // const result = await this._execute([this._binary, '--debug', '--list-ciphers'])
    // return result
  }

  //endregion
}

module.exports = DCMRecv

// var test = new DCMRecv({})
// test.version().then(res => console.log(res))
// test.listCiphers().then(res => console.log(res))


/*
PARAMETERS
port  tcp/ip port number to listen on
OPTIONS
general options
  -h    --help
          print this help text and exit

        --version
          print version information and exit

        --arguments
          print expanded command line arguments

  -q    --quiet
          quiet mode, print no warnings and errors

  -v    --verbose
          verbose mode, print processing details

  -d    --debug
          debug mode, print debug information

  -ll   --log-level  [l]evel: string constant
          (fatal, error, warn, info, debug, trace)
          use level l for the logger

  -lc   --log-config  [f]ilename: string
          use config file f for the logger

  +v    --verbose-pc
          show presentation contexts in verbose mode
network options
association negotiation profile from configuration file:

  -xf   --config-file  [f]ilename, [p]rofile: string
          use profile p from configuration file f

application entity title:

  -aet  --aetitle  [a]etitle: string
          set my AE title (default: DCMRECV)

  -uca  --use-called-aetitle
          always respond with called AE title

other network options:

  -ta   --acse-timeout  [s]econds: integer (default: 30)
          timeout for ACSE messages

  -td   --dimse-timeout  [s]econds: integer (default: unlimited)
          timeout for DIMSE messages

  -pdu  --max-pdu  [n]umber of bytes: integer (4096..131072)
          set max receive pdu to n bytes (default: 16384)

  -dhl  --disable-host-lookup  disable hostname lookup
transport layer security (TLS) options
transport protocol stack:

  -tls  --disable-tls
          use normal TCP/IP connection (default)

  +tls  --enable-tls  [p]rivate key file, [c]ertificate file: string
          use authenticated secure TLS connection

private key password (only with --enable-tls):

  +ps   --std-passwd
          prompt user to type password on stdin (default)

  +pw   --use-passwd  [p]assword: string
          use specified password

  -pw   --null-passwd
          use empty string as password

key and certificate file format:

  -pem  --pem-keys
          read keys and certificates as PEM file (default)

  -der  --der-keys
          read keys and certificates as DER file

certification authority:

  +cf   --add-cert-file  [f]ilename: string
          add certificate file to list of certificates

  +cd   --add-cert-dir  [d]irectory: string
          add certificates in d to list of certificates

security profile:

  +px   --profile-bcp195
          BCP 195 TLS Profile (default)

  +py   --profile-bcp195-nd
          Non-downgrading BCP 195 TLS Profile

  +pz   --profile-bcp195-ex
          Extended BCP 195 TLS Profile

  +pb   --profile-basic
          Basic TLS Secure Transport Connection Profile (retired)

  +pa   --profile-aes
          AES TLS Secure Transport Connection Profile (retired)

  +pn   --profile-null
          Authenticated unencrypted communication
          (retired, was used in IHE ATNA)

ciphersuite:

  +cc   --list-ciphers
          show list of supported TLS ciphersuites and exit

  +cs   --cipher  [c]iphersuite name: string
          add ciphersuite to list of negotiated suites

  +dp   --dhparam  [f]ilename: string
          read DH parameters for DH/DSS ciphersuites

pseudo random generator:

  +rs   --seed  [f]ilename: string
          seed random generator with contents of f

  +ws   --write-seed
          write back modified seed (only with --seed)

  +wf   --write-seed-file  [f]ilename: string (only with --seed)
          write modified seed to file f

peer authentication:

  -rc   --require-peer-cert
          verify peer certificate, fail if absent (default)

  -vc   --verify-peer-cert
          verify peer certificate if present

  -ic   --ignore-peer-cert
          don't verify peer certificate
output options
general:

  -od   --output-directory  [d]irectory: string (default: ".")
          write received objects to existing directory d

subdirectory generation:

  -s    --no-subdir
          do not generate any subdirectories (default)

  +ssd  --series-date-subdir
          generate subdirectories from series date

filename generation:

  +fd   --default-filenames
          generate filename from instance UID (default)

  +fu   --unique-filenames
          generate unique filename based on new UID

  +fsu  --short-unique-names
          generate short pseudo-random unique filename

  +fst  --system-time-names
          generate filename from current system time

  -fe   --filename-extension  [e]xtension: string (default: none)
          append e to all generated filenames

storage mode:

  -B    --normal
          allow implicit format conversions (default)

  +B    --bit-preserving
          write dataset exactly as received

        --ignore
          ignore dataset, receive but do not store it
 */
