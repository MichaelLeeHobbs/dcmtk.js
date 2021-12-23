/* eslint-disable max-len */
const findDCMTK = require('../findDCMTK')
const DCMProcess = require('../DCMProcess')
const events = require('../events')

/**
 * Enum string values.
 * @enum {string}
 */
const SortBy = {
  timestamp: 'timestamp',
  UID: 'UID',
  patientname: 'patientname',
}

/**
 * DCM Receiver
 * @type {DCMRecv}
 */
class StoreSCP extends DCMProcess {
  #port
  #associationNegotiation
  #preferredTransferSyntaxes
  #socketTimeout
  #acseTimeout
  #dimseTimeout
  #aeTitle
  #maxPDU
  #disableHostLookup
  #refuseAssociation
  #rejectAssociation
  #ignoreStoreData
  #sleepAfter
  #sleepDuring
  #abortAfter
  #promiscuous
  #uidPadding
  #outputDirectory
  #bitPreserving
  #outputFileFormat
  #outputTransferSyntax
  #disableNewVR
  #groupLengthEncoding
  #lengthEncoding
  #padding
  #handlingOfDefinedLengthUNElements
  #compressionLevel
  #filenameGeneration
  #filenameExtension
  #sort

  /**
   * StoreSCP
   * @param {number} port port to listen on
   * @param {Object} [associationNegotiation] association negotiation profile from configuration file
   * @param {string} associationNegotiation.filename config file
   * @param {string} associationNegotiation.profile profile
   * @param {Array.<string>} preferredTransferSyntaxes referred network transfer syntaxes - possiable values: ('uncompressed'|'little-endian'|'big-endian'|'lossless'|'jpeg8'|'jpeg12'|'j2k-lossless'|'j2k-lossy'|'jls-lossless'|'mpeg2'|'mpeg2-high'|'mpeg4'|'mpeg4-bd'|'mpeg4-2-2d'|'mpeg4-2-3d'|'mpeg4-2-st'|'hevc'|'hevc10'|'rle'|'deflated'|'implicit'|'all')
   * @param {number} [socketTimeout=60] - timeout for network socket (0 for none)
   * @param {number} [acseTimeout=30] timeout for ACSE messages
   * @param {number} [dimseTimeout] timeout for DIMSE messages
   * @param {string} [aeTitle='STORESCP'] set my AE title
   * @param {number} [maxPDU=16384] set max receive pdu to number of bytes (4096..131072)
   * @param {boolean} [disableHostLookup=false] disable hostname lookup
   * @param {boolean} [refuseAssociation=false] refuse association
   * @param {boolean} [rejectAssociation=false] reject association if no implementation class UID
   * @param {boolean} [ignoreStoreData=false] ignore store data, receive but do not store
   * @param {number} [sleepAfter=0] sleep s seconds after store
   * @param {number} [sleepDuring=0] sleep s seconds during store
   * @param {boolean} [abortAfter=false] abort association after receipt of C-STORE-RQ
   * @param {boolean} [abortDuring=false] abort association during receipt of C-STORE-RQ
   * @param {boolean} [promiscuous=false] promiscuous mode, accept unknown SOP classes
   * @param {boolean} [uidPadding=false] silently correct space-padded UIDs
   * @param {string} outputDirectory write received objects to existing directory
   * @param {Object} [sort=] sorting into subdirectories (not with bitPreserving)
   * @param {SortBy} sort.by timestamp; sort studies using prefix and a timestamp, UID; sort studies using prefix and the
   * Study Instance UID, patientname; sort studies using the Patient's Name and a timestamp
   * @param {string} sort.prefix only with sort.by timestamp and UID
   * @param {boolean} [bitPreserving=false] true; write data exactly as read, false; allow implicit format conversions
   * @param {('file'|'dataset')} [outputFileFormat='file'] file; write file format, dataset; write data set without file meta information
   * @param {('same'|'little'|'big'|'implicit'|'deflated')} outputTransferSyntax output transfer syntax
   * @param {boolean} [disableNewVR=false] disable support for new VRs, convert to OB
   * @param {('recalc'|'create'|'remove')} [groupLengthEncoding='recalc'] group length encoding
   * @param {('explicit'|'undefined')} [lengthEncoding='explicit'] length encoding in sequences and items
   * @param {Object} [padding={}] data set trailing padding
   * @param {Object} padding.filePad align file on multiple of f bytes
   * @param {Object} padding.itemPad items on multiple of i bytes
   * @param {('retain'|'convert')} [handlingOfDefinedLengthUNElements='retain'] handling of defined length UN elements: retain elements as UN or convert to real
   * VR if known
   * @param {number} [compressionLevel=6] 0=uncompressed, 1=fastest, 9=best compression
   * @param {('default'|'unique'|'timenames')} [filenameGeneration='default'] default; generate filename from instance UID, unique; generate unique filenames,
   * timenames; generate filename from creation time
   * @param {string} filenameExtension append to all filenames
   */
  // eslint-disable-next-line max-statements
  constructor({
                associationNegotiation, preferredTransferSyntaxes = [],
                socketTimeout, acseTimeout = 30, dimseTimeout, aeTitle, maxPDU, disableHostLookup,
                refuseAssociation, rejectAssociation, ignoreStoreData, sleepAfter, sleepDuring, abortAfter, promiscuous, uidPadding,
                outputDirectory, bitPreserving, outputFileFormat, outputTransferSyntax, disableNewVR, groupLengthEncoding,
                lengthEncoding, padding = {}, handlingOfDefinedLengthUNElements, compressionLevel,
                filenameGeneration, filenameExtension, port, sort
              }) {
    super({binary: findDCMTK().storescp, events})
    this.#port = port
    this.#associationNegotiation = associationNegotiation
    this.#preferredTransferSyntaxes = preferredTransferSyntaxes
    this.#socketTimeout = socketTimeout
    this.#acseTimeout = acseTimeout
    this.#dimseTimeout = dimseTimeout
    this.#aeTitle = aeTitle
    this.#maxPDU = maxPDU
    this.#disableHostLookup = disableHostLookup
    this.#refuseAssociation = refuseAssociation
    this.#rejectAssociation = rejectAssociation
    this.#ignoreStoreData = ignoreStoreData
    this.#sleepAfter = sleepAfter
    this.#sleepDuring = sleepDuring
    this.#abortAfter = abortAfter
    this.#promiscuous = promiscuous
    this.#uidPadding = uidPadding
    this.#outputDirectory = outputDirectory
    this.#bitPreserving = bitPreserving
    this.#outputFileFormat = outputFileFormat
    this.#outputTransferSyntax = outputTransferSyntax
    this.#disableNewVR = disableNewVR
    this.#groupLengthEncoding = groupLengthEncoding
    this.#lengthEncoding = lengthEncoding
    this.#padding = padding
    this.#handlingOfDefinedLengthUNElements = handlingOfDefinedLengthUNElements
    this.#compressionLevel = compressionLevel
    this.#filenameGeneration = filenameGeneration
    this.#filenameExtension = filenameExtension
    this.#sort = sort
  }


