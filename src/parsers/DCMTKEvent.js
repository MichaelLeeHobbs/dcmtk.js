const findIndexFromStart = require('../libs/findIndexFromStart')

class DCMTKEvent {
  #header
  #footer
  #body
  #maxLines
  #multiLine
  #event
  #level

  constructor({event, header, footer, body, maxLines = 1, multiLine = false, level, processor}) {
    this.#header = header
    this.#body = body
    this.#footer = footer
    this.#maxLines = maxLines
    this.#multiLine = multiLine
    this.#event = event
    this.#level = level
    this.#processor = processor || this.#processor
  }

  get maxLines() {
    return this.#maxLines
  }

  #processor = (matches) => matches.groups

  parse(start, log, source) {
    if (!this.isMultiLine()) {
      const body = log[start]
      const matches = this.#body.exec(body)
      if (matches) {
        return {...this.#processor(matches), event: this.#event, dt: new Date(), source}
      }
      return
    }

    const footerIndex = findIndexFromStart(log, start, (ele) => this.#footer.test(ele))
    if (footerIndex === -1) {
      const maxLength = start + this.#maxLines
      if (maxLength < log.length) {
        return {error: `Footer not found and maxLength(${this.#maxLines}) exceeded!`}
      }
      return // wait for more lines
    }
    const body = log.slice(start, footerIndex + 1).join('\n')
    const matches = this.#body.exec(body)

    return {...this.#processor(matches), event: this.#event, dt: new Date(), source, footerIndex}
  }

  hasHeaderMatch(raw) {
    return this.#header.test(raw)
  }

  hasFooterMatch(raw) {
    return this.#footer.test(raw)
  }

  // isValid(raw) {
  //   return this.#body.test(raw)
  // }

  isMultiLine() {
    return this.#multiLine
  }
}

module.exports = DCMTKEvent
