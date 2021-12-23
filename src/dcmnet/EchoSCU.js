const DCMProcess = require('../DCMProcess')
const findDCMTK = require('../findDCMTK')
const events = require('../events')

class EchoSCU extends DCMProcess {
  #callingAETitle
  #calledAETitle
  #proposeTransferSyntaxes
  #proposePresentationContexts
  #timeout
  #socketTimeout
  #acseTimeout
  #dimseTimeout
  #maxPDU
  #repeat
  #abort
  #host
  #port

  constructor({
                callingAETitle, calledAETitle, proposeTransferSyntaxes, proposePresentationContexts, timeout, socketTimeout, acseTimeout, dimseTimeout, maxPDU,
                repeat, abort, host, port,
              }) {
    super({binary: findDCMTK().echoscu, events})
    this.#callingAETitle = callingAETitle
    this.#calledAETitle = calledAETitle
    this.#proposeTransferSyntaxes = proposeTransferSyntaxes
    this.#proposePresentationContexts = proposePresentationContexts
    this.#timeout = timeout
    this.#socketTimeout = socketTimeout
    this.#acseTimeout = acseTimeout
    this.#dimseTimeout = dimseTimeout
    this.#maxPDU = maxPDU
    this.#repeat = repeat
    this.#abort = abort
    this.#host = host
    this.#port = port
  }

  //region Getters/Setters
  get callingAETitle() {
    return this.#callingAETitle
  }

  set callingAETitle(value) {
    this.#callingAETitle = value
  }

  get calledAETitle() {
    return this.#calledAETitle
  }

  set calledAETitle(value) {
    this.#calledAETitle = value
  }

  get proposeTransferSyntaxes() {
    return this.#proposeTransferSyntaxes
  }

  set proposeTransferSyntaxes(value) {
    this.#proposeTransferSyntaxes = value
  }

  get proposePresentationContexts() {
    return this.#proposePresentationContexts
  }

  set proposePresentationContexts(value) {
    this.#proposePresentationContexts = value
  }

  get timeout() {
    return this.#timeout
  }

  set timeout(value) {
    this.#timeout = value
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

  get maxPDU() {
    return this.#maxPDU
  }

  set maxPDU(value) {
    this.#maxPDU = value
  }

  get repeat() {
    return this.#repeat
  }

  set repeat(value) {
    this.#repeat = value
  }

  get abort() {
    return this.#abort
  }

  set abort(value) {
    this.#abort = value
  }

  get host() {
    return this.#host
  }

  set host(value) {
    this.#host = value
  }

  get port() {
    return this.#port
  }

  set port(value) {
    this.#port = value
  }

  #buildCommand() {
    const command = [this.host, this.port, '--debug']

    // ## general options
    //  -h    --help
    //          print this help text and exit
    //
    //        --version
    //          print version information and exit
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
    if (this.#callingAETitle) {
      command.push(`--aetitle ${this.#callingAETitle}`)
    }

    //   -aec  --call  [a]etitle: string
    //           set called AE title of peer (default: ANY-SCP)
    if (this.#calledAETitle) {
      command.push(`--call ${this.#calledAETitle}`)
    }

    // ### association negotiation debugging:
    //   -pts  --propose-ts  [n]umber: integer (1..38)
    //           propose n transfer syntaxes
    //
    if (this.#proposeTransferSyntaxes != null) {
      command.push(`--propose-ts ${this.#proposeTransferSyntaxes}`)
    }

    //   -ppc  --propose-pc  [n]umber: integer (1..128)
    //           propose n presentation contexts
    if (this.#proposePresentationContexts != null) {
      command.push(`--propose-pc ${this.#proposePresentationContexts}`)
    }

    // ### association negotiation debugging:
    //   -to   --timeout  [s]econds: integer (default: unlimited)
    //           timeout for connection requests
    //
    if (this.#timeout) {
      command.push(`--timeout ${this.#timeout}`)
    }

    //   -ts   --socket-timeout  [s]econds: integer (default: 60)
    //           timeout for network socket (0 for none)
    //
    if (this.#socketTimeout) {
      command.push(`--socket-timeout ${this.#socketTimeout}`)
    }

    //   -ta   --acse-timeout  [s]econds: integer (default: 30)
    //           timeout for ACSE messages
    //
    if (this.#acseTimeout) {
      command.push(`--acse-timeout ${this.#acseTimeout}`)
    }

    //   -td   --dimse-timeout  [s]econds: integer (default: unlimited)
    //           timeout for DIMSE messages
    //
    if (this.#dimseTimeout) {
      command.push(`--dimse-timeout ${this.#dimseTimeout}`)
    }

    //   -pdu  --max-pdu  [n]umber of bytes: integer (4096..131072)
    //           set max receive pdu to n bytes (default: 16384)
    //
    if (this.#maxPDU) {
      command.push(`--max-pdu ${this.#maxPDU}`)
    }

    //         --repeat  [n]umber: integer
    //           repeat n times
    //
    if (this.#repeat) {
      command.push(`--repeat ${this.#repeat}`)
    }

    //         --abort
    //           abort association instead of releasing it
    if (this.#abort) {
      command.push('--abort')
    }

    return command
    // command = command.join(' ')
    // return new Promise((resolve, reject) => {
    //     exec(command, (err, stdout, stderr) => err ?
    //         reject({message: `FAILED: ${stdout}\n${stderr}`.trim()}) :
    //         resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim()})
    //     )
    // })
  }

  async ping({host, port, repeat} = {}) {
    this.host = host || this.host
    this.port = port || this.port
    this.repeat = repeat || this.repeat

    return this.executeV2(this.#buildCommand())
  }

  //endregion
}

module.exports = EchoSCU