  // eslint-disable-next-line max-statements
  #buildCommand({port = this.port}) {
    const command = []
    this.port = port


    // SYNOPSIS
    // storescp [options] [port]
    // DESCRIPTION
    // The storescp application implements a Service Class Provider (SCP) for the Storage Service Class. It listens on a specific TCP/IP port for incoming association requests from a Storage Service Class User (SCU) and can receive both DICOM images and other DICOM composite objects. The storescp application also supports the Verification Service Class as an SCP.
    //
    // PARAMETERS
    // port  tcp/ip port number to listen on
    //       (this parameter is required unless the --inetd option is specified)
    // OPTIONS
    // general options
    //   -h    --help
    //           print this help text and exit
    //
    //         --version
    //           print version information and exit
    //
    //         --arguments
    //           print expanded command line arguments
    //
    //   -q    --quiet
    //           quiet mode, print no warnings and errors
    //
    //   -v    --verbose
    //           verbose mode, print processing details
    //
    //   -d    --debug
    //           debug mode, print debug information
    //
    //   -ll   --log-level  [l]evel: string constant
    //           (fatal, error, warn, info, debug, trace)
    //           use level l for the logger
    //
    //   -lc   --log-config  [f]ilename: string
    //           use config file f for the logger
    //
    //   +v    --verbose-pc
    //           show presentation contexts in verbose mode

    command.push('--debug')

    // network options
    // association negotiation profile from configuration file:
    //
    //   -xf   --config-file  [f]ilename [p]rofile: string
    //           use profile p from config file f
    //
    if (this.associationNegotiation) {
      command.push('--config-file', this.associationNegotiation.filename, this.associationNegotiation.profile)
    }

