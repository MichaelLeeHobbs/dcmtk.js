const findDCMTK = require('../findDCMTK')
const DCMProcess = require('../DCMProcess')
const events = require('../events')

/**
 * DCM Receiver
 * @type {DCMRecv}
 */
class DCMRecv extends DCMProcess {
  #port
  #configFile
  #AETitle
  #useCalledAETitle
  #acseTimeout
  #dimseTimeout
  #maxPDU
  #disableHostnameLookup
  #tls
  #outputDirectory
  #subdirectory
  #filenameGeneration
  #filenameExtension
  #storageMode

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
    super({binary: findDCMTK().dcmrecv, events})

    this.#port = port
    this.#configFile = configFile
    this.#AETitle = AETitle
    this.#useCalledAETitle = useCalledAETitle
    this.#acseTimeout = acseTimeout
    this.#dimseTimeout = dimseTimeout
    this.#maxPDU = maxPDU
    this.#disableHostnameLookup = disableHostnameLookup
    this.#tls = tls
    this.#outputDirectory = outputDirectory
    this.#subdirectory = subdirectory
    this.#filenameGeneration = filenameGeneration
    this.#filenameExtension = filenameExtension
    this.#storageMode = storageMode
  }

  //region Getters/Setters
  get port() {
    return this.#port
  }

  set port(value) {
    this.#port = value
  }

  get configFile() {
    return this.#configFile
  }

  // async listCiphers() {
  //   return console.warn('Due to a bug in DCMTK dcmrecv TLS is not support at this time.')
  //   // const result = await this.#execute([this.#binary, '--debug', '--list-ciphers'])
  //   // return result
  // }

  set configFile(value) {
    this.#configFile = value
  }

  get AETitle() {
    return this.#AETitle
  }

  set AETitle(value) {
    this.#AETitle = value
  }

  get useCalledAETitle() {
    return this.#useCalledAETitle
  }

  set useCalledAETitle(value) {
    this.#useCalledAETitle = value
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

  get disableHostnameLookup() {
    return this.#disableHostnameLookup
  }

  set disableHostnameLookup(value) {
    this.#disableHostnameLookup = value
  }

  get tls() {
    return this.#tls
  }

  set tls(value) {
    this.#tls = value
  }

  get outputDirectory() {
    return this.#outputDirectory
  }

  set outputDirectory(value) {
    this.#outputDirectory = value
  }

  get subdirectory() {
    return this.#subdirectory
  }

  set subdirectory(value) {
    this.#subdirectory = value
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

  get storageMode() {
    return this.#storageMode
  }

  set storageMode(value) {
    this.#storageMode = value
  }

  // eslint-disable-next-line max-statements
  #buildCommand() {
    const command = []

    command.push(this.port, '--debug')

    if (this.configFile?.fileName && this.configFile?.profile) {
      command.push('--config-file', this.configFile.fileName, this.configFile.profile)
    }

    // PARAMETERS
    // port  tcp/ip port number to listen on
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

    // network options
    // association negotiation profile from configuration file:
    //
    //   -xf   --config-file  [f]ilename, [p]rofile: string
    //           use profile p from configuration file f
    //
    // application entity title:
    //
    //   -aet  --aetitle  [a]etitle: string
    //           set my AE title (default: DCMRECV)
    //
    //   -uca  --use-called-aetitle
    //           always respond with called AE title
    if (this.useCalledAETitle) {
      command.push('--use-called-aetitle')
    } else if (this.AETitle) {
      command.push('--aetitle', this.AETitle)
    }

    // other network options:
    //
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
    //   -pdu  --max-pdu  [n]umber of bytes: integer (4096..131072)
    //           set max receive pdu to n bytes (default: 16384)
    //
    if (this.maxPDU) {
      command.push('--max-pdu', this.maxPDU)
    }
    //   -dhl  --disable-host-lookup  disable hostname lookup
    if (this.disableHostnameLookup) {
      command.push('--disable-host-lookup', this.disableHostnameLookup)
    }

    //region not supported at this time

    // transport layer security (TLS) options
    // transport protocol stack:
    //
    //   -tls  --disable-tls
    //           use normal TCP/IP connection (default)
    //
    //   +tls  --enable-tls  [p]rivate key file, [c]ertificate file: string
    //           use authenticated secure TLS connection
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
    //   +dp   --dhparam  [f]ilename: string
    //           read DH parameters for DH/DSS ciphersuites
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
    //   -vc   --verify-peer-cert
    //           verify peer certificate if present
    //
    //   -ic   --ignore-peer-cert
    //           don't verify peer certificate

    //endregion

    // output options
    // general:
    //
    //   -od   --output-directory  [d]irectory: string (default: ".")
    //           write received objects to existing directory d
    if (this.outputDirectory) {
      command.push('--output-directory', this.outputDirectory)
    }
    // subdirectory generation:
    //
    //   -s    --no-subdir
    //           do not generate any subdirectories (default)
    //
    //   +ssd  --series-date-subdir
    //           generate subdirectories from series date
    if (this.subdirectory) {
      command.push('--series-date-subdir')
    }

    // filename generation:
    //
    //   +fd   --default-filenames
    //           generate filename from instance UID (default)
    //
    //   +fu   --unique-filenames
    //           generate unique filename based on new UID
    //
    //   +fsu  --short-unique-names
    //           generate short pseudo-random unique filename
    //
    //   +fst  --system-time-names
    //           generate filename from current system time
    //
    if (this.filenameGeneration === 'default') {
      command.push('--default-filenames')
    } else if (this.filenameGeneration === 'unique') {
      command.push('--unique-filenames')
    } else if (this.filenameGeneration === 'short') {
      command.push('--short-unique-names')
    } else if (this.filenameGeneration === 'system') {
      command.push('--system-time-names')
    }

    //   -fe   --filename-extension  [e]xtension: string (default: none)
    //           append e to all generated filenames
    if (this.filenameExtension) {
      command.push('--filename-extension', this.filenameExtension)
    }

    // storage mode:
    //
    //   -B    --normal
    //           allow implicit format conversions (default)
    //
    //   +B    --bit-preserving
    //           write dataset exactly as received
    //
    //         --ignore
    //           ignore dataset, receive but do not store it
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

  /**
   * Starts listening on port
   * @param {Number} [port=] defaults to StoreSCP.port or 104
   * @fires StoreSCP#starting
   * @return {Promise | Promise<unknown>}
   */
  listen(port) {
    this.port = port || this.port
    // setTimeout(()=>this.emit('starting'), 500)
    return this.start(this.#buildCommand())
  }

  /**
   * Stop listening
   * @return {Promise<unknown>}
   */
  close() {
    return this.stop()
  }

  //endregion
}

module.exports = DCMRecv

