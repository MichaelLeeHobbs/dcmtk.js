const {spawn, exec} = require('child_process')
const events = require('events')

// These comments are in honor of Pacmano - https://mirthconnect.slack.com/archives/DKE0F4P2N
const execute = async (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => err ?
      reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), command}) :
      resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), command})
    )
  })
}
const start = (command) => {
  class _Dcmrecv extends events {
    constructor() {
      super()

      this._stdOutData = ''
      this._stdOutDataHandler = -1
      this._stdErrData = ''
      this._stdErrDataHandler = -1
    }

    _handleStdOut(data = '') {
      clearTimeout(this._stdOutDataHandler)
      this._stdOutData += data
      this._stdOutDataHandler = setTimeout(() => {
        console.log(`----------------------- stdout start -----------------------`)
        console.log(this._stdOutData)
        console.log(`----------------------- stdout end -----------------------`)
        this._stdOutData = ''
      }, 100)
    }

    _handleStdErr(data = '') {
      clearTimeout(this._stdErrDataHandler)
      this._stdErrData += data
      this._stdErrDataHandler = setTimeout(() => {
        console.log(`----------------------- stderr start -----------------------`)
        console.log(this._stdErrData)
        console.log(`----------------------- stderr end -----------------------`)
        this._stdErrData = ''
      }, 100)
    }

    shutdown() {
      // shutdown nicely
      let result = this._child.kill()
      if (!result) {
        // shutdown not so nicely
        result = this._child.kill('SIGKILL')
      }
      return result
    }

    start() {
      const child = spawn(process.env.DCMTK_STORESCP, command)
      child.stdout.on('data', (data) => this._handleStdOut(data))
      child.stderr.on('data', (data) => this._handleStdErr(data))
      child.on('close', (exitCode, signal) => this.emit('close', exitCode, signal))
      child.on('exit', (exitCode, signal) => this.emit('exit', exitCode, signal))
      child.on('disconnect', () => this.emit('disconnect'))
      child.on('error', (error) => this.emit('error', error))
      child.on('message', (message, sendHandle) => {
        console.log(`message`, message, sendHandle)
        this.emit(`message`, message, sendHandle)
      })
      this._child = child
    }
  }

  return new _Dcmrecv()
}