    //region preferredTransferSyntaxes
    // preferred network transfer syntaxes (not with --config-file):
    //
    //   +x=   --prefer-uncompr
    //           prefer explicit VR local byte order (default)
    //
    if (this.preferredTransferSyntaxes.includes('uncompressed')) {
      command.push('--prefer-uncompr')
    }
    //   +xe   --prefer-little
    //           prefer explicit VR little endian TS
    //
    if (this.preferredTransferSyntaxes.includes('little-endian')) {
      command.push('--prefer-little')
    }
    //   +xb   --prefer-big
    //           prefer explicit VR big endian TS
    //
    if (this.preferredTransferSyntaxes.includes('big-endian')) {
      command.push('--prefer-big')
    }
    //   +xs   --prefer-lossless
    //           prefer default JPEG lossless TS
    //
    if (this.preferredTransferSyntaxes.includes('lossless')) {
      command.push('--prefer-lossless')
    }
    //   +xy   --prefer-jpeg8
    //           prefer default JPEG lossy TS for 8 bit data
    //
    if (this.preferredTransferSyntaxes.includes('jpeg8')) {
      command.push('--prefer-jpeg8')
    }
    //   +xx   --prefer-jpeg12
    //           prefer default JPEG lossy TS for 12 bit data
    //
    if (this.preferredTransferSyntaxes.includes('jpeg12')) {
      command.push('--prefer-jpeg12')
    }
    //   +xv   --prefer-j2k-lossless
    //           prefer JPEG 2000 lossless TS
    //
    if (this.preferredTransferSyntaxes.includes('j2k-lossless')) {
      command.push('--prefer-j2k-lossless')
    }
    //   +xw   --prefer-j2k-lossy
    //           prefer JPEG 2000 lossy TS
    //
    if (this.preferredTransferSyntaxes.includes('j2k-lossy')) {
      command.push('--prefer-j2k-lossy')
    }
    //   +xt   --prefer-jls-lossless
    //           prefer JPEG-LS lossless TS
    //
    if (this.preferredTransferSyntaxes.includes('jls-lossless')) {
      command.push('--prefer-jls-lossless')
    }
    //   +xu   --prefer-jls-lossy
    //           prefer JPEG-LS lossy TS
    //
    if (this.preferredTransferSyntaxes.includes('jls-lossy')) {
      command.push('--prefer-jls-lossy')
    }
    //   +xm   --prefer-mpeg2
    //           prefer MPEG2 Main Profile @ Main Level TS
    //
    if (this.preferredTransferSyntaxes.includes('mpeg2')) {
      command.push('--prefer-mpeg2')
    }
    //   +xh   --prefer-mpeg2-high
    //           prefer MPEG2 Main Profile @ High Level TS
    //
    if (this.preferredTransferSyntaxes.includes('mpeg2-high')) {
      command.push('--prefer-mpeg2-high')
    }
    //   +xn   --prefer-mpeg4
    //           prefer MPEG4 AVC/H.264 High Profile / Level 4.1 TS
    //
    if (this.preferredTransferSyntaxes.includes('mpeg4')) {
      command.push('--prefer-mpeg4')
    }
    //   +xl   --prefer-mpeg4-bd
    //           prefer MPEG4 AVC/H.264 BD-compatible HP / Level 4.1 TS
    //
    if (this.preferredTransferSyntaxes.includes('mpeg4-bd')) {
      command.push('--prefer-mpeg4-bd')
    }
    //   +x2   --prefer-mpeg4-2-2d
    //           prefer MPEG4 AVC/H.264 HP / Level 4.2 TS for 2D Videos
    //
    if (this.preferredTransferSyntaxes.includes('mpeg4-2-2d')) {
      command.push('--prefer-mpeg4-2-2d')
    }
    //   +x3   --prefer-mpeg4-2-3d
    //           prefer MPEG4 AVC/H.264 HP / Level 4.2 TS for 3D Videos
    //
    if (this.preferredTransferSyntaxes.includes('mpeg4-2-3d')) {
      command.push('--prefer-mpeg4-2-3d')
    }
    //   +xo   --prefer-mpeg4-2-st
    //           prefer MPEG4 AVC/H.264 Stereo HP / Level 4.2 TS
    //
    if (this.preferredTransferSyntaxes.includes('mpeg4-2-2-st')) {
      command.push('--prefer-mpeg4-2-2-st')
    }
    //   +x4   --prefer-hevc
    //           prefer HEVC H.265 Main Profile / Level 5.1 TS
    //
    if (this.preferredTransferSyntaxes.includes('hevc')) {
      command.push('--prefer-hevc')
    }
    //   +x5   --prefer-hevc10
    //           prefer HEVC H.265 Main 10 Profile / Level 5.1 TS
    //
    if (this.preferredTransferSyntaxes.includes('hevc10')) {
      command.push('--prefer-hevc10')
    }
    //   +xr   --prefer-rle
    //           prefer RLE lossless TS
    //
    if (this.preferredTransferSyntaxes.includes('rle')) {
      command.push('--prefer-rle')
    }
    //   +xd   --prefer-deflated
    //           prefer deflated explicit VR little endian TS
    //
    if (this.preferredTransferSyntaxes.includes('deflated')) {
      command.push('--prefer-deflated')
    }
    //   +xi   --implicit
    //           accept implicit VR little endian TS only
    //
    if (this.preferredTransferSyntaxes.includes('implicit')) {
      command.push('--prefer-implicit')
    }
    //   +xa   --accept-all
    //           accept all supported transfer syntaxes
    //
    if (this.preferredTransferSyntaxes.includes('all')) {
      command.push('--accept-all')
    }
    //endregion

