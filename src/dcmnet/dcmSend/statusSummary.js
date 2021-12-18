const header = new RegExp('^I: Status Summary')
const footer = new RegExp('I: *\\* with status SUCCESS +: (?<success>[^]+?)\n?')

const parse = function (raw) {
  const allRegex = new RegExp(`
I: Status Summary
I: --------------
I: Number of associations   : (?<numberOfAssociations>[^]*?)
I: Number of pres. contexts : (?<numberOfPresentationContext>[^]*?)
I: Number of SOP instances  : (?<numberOfSOPInstances>[^]*?)
I: - sent to the peer       : (?<sent>[^]*)
I: *\\* with status SUCCESS  : (?<success>[^]+?)\n?
`.trim())

  const matches = allRegex.exec(raw)
  const parsed = {...matches?.groups, dt: new Date(),}
  // parsed.raw = allRegex.exec(raw)[0]
  return parsed
}
module.exports = {
  parse,
  header,
  footer
}
