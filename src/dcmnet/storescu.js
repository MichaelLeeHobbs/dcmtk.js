const findDCMTK = require('../findDCMTK')
const DCMProcess = require('../DCMProcess')
const events = require('../events')

/**
 * DCM Receiver
 * @type {DCMRecv}
 */
class StoreSCU extends DCMProcess {
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


  constructor({
                peer, port = 104,
                inputFileFormat, inputFiles, scanPattern, recurse, decompress, compression,
                noHalt, noIllegalProposal, noUidChecks, AETitle, calledAETitle, association, timeout,
                acseTimeout = 30, dimseTimeout, maxPDU = 16384, maxSendPDU, reportFile,
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

    // input options
    // input file format:
    //
    //   +f    --read-file
    //           read file format or data set (default)
    //
    //   +fo   --read-file-only
    //           read file format only
    //
    //   -f    --read-dataset
    //           read data set without file meta information
    //
    if (this.inputFileFormat === 'formatOrData') {
      command.push('--read-file')
    } else if (this.inputFileFormat === 'format') {
      command.push('--read-file-only')
    } else if (this.inputFileFormat === 'data') {
      command.push('--read-dataset')
    }

    // input files:
    //
    //   +sd   --scan-directories
    //           scan directories for input files (dcmfile-in)
    //
    //   +sp   --scan-pattern  [p]attern: string (only with --scan-directories)
    //           pattern for filename matching (wildcards)
    //
    //           # possibly not available on all systems
    //
    //   -r    --no-recurse
    //           do not recurse within directories (default)
    //
    //   +r    --recurse
    //           recurse within specified directories
    //
    //   -rn   --no-rename
    //           do not rename processed files (default)
    //
    //   +rn   --rename
    //           append .done/.bad to processed files
    // network options
    // application entity titles:
    //
    //   -aet  --aetitle  [a]etitle: string
    //           set my calling AE title (default: STORESCU)
    //
    //   -aec  --call  [a]etitle: string
    //           set called AE title of peer (default: ANY-SCP)
    //
    // association negotiation profile from configuration file:
    //
    //   -xf   --config-file  [f]ilename, [p]rofile: string
    //           use profile p from config file f
    //
    // proposed transmission transfer syntaxes (not with --config-file):
    //
    //   -x=   --propose-uncompr
    //           propose all uncompressed TS, explicit VR
    //           with local byte ordering first (default)
    //
    //   -xe   --propose-little
    //           propose all uncompressed TS, explicit VR little endian first
    //
    //   -xb   --propose-big
    //           propose all uncompressed TS, explicit VR big endian first
    //
    //   -xi   --propose-implicit
    //           propose implicit VR little endian TS only
    //
    //   -xs   --propose-lossless
    //           propose default JPEG lossless TS
    //           and all uncompressed transfer syntaxes
    //
    //   -xy   --propose-jpeg8
    //           propose default JPEG lossy TS for 8 bit data
    //           and all uncompressed transfer syntaxes
    //
    //   -xx   --propose-jpeg12
    //           propose default JPEG lossy TS for 12 bit data
    //           and all uncompressed transfer syntaxes
    //
    //   -xv   --propose-j2k-lossless
    //           propose JPEG 2000 lossless TS
    //           and all uncompressed transfer syntaxes
    //
    //   -xw   --propose-j2k-lossy
    //           propose JPEG 2000 lossy TS
    //           and all uncompressed transfer syntaxes
    //
    //   -xt   --propose-jls-lossless
    //           propose JPEG-LS lossless TS
    //           and all uncompressed transfer syntaxes
    //
    //   -xu   --propose-jls-lossy
    //           propose JPEG-LS lossy TS
    //           and all uncompressed transfer syntaxes
    //
    //   -xm   --propose-mpeg2
    //           propose MPEG2 Main Profile @ Main Level TS only
    //
    //   -xh   --propose-mpeg2-high
    //           propose MPEG2 Main Profile @ High Level TS only
    //
    //   -xn   --propose-mpeg4
    //           propose MPEG4 AVC/H.264 High Profile / Level 4.1 TS only
    //
    //   -xl   --propose-mpeg4-bd
    //           propose MPEG4 AVC/H.264 BD-compatible HP / Level 4.1 TS only
    //
    //   -x2   --propose-mpeg4-2-2d
    //           propose MPEG4 AVC/H.264 HP / Level 4.2 TS for 2D Videos only
    //
    //   -x3   --propose-mpeg4-2-3d
    //           propose MPEG4 AVC/H.264 HP / Level 4.2 TS for 3D Videos only
    //
    //   -xo   --propose-mpeg4-2-st
    //           propose MPEG4 AVC/H.264 Stereo HP / Level 4.2 TS only
    //
    //   -x4   --propose-hevc
    //           propose HEVC H.265 Main Profile / Level 5.1 TS only
    //
    //   -x5   --propose-hevc10
    //           propose HEVC H.265 Main 10 Profile / Level 5.1 TS only
    //
    //   -xr   --propose-rle
    //           propose RLE lossless TS
    //           and all uncompressed transfer syntaxes
    //
    //   -xd   --propose-deflated
    //           propose deflated explicit VR little endian TS
    //           and all uncompressed transfer syntaxes
    //
    //   -R    --required
    //           propose only required presentation contexts
    //           (default: propose all supported)
    //
    //           # This will also work with storage SOP classes that are
    //           # supported by DCMTK but are not in the list of SOP classes
    //           # proposed by default.
    //
    //   +C    --combine
    //           combine proposed transfer syntaxes
    //           (default: separate presentation context for each TS)
    //
    // post-1993 value representations:
    //
    //   +u    --enable-new-vr
    //           enable support for new VRs (UN/UT) (default)
    //
    //   -u    --disable-new-vr
    //           disable support for new VRs, convert to OB
    //
    // deflate compression level (only with --propose-deflated or --config-file):
    //
    //   +cl   --compression-level  [l]evel: integer (default: 6)
    //           0=uncompressed, 1=fastest, 9=best compression
    //
    // user identity negotiation:
    //
    //   -usr  --user  [u]ser name: string
    //           authenticate using user name u
    //
    //   -pwd  --password  [p]assword: string (only with --user)
    //           authenticate using password p
    //
    //   -epw  --empty-password
    //           send empty password (only with --user)
    //
    //   -kt   --kerberos  [f]ilename: string
    //           read kerberos ticket from file f
    //
    //         --saml  [f]ilename: string
    //           read SAML request from file f
    //
    //         --jwt  [f]ilename: string
    //           read JWT data from file f
    //
    //   -rsp  --pos-response
    //           expect positive response
    //
    // other network options:
    //
    //   -to   --timeout  [s]econds: integer (default: unlimited)
    //           timeout for connection requests
    //
    //   -ts   --socket-timeout  [s]econds: integer (default: 60)
    //           timeout for network socket (0 for none)
    //
    //   -ta   --acse-timeout  [s]econds: integer (default: 30)
    //           timeout for ACSE messages
    //
    //   -td   --dimse-timeout  [s]econds: integer (default: unlimited)
    //           timeout for DIMSE messages
    //
    //   -pdu  --max-pdu  [n]umber of bytes: integer (4096..131072)
    //           set max receive pdu to n bytes (default: 16384)
    //
    //         --max-send-pdu  [n]umber of bytes: integer (4096..131072)
    //           restrict max send pdu to n bytes
    //
    //         --repeat  [n]umber: integer
    //           repeat n times
    //
    //         --abort
    //           abort association instead of releasing it
    //
    //   -nh   --no-halt
    //           do not halt if unsuccessful store encountered
    //           (default: do halt)
    //
    //   -up   --uid-padding
    //           silently correct space-padded UIDs
    //
    //   +II   --invent-instance
    //           invent a new SOP instance UID for every image sent
    //
    //   +IR   --invent-series  [n]umber: integer (implies --invent-instance)
    //           invent a new series UID after n images have been sent
    //           (default: 100)
    //
    //   +IS   --invent-study  [n]umber: integer (implies --invent-instance)
    //           invent a new study UID after n series have been sent
    //           (default: 50)
    //
    //   +IP   --invent-patient  [n]umber: integer (implies --invent-instance)
    //           invent a new patient ID and name after n studies have been sent
    //           (default: 25)
    // transport layer security (TLS) options
    // transport protocol stack:
    //
    //   -tls  --disable-tls
    //           use normal TCP/IP connection (default)
    //
    //   +tls  --enable-tls  [p]rivate key file, [c]ertificate file: string
    //           use authenticated secure TLS connection
    //
    //   +tla  --anonymous-tls
    //           use secure TLS connection without certificate
    //
    // private key password (only with --enable-tls):
    //
    //   +ps   --std-passwd
    //           prompt user to type password on stdin (default)
    //
    //   +pw   --use-passwd  [p]assword: string
    //           use specified password
    //
    //   -pw   --null-passwd
    //           use empty string as password
    //
    // key and certificate file format:
    //
    //   -pem  --pem-keys
    //           read keys and certificates as PEM file (default)
    //
    //   -der  --der-keys
    //           read keys and certificates as DER file
    //
    // certification authority:
    //
    //   +cf   --add-cert-file  [f]ilename: string
    //           add certificate file to list of certificates
    //
    //   +cd   --add-cert-dir  [d]irectory: string
    //           add certificates in d to list of certificates
    //
    // security profile:
    //
    //   +px   --profile-bcp195
    //           BCP 195 TLS Profile (default)
    //
    //   +py   --profile-bcp195-nd
    //           Non-downgrading BCP 195 TLS Profile
    //
    //   +pz   --profile-bcp195-ex
    //           Extended BCP 195 TLS Profile
    //
    //   +pb   --profile-basic
    //           Basic TLS Secure Transport Connection Profile (retired)
    //
    //   +pa   --profile-aes
    //           AES TLS Secure Transport Connection Profile (retired)
    //
    //   +pn   --profile-null
    //           Authenticated unencrypted communication
    //           (retired, was used in IHE ATNA)
    //
    // ciphersuite:
    //
    //   +cc   --list-ciphers
    //           show list of supported TLS ciphersuites and exit
    //
    //   +cs   --cipher  [c]iphersuite name: string
    //           add ciphersuite to list of negotiated suites
    //
    // pseudo random generator:
    //
    //   +rs   --seed  [f]ilename: string
    //           seed random generator with contents of f
    //
    //   +ws   --write-seed
    //           write back modified seed (only with --seed)
    //
    //   +wf   --write-seed-file  [f]ilename: string (only with --seed)
    //           write modified seed to file f
    //
    // peer authentication:
    //
    //   -rc   --require-peer-cert
    //           verify peer certificate, fail if absent (default)
    //
    //   -ic   --ignore-peer-cert
    //           don't verify peer certificate


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
    if (this._process) {
      throw new Error('Send already in progress!')
    }

    return this.start(this.#buildCommand({peer, port, dcmFileIn, AETitle, calledAETitle}))
  }

  async listDecoders() {
    return await this.execute([this._binary, '--debug', '--list-decoders'])
  }

  //endregion
}

module.exports = StoreSCU
