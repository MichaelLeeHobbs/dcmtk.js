const header = new RegExp('^D: PDU Type: (?<pduType>[^]*?), PDU Length: (?<pduLength>[^]*?) PDU header(?<pduHeader>[^]*?)')
const footer = new RegExp('D: Parsing an A-ASSOCIATE PDU')

const pdu = function (raw) {
  let regex = /^D: PDU Type: (?<pduType>[^]*?), PDU Length: (?<pduLength>[^]*?) PDU header(?<pduHeader>[^]*?)\nD: Parsing an [^]*? PDU/
  if (!regex.test(raw)) {
    return
  }
  const matches = regex.exec(raw)
  let {pduHeader, ...rest} = matches.groups
  let pduHeaderArray = pduHeader.trim().replace(/D: */g, '').replace(/\n/g, ' ').split(/ +/)
  return {
    dt: new Date(),
    // raw: matches[0],
    ...rest,
    pduHeaderRaw: pduHeader,
    pduHeader: pduHeaderArray,
    // presentationContexts: presentationContext.parse(presentationContextsRaw.trim()),
  }
}

module.exports = {
  parse: pdu,
  header,
  footer
}
