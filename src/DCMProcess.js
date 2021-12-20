const {spawn, exec} = require('child_process')
const treeKill = require('tree-kill')
const events = require('events')
// const findIndexFromStart = require('./libs/findIndexFromStart')
// const DCMTKEvent = require('./parsers/DCMTKEvent')
const DCMTKParser = require('./parsers/DCMTKParser')

/**
 * DCM Process
 * @type {DCMProcess}
 */
class DCMProcess extends events {
  #messages = []
  #parser = undefined
  #process = undefined
  #binary = undefined

  constructor({_binary, _parsers}) {
    super()
    this.#binary = _binary
    this.#parser = new DCMTKParser(_parsers)

    this.#parser.on('parseFailed', (message) => {
      this.#messages.push(message)
      this.emit(message.event, message)
    })
    this.#parser.on('parsed', (message) => {
      this.#messages.push(message)
      this.emit(message.event, message)
    })
    this.#reset()
  }

  get process() {
    return this.#process
  }

  get messages() {
    return this.#messages
  }

  #reset() {
    this.#process = undefined
    this.#messages = []
    this.#parser.reset()
  }

  #handleData(chunk, source) {
    try {
      this.#process[source].pause()
      this.#parser.handleData(chunk, source)
      this.#process[source].resume()
    } catch (e) {
      console.error('Failed to process chunk!', chunk.toString())
      throw e
    }

  }

  #onExit(exitCode, signal) {
    if (!this.#process) {
      return
    }
    this.emit('exit', {
      exitCode,
      signal,
      message: `EXIT - exitCode: ${exitCode}  signal: ${signal}`,
      stdout: this.#parser.stdoutLog,
      stderr: this.#parser.stderrLog,
      messages: this.#messages
    })

    // todo flush pending logs??

    // this.#resolve?.({stdout: this.#parser.stdoutLog, stderr: this.#parser.stderrLog, messages: this.#messages})
    this.#reset()
  }

  start(command) {
    return new Promise((resolve, reject) => {
      if (this.#process) {
        return reject('Process already running!')
      }

      this.#process = spawn(this.#binary, command)
      this.#process.stdout.on('data', (chunk) => this.#handleData(chunk, 'stdout'))
      this.#process.stderr.on('data', (chunk) => this.#handleData(chunk, 'stderr'))
      this.#process.on('close', (exitCode, signal) => this.emit('close', {exitCode, signal, message: 'CLOSE'}))
      this.#process.on('exit', (exitCode, signal) => this.#onExit(exitCode, signal))
      this.#process.on('disconnect', () => this.emit('disconnect', {message: 'DISCONNECT'}))
      this.#process.on('error', (error) => this.emit('error', {error, message: `ERROR - ${error.message}`}))
      this.#process.on('message', (message) => this.emit('message', {message}))
      this.once('starting', (msg) => resolve(msg))
    })
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.#process) {
        return reject('Process not running!')
      }
      treeKill(this.#process.pid, (err) => {
        if (err) {
          console.error('Failed to kill process!', err)
          return reject(err)
        }
        resolve()
      })
    })
  }

  /**
   *
   * @param command
   * @param {function=} parser
   * @return {Promise<string>}
   */
  async execute(command, parser) {
    if (Array.isArray(command)) {
      command = command.join(' ')
    }
    if (!parser) {
      parser = (raw) => raw.toString()
    }
    return new Promise((resolve, reject) => {
      exec(command, (err, stdout, stderr) => {
        if (err) {
          if (stdout) {
            err.message += `\n  stdout: ${stdout.toString()}`
          }
          if (stderr) {
            err.message += `\n  stderr: ${stdout.toString()}`
          }
          err.message += `\n  command: ${command}`
          reject(err)
        } else {
          resolve(parser(stdout || stderr))
        }
      })
    })
  }

  async version() {
    const regex = new RegExp(`
\\$dcmtk: (?<binary>.*) (?<version>.*) (?<date>.*) \\$

.+: .+ \\(.+\\)

Host type: (?<hostType>.*)
Character encoding: (?<encoding>.*)
Code page: (?<codePage>.*)

External libraries used: *(?<externalLibrariesUsed>[^]*)?
`.trim())

    const result = await this.execute([this.#binary, '--debug', '--version'])
    const matches = regex.exec(result)
    const out = {...matches.groups}
    // out.raw = result[0]
    out.externalLibrariesUsed = out.externalLibrariesUsed.trim().split(/\r?\n/)
    return out
  }
}

module.exports = DCMProcess