    // network host access control (tcp wrapper):
    //
    //   -ac   --access-full
    //           accept connections from any host (default)
    //
    //   +ac   --access-control
    //           enforce host access control rules
    //
    // todo

    //   -ts   --socket-timeout  [s]econds: integer (default: 60)
    //           timeout for network socket (0 for none)
    //
    if (Number.isInteger(this.socketTimeout) && this.socketTimeout > -1) {
      command.push('--socket-timeout', this.socketTimeout)
    }
    //   -ta   --acse-timeout  [s]econds: integer (default: 30)
    //           timeout for ACSE messages
    //
    if (this.acseTimeout) {
      command.push('--acse-timeout', this.acseTimeout)
    }
    //   -td   --dimse-timeout  [s]econds: integer (default: unlimited)
    //           timeout for DIMSE messages
    //
    if (this.dimseTimeout) {
      command.push('--dimse-timeout', this.dimseTimeout)
    }

    //   -aet  --aetitle  [a]etitle: string
    //           set my AE title (default: STORESCP)
    //
    if (this.aeTitle) {
      command.push('--aetitle', this.aeTitle)
    }
    //   -pdu  --max-pdu  [n]umber of bytes: integer (4096..131072)
    //           set max receive pdu to n bytes (default: 16384)
    //
    if (this.maxPDU) {
      command.push('--max-pdu', this.maxPDU)
    }
    //   -dhl  --disable-host-lookup
    //           disable hostname lookup
    //
    if (this.disableHostLookup) {
      command.push('--disable-host-lookup')
    }
    //         --refuse
    //           refuse association
    //
    if (this.refuseAssociation) {
      command.push('--refuse')
    }
    //         --reject
    //           reject association if no implementation class UID
    //
    if (this.rejectAssociation) {
      command.push('--reject')
    }
    //         --ignore
    //           ignore store data, receive but do not store
    //
    if (this.ignoreStoreData) {
      command.push('--ignore')
    }
    //         --sleep-after  [s]econds: integer
    //           sleep s seconds after store (default: 0)
    //
    if (Number.isInteger(this.sleepAfter) && this.sleepAfter > -1) {
      command.push('--sleep-after', this.sleepAfter)
    }
    //         --sleep-during  [s]econds: integer
    //           sleep s seconds during store (default: 0)
    //
    if (Number.isInteger(this.sleepDuring) && this.sleepDuring > -1) {
      command.push('--sleep-during', this.sleepDuring)
    }
    //         --abort-after
    //           abort association after receipt of C-STORE-RQ
    //           (but before sending response)
    //
    if (this.abortAfter) {
      command.push('--abort-after')
    }
    //         --abort-during
    //           abort association during receipt of C-STORE-RQ
    //
    if (this.abortDuring) {
      command.push('--abort-during')
    }
    //   -pm   --promiscuous
    //           promiscuous mode, accept unknown SOP classes
    //           (not with --config-file)
    //
    if (this.promiscuous) {
      command.push('--promiscuous')
    }
    //   -up   --uid-padding
    //           silently correct space-padded UIDs
    if (this.uidPadding) {
      command.push('--uid-padding')
    }

