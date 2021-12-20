const DCMTKEvent = require('../parsers/DCMTKEvent')

const header = /D: =+ BEGIN A-ASSOCIATE-AC =+/
const footer = /D: =+ END A-ASSOCIATE-AC =+/

const body = new RegExp(`
^D: ====================== BEGIN A-ASSOCIATE-AC =====================
D: Our Implementation Class UID:      (?<ourImplementationClassUID>.*)
D: Our Implementation Version Name:   (?<ourImplementationVersionName>.*)
D: Their Implementation Class UID:    (?<theirImplementationClassUID>.*)
D: Their Implementation Version Name: (?<theirImplementationVersionName>.*)
D: Application Context Name:    (?<applicationContextName>.*)
D: Calling Application Name:    (?<callingApplicationName>.*)
D: Called Application Name:     (?<calledApplicationName>.*)
D: Responding Application Name: (?<respondingApplicationName>.*)
D: Our Max PDU Receive Size:    (?<ourMaxPDUReceiveSize>.*)
D: Their Max PDU Receive Size:  (?<theirMaxPDUReceiveSize>.*)
D: Presentation Contexts:(?<presentationContextsRaw>[^]*?)
D: Requested Extended Negotiation: (?<requestedExtendedNegotiation>.*)
D: Accepted Extended Negotiation:  (?<acceptedExtendedNegotiation>.*)
D: Requested User Identity Negotiation: (?<requestedUserIdentityNegotiation>.*)
D: User Identity Negotiation Response:  (?<userIdentityNegotiationResponse>.*)
D: ======================= END A-ASSOCIATE-AC ======================
`.trim())

const presentationContext = function (raw) {
  const regex = new RegExp(`
D: *Context ID: *(?<contextID>[^]*?) *\\((?<contextAccepted>[^]*?)\\)
D: *Abstract Syntax: *=(?<abstractSyntax>[^]*?)
D: *Proposed SCP\\/SCU Role: *(?<proposedSCPSCURole>[^]*?)
D: *Accepted SCP\\/SCU Role: *(?<acceptedSCPSCURole>[^]*?)
D: *Accepted Transfer Syntax: =(?<acceptedTransferSyntax>[^]*)
`.trim(), 'g')

  let presentationContexts = []
  let result
  while ((result = regex.exec(raw)) !== null) {
    presentationContexts.push(result.groups)
  }
  return presentationContexts
}

const aAssociateACParser = new DCMTKEvent({
  event: 'aAssociateAC',
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

module.exports = aAssociateACParser
