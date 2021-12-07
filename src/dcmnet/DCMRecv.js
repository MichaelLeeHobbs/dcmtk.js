const {spawn, exec} = require('child_process')

class DCMRecv {
  constructor({port = 104, }) {
    this._biniary = process.env.DCMTK_DCMRECV
  }

  async version() {

  }

}

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
