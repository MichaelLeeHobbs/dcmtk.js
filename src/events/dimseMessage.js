const DCMTKEvent = require('../parsers/DCMTKEvent')

const headerPattern = '^D: =+ (?<type>.*) DIMSE MESSAGE =+'
const footerPattern = 'D: =+ END DIMSE MESSAGE =+'

const header = new RegExp(headerPattern)
const footer = new RegExp(footerPattern)
const body = new RegExp(`${headerPattern}(?<body>[^]*?)${footerPattern}`)

const processor = function (matches) {
  const propertyRegex = new RegExp('D: (?<property>.*?): (?<value>.*)')
  const {type, body} = matches.groups
  const lines = body.split(/\r?\n/)
  const parsed = {type}
  lines.forEach((line) => {
    const {property, value} = propertyRegex.exec(line)?.groups || {}
    if (property) {
      parsed[property.replace(/ /g, '')] = value
    }
  })
  return parsed
}

const dimseMessage = new DCMTKEvent({
  event: 'dimseMessage',
  header,
  footer,
  body,
  maxLines: 15,
  multiLine: true,
  processor,
})

module.exports = dimseMessage