function storescp({port = 104, options = {}}) {
  const emitter = new events.EventEmitter()

  // let command = [process.env.DCMTK_STORESCP, port, '--debug']
  let command = [port, '--debug']

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
  //  +v    --verbose-pc
  //  show presentation contexts in verbose mode

  // ## multi-process options
  //    --single-process
  //    single process mode (default)
  //
  if (options.singleProcess) command.push(`--single-process`)

  //    --fork
  //    fork child process for each association
  if (options.fork) command.push(`--fork`)
  // ## network options
  // ### association negotiation profile from configuration file:
  //
  //  -xf   --config-file  [f]ilename [p]rofile: string
  //          use profile p from config file f
  //
  if (options.configFile) {
    command.push(`--config-file`)
    command.push(options.configFile.filename)
    command.push(options.configFile.profile)
  }

  // ### preferred network transfer syntaxes (not with --config-file):
  //
  //  +x=   --prefer-uncompr
  //          prefer explicit VR local byte order (default)
  //
  if (options.preferUncompr) command.push(`--prefer-uncompr`)

  //  +xe   --prefer-little
  //          prefer explicit VR little endian TS
  //
  if (options.preferLittle) command.push(`--prefer-little`)

  //  +xb   --prefer-big
  //          prefer explicit VR big endian TS
  //
  if (options.preferBig) command.push(`--prefer-big`)

  //  +xs   --prefer-lossless
  //          prefer default JPEG lossless TS
  //
  if (options.preferLossless) command.push(`--prefer-lossless`)

  //  +xy   --prefer-jpeg8
  //          prefer default JPEG lossy TS for 8 bit data
  //
  if (options.preferJpeg8) command.push(`--prefer-jpeg8`)

  //  +xx   --prefer-jpeg12
  //          prefer default JPEG lossy TS for 12 bit data
  //
  if (options.preferJpeg12) command.push(`--prefer-jpeg12`)

  //  +xv   --prefer-j2k-lossless
  //          prefer JPEG 2000 lossless TS
  //
  if (options.preferJ2kLossless) command.push(`--prefer-j2k-lossless`)

  //  +xw   --prefer-j2k-lossy
  //          prefer JPEG 2000 lossy TS
  //
  if (options.preferJ2kLossy) command.push(`--prefer-j2k-lossy`)

  //  +xt   --prefer-jls-lossless
  //          prefer JPEG-LS lossless TS
  //
  if (options.preferJlsLossless) command.push(`--prefer-jls-lossless`)

  //  +xu   --prefer-jls-lossy
  //          prefer JPEG-LS lossy TS
  //
  if (options.preferJlsLossy) command.push(`--prefer-jls-lossy`)

  //  +xm   --prefer-mpeg2
  //          prefer MPEG2 Main Profile @ Main Level TS
  //
  if (options.preferMpeg2) command.push(`--prefer-mpeg2`)

  //  +xh   --prefer-mpeg2-high
  //          prefer MPEG2 Main Profile @ High Level TS
  //
  if (options.preferMpeg2High) command.push(`--preferMpeg2High`)

  //  +xn   --prefer-mpeg4
  //          prefer MPEG4 AVC/H.264 High Profile / Level 4.1 TS
  //
  if (options.preferMpeg4) command.push(`--prefer-mpeg4`)

  //  +xl   --prefer-mpeg4-bd
  //          prefer MPEG4 AVC/H.264 BD-compatible HP / Level 4.1 TS
  //
  if (options.preferMpeg4Bd) command.push(`--prefer-mpeg4-bd`)

  //  +x2   --prefer-mpeg4-2-2d
  //          prefer MPEG4 AVC/H.264 HP / Level 4.2 TS for 2D Videos
  //
  if (options.preferMpeg4_2_2d) command.push(`--prefer-mpeg4-2-2d`)

  //  +x3   --prefer-mpeg4-2-3d
  //          prefer MPEG4 AVC/H.264 HP / Level 4.2 TS for 3D Videos
  //
  if (options.preferMpeg4_2_3d) command.push(`--prefer-mpeg4-2-3d`)

  //  +xo   --prefer-mpeg4-2-st
  //          prefer MPEG4 AVC/H.264 Stereo HP / Level 4.2 TS
  //
  if (options.preferMpeg4_2_st) command.push(`--prefer-mpeg4-2-st`)

  //  +x4   --prefer-hevc
  //          prefer HEVC H.265 Main Profile / Level 5.1 TS
  //
  if (options.preferHevc) command.push(`--prefer-hevc`)

  //  +x5   --prefer-hevc10
  //          prefer HEVC H.265 Main 10 Profile / Level 5.1 TS
  //
  if (options.preferHevc10) command.push(`--prefer-hevc10`)

  //  +xr   --prefer-rle
  //          prefer RLE lossless TS
  //
  if (options.preferRle) command.push(`--prefer-rle`)

  //  +xd   --prefer-deflated
  //          prefer deflated explicit VR little endian TS
  //
  if (options.preferDeflated) command.push(`--prefer-deflated`)

  //  +xi   --implicit
  //          accept implicit VR little endian TS only
  //
  if (options.implicit) command.push(`--implicit`)

  //  +xa   --accept-all
  //          accept all supported transfer syntaxes
  //
  if (options.acceptAll) command.push(`--accept-all`)


  // ### network host access control (tcp wrapper):
  //
  //  -ac   --access-full
  //          accept connections from any host (default)
  //
  if (options.accessFull) command.push(`--access-full`)

  //  +ac   --access-control
  //          enforce host access control rules
  //
  if (options.accessControl) command.push(`--access-control`)

  // ### other network options:
  //
  //  -id   --inetd
  //          run from inetd super server (not with --fork)
  //
  //          # not available on all systems (e.g. not on Windows)
  //
  if (options.inetd) command.push(`--inetd`)

  //  -ts   --socket-timeout  [s]econds: integer (default: 60)
  //          timeout for network socket (0 for none)
  //
  if (options.socketTimeout) command.push(`--socket-timeout ${options.socketTimeout}`)

  //  -ta   --acse-timeout  [s]econds: integer (default: 30)
  //          timeout for ACSE messages
  //
  if (options.acseTimeout) command.push(`--acse-timeout ${options.acseTimeout}`)

  //  -td   --dimse-timeout  [s]econds: integer (default: unlimited)
  //          timeout for DIMSE messages
  //
  if (options.dimseTimeout) command.push(`--dimse-timeout ${options.dimseTimeout}`)

  //  -aet  --aetitle  [a]etitle: string
  //          set my AE title (default: STORESCP)
  //
  if (options.aetitle) command.push(`--aetitle ${options.aetitle}`)

  //  -pdu  --max-pdu  [n]umber of bytes: integer (4096..131072)
  //          set max receive pdu to n bytes (default: 16384)
  //
  if (options.maxPdu) command.push(`--max-pdu ${options.maxPdu}`)

  //  -dhl  --disable-host-lookup
  //          disable hostname lookup
  //
  if (options.disableHostLookup) command.push(`--disable-host-lookup`)

  //        --refuse
  //          refuse association
  //
  if (options.refuse) command.push(`--refuse`)

  //        --reject
  //          reject association if no implementation class UID
  //
  if (options.reject) command.push(`--reject`)

  //        --ignore
  //          ignore store data, receive but do not store
  //
  if (options.ignore) command.push(`--ignore`)

  //        --sleep-after  [s]econds: integer
  //          sleep s seconds after store (default: 0)
  //
  if (options.sleepAfter) command.push(`--sleep-after ${options.sleepAfter}`)

  //        --sleep-during  [s]econds: integer
  //          sleep s seconds during store (default: 0)
  //
  if (options.sleepDuring) command.push(`--sleep-during ${options.sleepDuring}`)

  //        --abort-after
  //          abort association after receipt of C-STORE-RQ
  //          (but before sending response)
  //
  if (options.abortAfter) command.push(`--abort-after ${options.abortAfter}`)

  //        --abort-during
  //          abort association during receipt of C-STORE-RQ
  //
  if (options.abortDuring) command.push(`--abort-during ${options.abortDuring}`)

  //  -pm   --promiscuous
  //          promiscuous mode, accept unknown SOP classes
  //          (not with --config-file)
  //
  if (options.promiscuous) command.push(`--promiscuous`)

  //  -up   --uid-padding
  //          silently correct space-padded UIDs
  if (options.uidPadding) command.push(`--uid-padding`)

  // ## transport layer security (TLS) options
  // ### transport protocol stack:
  //
  //   -tls  --disable-tls
  //           use normal TCP/IP connection (default)
  //
  if (options.disableTls) command.push(`--disable-tls`)

  //   +tls  --enable-tls  [p]rivate key file, [c]ertificate file: string
  //           use authenticated secure TLS connection
  //
  if (options.enableTls) command.push(`--enable-tls ${options.enableTlsPrivateKeyFile} ${options.enableTlsCertificateFile}`)

  // ### private key password (only with --enable-tls):
  //
  //   +ps   --std-passwd
  //           prompt user to type password on stdin (default)
  //
  // todo if (options.stdPasswd) command.push(`--std-passwd`)

  //   +pw   --use-passwd  [p]assword: string
  //           use specified password
  //
  if (options.usePasswd) command.push(`--use-passwd ${options.usePasswd}`)

  //   -pw   --null-passwd
  //           use empty string as password
  //
  if (options.nullPasswd) command.push(`--null-passwd`)

  // key and certificate file format:
  //
  //   -pem  --pem-keys
  //           read keys and certificates as PEM file (default)
  //
  if (options.pemKeys) command.push(`--pem-keys`)

  //   -der  --der-keys
  //           read keys and certificates as DER file
  //
  if (options.derKeys) command.push(`--der-keys`)

  // certification authority:
  //
  //   +cf   --add-cert-file  [f]ilename: string
  //           add certificate file to list of certificates
  //
  if (options.addCertFile) command.push(`--add-cert-file ${options.addCertFile}`)

  //   +cd   --add-cert-dir  [d]irectory: string
  //           add certificates in d to list of certificates
  //
  if (options.addCertDir) command.push(`--add-cert-dir ${options.addCertDir}`)

  // security profile:
  //
  //   +px   --profile-bcp195
  //           BCP 195 TLS Profile (default)
  //
  if (options.profileBcp195) command.push(`--profile-bcp195`)

  //   +py   --profile-bcp195-nd
  //           Non-downgrading BCP 195 TLS Profile
  //
  if (options.profileBcp195Nd) command.push(`--profile-bcp195-nd`)

  //   +pz   --profile-bcp195-ex
  //           Extended BCP 195 TLS Profile
  //
  if (options.profileBcp195Ex) command.push(`--profile-bcp195-ex`)

  //   +pb   --profile-basic
  //           Basic TLS Secure Transport Connection Profile (retired)
  //
  if (options.profileBasic) command.push(`--profile-basic`)

  //   +pa   --profile-aes
  //           AES TLS Secure Transport Connection Profile (retired)
  //
  if (options.profileAes) command.push(`--profile-aes`)

  //   +pn   --profile-null
  //           Authenticated unencrypted communication
  //           (retired, was used in IHE ATNA)
  //
  if (options.profileNull) command.push(`--profile-null`)

  // ciphersuite:
  //
  //   +cc   --list-ciphers
  //           show list of supported TLS ciphersuites and exit
  //
  if (options.listCiphers) command.push(`--list-ciphers`)

  //   +cs   --cipher  [c]iphersuite name: string
  //           add ciphersuite to list of negotiated suites
  //
  if (options.cipher) command.push(`--cipher ${options.cipher}`)

  //   +dp   --dhparam  [f]ilename: string
  //           read DH parameters for DH/DSS ciphersuites
  //
  if (options.dhparam) command.push(`--dhparam ${options.dhparam}`)

  // pseudo random generator:
  //
  //   +rs   --seed  [f]ilename: string
  //           seed random generator with contents of f
  //
  if (options.seed) command.push(`--seed ${options.seed}`)

  //   +ws   --write-seed
  //           write back modified seed (only with --seed)
  //
  if (options.writeSeed) command.push(`--write-seed`)

  //   +wf   --write-seed-file  [f]ilename: string (only with --seed)
  //           write modified seed to file f
  //
  if (options.writeSeedFile) command.push(`--write-seed-file ${options.writeSeedFile}`)

  // peer authentication:
  //
  //   -rc   --require-peer-cert
  //           verify peer certificate, fail if absent (default)
  //
  if (options.requirePeerCert) command.push(`--require-peer-cert`)

  //   -vc   --verify-peer-cert
  //           verify peer certificate if present
  //
  if (options.verifyPeerCert) command.push(`--verify-peer-cert`)

  //   -ic   --ignore-peer-cert
  //           don't verify peer certificate
  if (options.ignorePeerCert) command.push(`--ignore-peer-cert`)


  // ## output options
  // ### general:
  //
  //  -od   --output-directory  [d]irectory: string (default: ".")
  //          write received objects to existing directory d
  //
  if (options.outputDirectory) command.push(`--output-directory ${options.outputDirectory}`)

  //bit preserving mode:
  //
  //  -B    --normal
  //          allow implicit format conversions (default)
  //
  if (options.normal) command.push(`--normal`)

  //  +B    --bit-preserving
  //          write data exactly as read
  //
  if (options.bitPreserving) command.push(`--bit-preserving`)

  //output file format:
  //
  //  +F    --write-file
  //          write file format (default)
  //
  if (options.writeFile) command.push(`--write-file`)

  //  -F    --write-dataset
  //          write data set without file meta information
  //
  if (options.writeDataset) command.push(`--write-dataset`)

  // ### output transfer syntax
  // (not with --bit-preserving or compressed transmission):
  //
  //  +t=   --write-xfer-same
  //          write with same TS as input (default)
  //
  if (options.writeXferSame) command.push(`--write-xfer-same`)

  //  +te   --write-xfer-little
  //          write with explicit VR little endian TS
  //
  if (options.writeXferLittle) command.push(`--write-xfer-little`)

  //  +tb   --write-xfer-big
  //          write with explicit VR big endian TS
  //
  if (options.writeXferBig) command.push(`--write-xfer-big`)

  //  +ti   --write-xfer-implicit
  //          write with implicit VR little endian TS
  //
  if (options.writeXferImplicit) command.push(`--write-xfer-implicit`)

  //  +td   --write-xfer-deflated
  //          write with deflated explicit VR little endian TS
  //
  if (options.writeXferDeflated) command.push(`--write-xfer-deflated`)

  // ### post-1993 value representations (not with --bit-preserving):
  //
  //  +u    --enable-new-vr
  //          enable support for new VRs (UN/UT) (default)
  //
  if (options.enableNewVr) command.push(`--enable-new-vr`)

  //  -u    --disable-new-vr
  //          disable support for new VRs, convert to OB
  //
  if (options.disableNewVr) command.push(`--disable-new-vr`)

  // ### group length encoding (not with --bit-preserving):
  //
  //  +g=   --group-length-recalc
  //          recalculate group lengths if present (default)
  //
  if (options.groupLengthRecalc) command.push(`--group-length-recalc`)

  //  +g    --group-length-create
  //          always write with group length elements
  //
  if (options.groupLengthCreate) command.push(`--group-length-create`)

  //  -g    --group-length-remove
  //          always write without group length elements
  //
  if (options.groupLengthRemove) command.push(`--group-length-remove`)

  // ### length encoding in sequences and items (not with --bit-preserving):
  //
  //  +e    --length-explicit
  //          write with explicit lengths (default)
  //
  if (options.lengthExplicit) command.push(`--length-explicit`)

  //  -e    --length-undefined
  //          write with undefined lengths
  //
  if (options.lengthUndefined) command.push(`--length-undefined`)

  // ### data set trailing padding
  // (not with --write-dataset or --bit-preserving):
  //
  //  -p    --padding-off
  //          no padding (default)
  //
  if (options.paddingOff) command.push(`--padding-off`)

  //  +p    --padding-create  [f]ile-pad [i]tem-pad: integer
  //          align file on multiple of f bytes and items on
  //          multiple of i bytes
  //
  if (options.paddingCreate) command.push(`--padding-create ${options.paddingCreate.filePad} ${options.paddingCreate.itemPad}`)

  // ### handling of defined length UN elements:
  //
  //  -uc   --retain-un
  //          retain elements as UN (default)
  //
  if (options.retainUn) command.push(`--retain-un`)

  //  +uc   --convert-un
  //          convert to real VR if known
  //
  if (options.convertUn) command.push(`--convert-un`)

  // ### deflate compression level (only with --write-xfer-deflated/same):
  //
  //  +cl   --compression-level  [l]evel: integer (default: 6)
  //          0=uncompressed, 1=fastest, 9=best compression
  //
  if (options.compressionLevel) command.push(`--compressionLevel ${options.compressionLevel}`)

  // ### sorting into subdirectories (not with --bit-preserving):
  //
  //  -ss   --sort-conc-studies  [p]refix: string
  //          sort studies using prefix p and a timestamp
  //
  if (options.sortConcStudies) command.push(`--sort-conc-studies ${options.sortConcStudies}`)

  //  -su   --sort-on-study-uid  [p]refix: string
  //          sort studies using prefix p and the Study Instance UID
  //
  if (options.sortOnStudyUid) command.push(`--sort-on-study-uid ${options.sortOnStudyUid}`)

  //  -sp   --sort-on-patientname
  //          sort studies using the Patient's Name and a timestamp
  //
  if (options.sortOnPatientname) command.push(`--sort-on-patientname`)

  // ### filename generation:
  //
  //  -uf   --default-filenames
  //          generate filename from instance UID (default)
  //
  if (options.defaultFilenames) command.push(`--default-filenames`)

  //  +uf   --unique-filenames
  //          generate unique filenames
  //
  if (options.uniqueFilenames) command.push(`--unique-filenames`)

  //  -tn   --timenames
  //          generate filename from creation time
  //
  if (options.timenames) command.push(`--timenames`)

  //  -fe   --filename-extension  [e]xtension: string
  //          append e to all filenames
  if (options.filenameExtension) command.push(`--filename-extension ${options.filenameExtension}`)

  // event options
  //   -xcr  --exec-on-reception  [c]ommand: string
  //           execute command c after having received and processed
  //           one C-STORE-RQ message
  //
  if (options.execOnReception) command.push(`--exec-on-reception ${options.execOnReception}`)

  //   -xcs  --exec-on-eostudy  [c]ommand: string
  //           execute command c after having received and processed
  //           all C-STORE-RQ messages that belong to one study
  //
  if (options.execOnEostudy) command.push(`--exec-on-eostudy ${options.execOnEostudy}`)

  //   -rns  --rename-on-eostudy
  //           having received and processed all C-STORE-RQ messages
  //           that belong to one study, rename output files according
  //           to a certain pattern
  //
  if (options.renameOnEostudy) command.push(`--rename-on-eostudy ${options.renameOnEostudy}`)

  //   -tos  --eostudy-timeout  [t]imeout: integer
  //           specifies a timeout of t seconds for end-of-study
  //           determination
  //
  if (options.eostudyTimeout) command.push(`--eostudy-timeout ${options.eostudyTimeout}`)

  //   -xs   --exec-sync
  //           execute command synchronously in foreground
  if (options.execSync) command.push(`--exec-sync ${options.execSync}`)


  // command.push(`--exec-on-reception`)
  // command.push(`"echo 'p:#p f:#f a:#a c:#c r:#r'"`)
  // return execute(command.join(' '))
  return start(command, emitter)
}

module.exports = storescp
