const DCMTKEvent = require('../../parsers/DCMTKEvent')

const header = /^I: Status Summary/
const footer = /I: *\* with status SUCCESS +: (?<success>[^]+?)$/
const body = new RegExp(`
I: Status Summary
I: --------------
I: Number of associations   : (?<numberOfAssociations>[^]*?)
I: Number of pres. contexts : (?<numberOfPresentationContext>[^]*?)
I: Number of SOP instances  : (?<numberOfSOPInstances>[^]*?)
I: - sent to the peer       : (?<sent>[^]*)
I: *\\* with status SUCCESS  : (?<success>[^]+?)\n?
`.trim())

// todo
//     "I: Status Summary",
//     "I: --------------",
//     "I: Number of associations   : 1",
//     "I: Number of pres. contexts : 1",
//     "I: Number of SOP instances  : 3",
//     "I: - NOT sent to the peer   : 3",
//     "I:   * no acceptable pres.  : 3"

const processor = function (matches) {
  return {...matches?.groups, dt: new Date(),}
}


const statusSummary = new DCMTKEvent({
  event: 'statusSummary',
  header,
  footer,
  body,
  maxLines: 7,
  multiLine: true,
  // processor: (matches) => {
  //   const {presentationContextsRaw, ...rest} = matches.groups
  //   return {
  //     ...rest,
  //   }
  // }
})

module.exports = statusSummary
