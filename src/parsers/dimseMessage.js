const header = new RegExp('^D: =+ (?<type>.*) DIMSE MESSAGE =+')
const footer = new RegExp('D: =+ END DIMSE MESSAGE =+')

const parse = function (raw) {
  const propertyRegex = new RegExp('D: (?<property>.*?): (?<value>.*)')


  const allRegex = new RegExp(`${header.toString().slice(1,-1)}(?<body>[^]*?)${footer.toString().slice(1,-1)}`)
  const isValid = header.test(raw) && footer.test(raw)
  if (!isValid) {
    return
  }

  const parsed = {dt: new Date()}

  const {type, body} = allRegex.exec(raw)?.groups || {}

  const lines = body.split(/\r?\n/)
  parsed.type = type
  lines.forEach((line) => {
    const {property, value} = propertyRegex.exec(line)?.groups || {}
    if (property) {
      parsed[property.replace(/ /g, '')] = value
    }
  })
  // parsed.raw = allRegex.exec(raw)[0]
  return parsed
}
module.exports = {
  parse,
  header,
  footer
}