    // transport layer security (TLS) options
    // transport protocol stack:
    //
    //   -tls  --disable-tls
    //           use normal TCP/IP connection (default)
    //
    //   +tls  --enable-tls  [p]rivate key file, [c]ertificate file: string
    //           use authenticated secure TLS connection
    //
    // todo TLS

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
    // todo TLS

    // key and certificate file format:
    //
    //   -pem  --pem-keys
    //           read keys and certificates as PEM file (default)
    //
    //   -der  --der-keys
    //           read keys and certificates as DER file
    //
    // todo TLS

    // certification authority:
    //
    //   +cf   --add-cert-file  [f]ilename: string
    //           add certificate file to list of certificates
    //
    //   +cd   --add-cert-dir  [d]irectory: string
    //           add certificates in d to list of certificates
    //
    // todo TLS

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
    // todo TLS

    // ciphersuite:
    //
    //   +cc   --list-ciphers
    //           show list of supported TLS ciphersuites and exit
    //
    //   +cs   --cipher  [c]iphersuite name: string
    //           add ciphersuite to list of negotiated suites
    //
    //   +dp   --dhparam  [f]ilename: string
    //           read DH parameters for DH/DSS ciphersuites
    //
    // todo TLS

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
    // todo TLS

    // peer authentication:
    //
    //   -rc   --require-peer-cert
    //           verify peer certificate, fail if absent (default)
    //
    //   -vc   --verify-peer-cert
    //           verify peer certificate if present
    //
    //   -ic   --ignore-peer-cert
    //           don't verify peer certificate
    // todo TLS

    // output options
    // general:
    //
    //   -od   --output-directory  [d]irectory: string (default: ".")
    //           write received objects to existing directory d
    //
    if (this.outputDirectory) {
      command.push('--output-directory', this.outputDirectory)
    }

    // bit preserving mode:
    //
    //   -B    --normal
    //           allow implicit format conversions (default)
    //
    //   +B    --bit-preserving
    //           write data exactly as read
    //
    command.push(this.bitPreserving ? '--bit-preserving' : '--normal')

    // output file format:
    //
    //   +F    --write-file
    //           write file format (default)
    //
    //   -F    --write-dataset
    //           write data set without file meta information
    //
    command.push(this.outputFileFormat === 'dataset' ? '--write-dataset' : '--write-file')

    // output transfer syntax
    // (not with --bit-preserving or compressed transmission):
    //
    //   +t=   --write-xfer-same
    //           write with same TS as input (default)
    //
    //   +te   --write-xfer-little
    //           write with explicit VR little endian TS
    //
    //   +tb   --write-xfer-big
    //           write with explicit VR big endian TS
    //
    //   +ti   --write-xfer-implicit
    //           write with implicit VR little endian TS
    //
    //   +td   --write-xfer-deflated
    //           write with deflated explicit VR little endian TS
    //
    if (this.outputTransferSyntax) {
      if (!['same', 'little', 'big', 'implicit', 'deflated'].includes(this.outputTransferSyntax)) {
        throw new Error('outputTransferSyntax must be one of \'same\', \'little\', \'big\', \'implicit\', \'deflated\' or undefined')
      }
      command.push(`--write-xfer-${this.outputTransferSyntax}`)
    }

    // post-1993 value representations (not with --bit-preserving):
    //
    //   +u    --enable-new-vr
    //           enable support for new VRs (UN/UT) (default)
    //
    //   -u    --disable-new-vr
    //           disable support for new VRs, convert to OB
    //
    if (this.disableNewVR) {
      command.push('--disable-new-vr')
    }


    // group length encoding (not with --bit-preserving):
    //
    //   +g=   --group-length-recalc
    //           recalculate group lengths if present (default)
    //
    //   +g    --group-length-create
    //           always write with group length elements
    //
    //   -g    --group-length-remove
    //           always write without group length elements
    //
    if (this.groupLengthEncoding) {
      if (!['recalc', 'create', 'remove'].includes(this.groupLengthEncoding)) {
        throw new Error('groupLengthEncoding must be one of \'recalc\', \'create\', \'remove\' or undefined')
      }
      command.push(`--group-length-${this.groupLengthEncoding}`)
    }
    // length encoding in sequences and items (not with --bit-preserving):
    //
    //   +e    --length-explicit
    //           write with explicit lengths (default)
    //
    //   -e    --length-undefined
    //           write with undefined lengths
    //
    if (this.lengthEncoding) {
      if (!['explicit', 'undefined'].includes(this.lengthEncoding)) {
        throw new Error('groupLengthEncoding must be one of \'explicit\', \'undefined\' or undefined')
      }
      command.push(`--length-${this.lengthEncoding}`)
    }

