const DCMTKEvent = require('../parsers/DCMTKEvent')

const header = /D: =+ BEGIN A-ASSOCIATE-RQ =+/
const footer = /D: =+ END A-ASSOCIATE-RQ =+/

const body = new RegExp(`
^D: ====================== BEGIN A-ASSOCIATE-RQ =====================
D: Our Implementation Class UID:      (?<OurImplementationClassUID>[\\d.]*)
D: Our Implementation Version Name:   (?<OurImplementationVersionName>[a-zA-Z\\d_]*)
D: Their Implementation Class UID:    (?<TheirImplementationClassUID>[\\d.]*)
D: Their Implementation Version Name: (?<TheirImplementationVersionName>[a-zA-Z\\d_]*)
D: Application Context Name:    (?<ApplicationContextName>[\\d.]*)
D: Calling Application Name:    (?<CallingApplicationName>\\w*)
D: Called Application Name:     (?<CalledApplicationName>[\\w-]*)
D: Responding Application Name: (?<RespondingApplicationName>[\\w-]*)
D: Our Max PDU Receive Size:    (?<OurMaxPDUReceiveSize>\\d*)
D: Their Max PDU Receive Size:  (?<TheirMaxPDUReceiveSize>\\d*)
D: Presentation Contexts:(?<presentationContextsRaw>[^]*?)
D: Requested Extended Negotiation: (?<RequestedExtendedNegotiation>\\w*)
D: Accepted Extended Negotiation:  (?<AcceptedExtendedNegotiation>\\w*)
D: Requested User Identity Negotiation: (?<RequestedUserIdentityNegotiation>\\w*)
D: User Identity Negotiation Response:  (?<UserIdentityNegotiationResponse>\\w*)
D: ======================= END A-ASSOCIATE-RQ ======================`.trim(), '')

const presentationContext = function (raw) {
  const regex = new RegExp(`
D: *Context ID: *(?<contextID>.*) *\\((?<contextAccepted>.*)\\)
D: *Abstract Syntax: *=(?<abstractSyntax>.*)
D: *Proposed SCP\\/SCU Role: *(?<proposedSCPSCURole>.*)
D: *Proposed Transfer Syntax\\(es\\):(?<proposedTransferSyntaxes>[^]*)
`.trim(), 'g')

  let presentationContexts = []
  let result
  while ((result = regex.exec(raw)) !== null) {
    const {proposedTransferSyntaxes, ...rest} = result.groups
    const syntaxes = proposedTransferSyntaxes.trim().split(/\r?\n/).map(ele => {
      const parts = ele.split('=')
      return parts[1]
    })
    presentationContexts.push({
      // raw: result[0],
      ...rest,
      proposedTransferSyntaxes: syntaxes
    })
  }
  return presentationContexts
}

const processor = function (matches) {
  const {presentationContextsRaw, ...rest} = matches.groups
  return {
    dt: new Date(),
    // raw: matches[0],
    ...rest,
    presentationContexts: presentationContext(presentationContextsRaw.trim()),
    // presentationContexts: presentationContextsRaw.trim(),
  }

}

const aAssociateRQ = new DCMTKEvent({
  event: 'aAssociateRQ',
  header,
  footer,
  body,
  maxLines: 100,
  multiLine: true,
  processor: (matches) => {
    const {presentationContextsRaw, ...rest} = matches.groups
    return {
      ...rest,
      presentationContexts: presentationContext(presentationContextsRaw.trim()),
    }
  }
})

module.exports = aAssociateRQ
