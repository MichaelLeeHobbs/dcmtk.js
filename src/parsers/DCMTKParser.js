const debug = require('debug')('DCMTKParser')
const DCMTKEvent = require('./DCMTKEvent')
const events = require('events')
const findIndexFromStart = require('../libs/findIndexFromStart')

class DCMTKParser extends events {
  #events = []
  #state = undefined

  constructor(events) {
    super()
    debug('constructor')
    this.#events = events
    this.reset()
    this.on('parsed', (msg) => this.#state.messages.push(msg))
    this.on('parseFailed', (msg) => this.#state.messages.push(msg))
  }

  get stdoutLog() {
    return this.#state.stdout.log
  }

  get stderrLog() {
    return this.#state.stderr.log
  }

  get messages() {
    return this.#state.messages
  }

  reset() {
    debug('reset')
    this.#state = {
      stdout: {
        buffer: '',
        log: [],
        parserPos: 0,
        blockHandler: -1,
        parser: undefined,
      },
      stderr: {
        buffer: '',
        log: [],
        parserPos: 0,
        blockHandler: -1,
        parser: undefined,
      },
      messages: [],
    }
  }

  #parse(source, _messages = []) {
    debug('#parse', source)
    let blockParserSelected = false
    const parser = this.#state[source].parser

    // handle block parser if active
    if (parser && !this.#parseBlock(source, _messages)) {
      debug('#parse', 'blocker parser is active and not done')
      return {messages: _messages}
    }

    debug('#parse', 'start parsing where we left off')
    for (let i = this.#state[source].parserPos; i < this.#state[source].log.length; i++) {
      let raw = this.#state[source].log[i]

      // there are three types of parsers: regex, func, and block
      this.#events.some(event => {

        // if (event instanceof DCMTKEvent) {
        if (!event.isMultiLine()) {
          debug('#parse', 'parsing single line', event.event)
          let result = event.parse(i, this.#state[source].log, source)
          if (result) {
            debug('#parse', 'parsing single line - result', event.event, result)
            return this.emit('parsed', result)
          }
        } else if (event.hasHeaderMatch(raw)) {
          debug('#parse', 'parsing multi line', event.event)
          this.#state[source].parser = event
          // parse block timeout to avoid getting stuck trying to parse unexpected message format
          this.#state[source].blockHandler = setTimeout(() => this.#parseBlockFailed(source), event.timeout || 1000)
          return blockParserSelected = true
        }
        // }
        // else if (event.type === 'block') {
        //   if (event.header.test(raw)) {
        //     this.#state[source].parser = event
        //     // parse block timeout to avoid getting stuck trying to parse unexpected message format
        //     this.#state[source].blockHandler = setTimeout(() => this.#parseBlockFailed(source), event.timeout || 1000)
        //     return blockParserSelected = true
        //   }
        // } else {
        //   let result
        //   if (event.type === 'func') {
        //     let data = event.func(raw)
        //     if (data) {
        //       return this.emit('parsed', {...data, dt: new Date(), event: event.event, source})
        //     }
        //   } else {
        //     let matches = event.regex.exec(raw)
        //     if (matches) {
        //       result = {...matches.groups, dt: new Date(), event: event.event, source}
        //       result.raw = (event.event === 'unhandled') ? matches[0] : undefined
        //       return this.emit('parsed', result)
        //     }
        //   }
        // }
      })
      if (blockParserSelected) {
        return this.#parse(source, _messages)
      }
      this.#state[source].parserPos = i + 1
    }
    debug('#parse', 'done parsing for now', this.#state)
    // return {messages: _messages}
  }

  #parseBlockClear(source, newParseIndex) {
    debug('#parseBlockClear', source)
    this.#state[source].parserPos = newParseIndex || ++this.#state[source].parserPos
    this.#state[source].parser = undefined
    clearTimeout(this.#state[source].blockHandler)
  }

  #parseBlockFailed(source) {
    debug('#parseBlockFailed', source)
    const parser = this.#state[source].parser
    const headerIndex = this.#state[source].parserPos
    const maxLength = headerIndex + parser?.maxLines || 2
    const raw = this.#state[source].log.slice(headerIndex, maxLength).join('\n')
    this.emit('parseFailed', {event: 'parseFailed', dt: new Date(), parser: parser?.event || 'unknown', start: headerIndex, raw, source})
    this.#parseBlockClear(source)
  }

  #parseBlock(source, /*_messages*/) {
    debug('#parseBlock', source)
    const event = this.#state[source].parser
    const headerIndex = this.#state[source].parserPos
    const log = this.#state[source].log

    // region testing v2 parsers
    if (event instanceof DCMTKEvent) {
      const result = event.parse(headerIndex, log, source)
      if (result?.error) {
        // todo improve / log error
        this.#parseBlockFailed(source)

      } else if (result) {
        const {footerIndex, ...rest} = result
        // _messages.push(rest)
        this.emit('parsed', rest)
        this.#parseBlockClear(source, footerIndex + 1)
        return true
      }
      return false
    }
    // endregion

    const footerIndex = findIndexFromStart(log, headerIndex, (ele) => event.footer.test(ele))
    if (footerIndex === -1) {
      const maxLength = headerIndex + event.maxLines
      if (maxLength < log.length) {
        this.#parseBlockFailed(source)
      }
      return false
    }
    const body = log.slice(headerIndex, footerIndex + 1).join('\n')
    this.emit('parsed', {event: event.event, ...event.parse(body), source})
    this.#parseBlockClear(source, footerIndex + 1)
    return true
  }

  handleData(chunk, source) {
    const dataStr = chunk.toString().replace(/\r?\n/g, '\n')
    debug('handleData', {dataStr, source})
    const currStr = this.#state[source].buffer + dataStr
    const dataArray = currStr.split('\n')

    if (currStr.endsWith('\n')) {
      dataArray.pop()
      this.#state[source].buffer = ''
      this.#state[source].log = this.#state[source].log.concat(dataArray)
    } else {
      this.#state[source].buffer = dataArray.pop()
      this.#state[source].log = this.#state[source].log.concat(dataArray)
    }

    this.#parse(source)
  }
}

module.exports = DCMTKParser