    // data set trailing padding
    // (not with --write-dataset or --bit-preserving):
    //
    //   -p    --padding-off
    //           no padding (default)
    //
    //   +p    --padding-create  [f]ile-pad [i]tem-pad: integer
    //           align file on multiple of f bytes and items on
    //           multiple of i bytes
    //
    if (this.padding?.filePad && this.padding?.itemPad) {
      command.push('--padding-create', this.padding?.filePad, this.padding?.itemPad)
    }

    // handling of defined length UN elements:
    //
    //   -uc   --retain-un
    //           retain elements as UN (default)
    //
    //   +uc   --convert-un
    //           convert to real VR if known
    //
    if (this.handlingOfDefinedLengthUNElements) {
      if (!['retain', 'convert'].includes(this.handlingOfDefinedLengthUNElements)) {
        throw new Error('handlingOfDefinedLengthUNElements must be one of \'retain\', \'convert\' or undefined')
      }
      command.push(`--${this.handlingOfDefinedLengthUNElements}-un`)
    }

    // deflate compression level (only with --write-xfer-deflated/same):
    //
    //   +cl   --compression-level  [l]evel: integer (default: 6)
    //           0=uncompressed, 1=fastest, 9=best compression
    //
    if (Number.isInteger(this.compressionLevel) && this.compressionLevel > -1 && this.compressionLevel < 10) {
      command.push('--compression-level', this.compressionLevel)
    }

    // sorting into subdirectories (not with --bit-preserving):
    //
    //   -ss   --sort-conc-studies  [p]refix: string
    //           sort studies using prefix p and a timestamp
    //
    //   -su   --sort-on-study-uid  [p]refix: string
    //           sort studies using prefix p and the Study Instance UID
    //
    //   -sp   --sort-on-patientname
    //           sort studies using the Patient's Name and a timestamp
    //
    if (this.sort) {
      if (this.sort.by === 'timestamp') {
        command.push('--sort-conc-studies', this.sort.prefix)
      } else if (this.sort.by === 'UID') {
        command.push('--sort-on-study-uid', this.sort.prefix)
      } else if (this.sort.by === 'patientname') {
        command.push('--sort-on-patientname')
      }

    }

    // filename generation:
    //
    //   -uf   --default-filenames
    //           generate filename from instance UID (default)
    //
    //   +uf   --unique-filenames
    //           generate unique filenames
    //
    //   -tn   --timenames
    //           generate filename from creation time
    //
    if (this.filenameGeneration) {
      if (!['default', 'unique', 'timenames'].includes(this.filenameGeneration)) {
        throw new Error('filenameGeneration must be one of \'default\', \'unique\', \'timenames\' or undefined')
      }
      if (this.filenameGeneration === 'timenames') {
        command.push('--timenames')
      } else {
        command.push(`--${this.filenameGeneration}-filenames`)
      }
    }

    //   -fe   --filename-extension  [e]xtension: string
    //           append e to all filenames
    if (this.filenameExtension) {
      command.push('--filename-extension', this.filenameExtension)
    }

    // command.push('--exec-on-reception', 'echo', '\\"{"directory": "#p", "file": "#f", "callingAET": "#a", "calledAET": "#c", "host": "#r"}\\"')
    // command.push('--exec-on-reception', '# #p:#f:#a:#c:#r')
    command.push('--exec-on-reception', '# "{"directory": "#p", "file": "#f", "callingAET": #a, "calledAET": #c, "host": "#r"}"')

