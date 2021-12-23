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
  #successfulRun = undefined
  #binary = undefined

  constructor({binary, events}) {
    super()
    if (!binary) {
      throw new Error('"binary" cannot be undefined!')
    }
    this.#binary = binary
    this.#parser = new DCMTKParser(events)

    this.#parser.on('parseFailed', (message) => {
      this.#messages.push(message)
      this.emit(message.event, message)
    })
    this.#parser.on('parsed', (message) => {
      this.#messages.push(message)
      this.emit(message.event, message)
      this.emit('message', message)
    })
    this.#reset()
  }

  #reset() {
    this.#process = undefined
    this.#messages = []
    this.#parser.reset()
  }

  //region Getters/Setters
  get process() {
    return this.#process
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

  #handleData(chunk, source) {
    try {
      // the process might not be running but we still need to process the chunk
      this.#process?.[source].pause()
      this.#parser.handleData(chunk, source)
      this.#process?.[source].resume()
    } catch (e) {
      console.error('Failed to process chunk!', chunk.toString())
      throw e
    }

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

  get messages() {
    return this.#messages
  }

  get successfulRun() {
    return this.#successfulRun
  }

  set successfulRun(value) {
    this.#successfulRun = value
  }

  #onExit(exitCode, signal) {
    if (!this.#process) {
      return
    }
    if (exitCode === 0) {
      this.successfulRun = true
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

  start(command, stableDelay = 1000) {
    return new Promise((resolve, reject) => {
      if (this.#process) {
        return reject('Process already running!')
      }
      this.#successfulRun = false
      this.#process = spawn(this.#binary, command)
      this.#process.stdout.on('data', (chunk) => this.#handleData(chunk, 'stdout'))
      this.#process.stderr.on('data', (chunk) => this.#handleData(chunk, 'stderr'))
      this.#process.once('close', (exitCode, signal) => this.emit('close', {exitCode, signal, message: 'CLOSE'}))
      this.#process.once('exit', (exitCode, signal) => this.#onExit(exitCode, signal))
      this.#process.once('disconnect', () => this.emit('disconnect', {message: 'DISCONNECT'}))
      this.#process.on('error', (error) => this.emit('error', {error, message: `ERROR - ${error.message}`}))
      this.#process.on('message', (message) => this.emit('message', {message}))
      this.once('starting', (msg) => {
        setTimeout(() => {
          if (this.#process || this.successfulRun) {
            resolve(msg)
          } else {
            reject(`Process started but failed to keep running for at least ${stableDelay}ms.`)
          }
        }, stableDelay)
      })
    })
  }

  async executeV2(command) {
    if (Array.isArray(command)) {
      command = `${this.#binary} ${command.join(' ')}`
    }

    return new Promise((resolve, reject) => {
      this.#parser.reset()
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
          this.#parser.handleData(stdout, 'stdout')
          this.#parser.handleData(stderr, 'stderr')

          resolve({
            stdout: this.#parser.stdoutLog,
            stderr: this.#parser.stderrLog,
            messages: this.messages,
          })
        }
      })
    })
  }

//endregion
}

module.exports = DCMProcess
