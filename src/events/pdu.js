const DCMTKEvent = require('../parsers/DCMTKEvent')

const header = new RegExp('^D: PDU Type: (?<pduType>[^]*?), PDU Length: (?<pduLength>[^]*?) PDU header(?<pduHeader>[^]*?)')
const footer = new RegExp('D: Parsing an A-ASSOCIATE PDU')
const body = /^D: PDU Type: (?<pduType>[^]*?), PDU Length: (?<pduLength>[^]*?) PDU header(?<pduHeader>[^]*?)\nD: Parsing an [^]*? PDU/

const processor = function (matches) {
  let {pduHeader, ...rest} = matches.groups
  let pduHeaderArray = pduHeader.trim().replace(/D: */g, '').replace(/\n/g, ' ').split(/ +/)
  return {
    ...rest,
    pduHeaderRaw: pduHeader,
    pduHeader: pduHeaderArray,
  }
}

const pdu = new DCMTKEvent({
  event: 'pdu',
  header,
  footer,
  body,
  maxLines: 25,
  multiLine: true,
  processor,
})

module.exports = pdu