    command.push(this.port)
    return command
  }

  /**
   * Starts listening on port
   * @param {Number} [port=] defaults to StoreSCP.port or 104
   * @fires StoreSCP#starting
   * @return {Promise | Promise<unknown>}
   */
  listen(port) {
    return this.start(this.#buildCommand({port}))
  }

  /**
   * Stop listening
   * @return {Promise<unknown>}
   */
  close() {
    return this.stop()
  }

  // async listDecoders() {
  //   return await this.execute(['--debug', '--list-decoders'])
  // }

  //region Getters/Setters
  get port() {
    return this.#port
  }

  set port(value) {
    this.#port = value
  }

  get associationNegotiation() {
    return this.#associationNegotiation
  }

  set associationNegotiation(value) {
    this.#associationNegotiation = value
  }

  get preferredTransferSyntaxes() {
    return this.#preferredTransferSyntaxes
  }

  set preferredTransferSyntaxes(value) {
    this.#preferredTransferSyntaxes = value
  }

  get socketTimeout() {
    return this.#socketTimeout
  }

  set socketTimeout(value) {
    this.#socketTimeout = value
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

  get aeTitle() {
    return this.#aeTitle
  }

  set aeTitle(value) {
    this.#aeTitle = value
  }

  get maxPDU() {
    return this.#maxPDU
  }

  set maxPDU(value) {
    this.#maxPDU = value
  }

  get disableHostLookup() {
    return this.#disableHostLookup
  }

  set disableHostLookup(value) {
    this.#disableHostLookup = value
  }

  get refuseAssociation() {
    return this.#refuseAssociation
  }

  set refuseAssociation(value) {
    this.#refuseAssociation = value
  }

  get rejectAssociation() {
    return this.#rejectAssociation
  }

  set rejectAssociation(value) {
    this.#rejectAssociation = value
  }

  get ignoreStoreData() {
    return this.#ignoreStoreData
  }

  set ignoreStoreData(value) {
    this.#ignoreStoreData = value
  }

  get sleepAfter() {
    return this.#sleepAfter
  }

  set sleepAfter(value) {
    this.#sleepAfter = value
  }

  get sleepDuring() {
    return this.#sleepDuring
  }

  set sleepDuring(value) {
    this.#sleepDuring = value
  }

  get abortAfter() {
    return this.#abortAfter
  }

  set abortAfter(value) {
    this.#abortAfter = value
  }

  get promiscuous() {
    return this.#promiscuous
  }

  set promiscuous(value) {
    this.#promiscuous = value
  }

  get uidPadding() {
    return this.#uidPadding
  }

  set uidPadding(value) {
    this.#uidPadding = value
  }

  get outputDirectory() {
    return this.#outputDirectory
  }

  set outputDirectory(value) {
    this.#outputDirectory = value
  }

  get bitPreserving() {
    return this.#bitPreserving
  }

  set bitPreserving(value) {
    this.#bitPreserving = value
  }

  get outputFileFormat() {
    return this.#outputFileFormat
  }

  set outputFileFormat(value) {
    this.#outputFileFormat = value
  }

  get outputTransferSyntax() {
    return this.#outputTransferSyntax
  }

  set outputTransferSyntax(value) {
    this.#outputTransferSyntax = value
  }

  get disableNewVR() {
    return this.#disableNewVR
  }

  set disableNewVR(value) {
    this.#disableNewVR = value
  }

  get groupLengthEncoding() {
    return this.#groupLengthEncoding
  }

  set groupLengthEncoding(value) {
    this.#groupLengthEncoding = value
  }

  get lengthEncoding() {
    return this.#lengthEncoding
  }

  set lengthEncoding(value) {
    this.#lengthEncoding = value
  }

  get padding() {
    return this.#padding
  }

  set padding(value) {
    this.#padding = value
  }

  get handlingOfDefinedLengthUNElements() {
    return this.#handlingOfDefinedLengthUNElements
  }

  set handlingOfDefinedLengthUNElements(value) {
    this.#handlingOfDefinedLengthUNElements = value
  }

  get compressionLevel() {
    return this.#compressionLevel
  }

  set compressionLevel(value) {
    this.#compressionLevel = value
  }

  get filenameGeneration() {
    return this.#filenameGeneration
  }

  set filenameGeneration(value) {
    this.#filenameGeneration = value
  }

  get filenameExtension() {
    return this.#filenameExtension
  }

  set filenameExtension(value) {
    this.#filenameExtension = value
  }

  get sort() {
    return this.#sort
  }

  set sort(value) {
    this.#sort = value
  }
  //endregion
}

/**
 * Start Listening
 * @event StoreSCP#starting
 * @type {object}
 * @property {string} level Event level
 * @property {Date} dt date/time of the event
 * @property {string} message
 * @property {string} binary
 * @property {string} version
 */

module.exports = StoreSCP
