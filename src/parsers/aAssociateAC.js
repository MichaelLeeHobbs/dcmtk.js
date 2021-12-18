const header = /D: =+ BEGIN A-ASSOCIATE-AC =+/
const footer = /D: =+ END A-ASSOCIATE-AC =+/

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
    presentationContexts.push({
      // raw: result[0],
      ...result.groups
    })
  }
  return presentationContexts
}

const aAssociateAC = function (raw) {
  let regex = new RegExp(`
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
  if (!regex.test(raw)) {
    return
  }
  const matches = regex.exec(raw)
  const {presentationContextsRaw, ...rest} = matches.groups
  return {
    dt: new Date(),
    // raw: matches[0],
    ...rest,
    presentationContexts: presentationContext(presentationContextsRaw.trim()),
  }
}

module.exports = {
  parse: aAssociateAC,
  header,
  footer
}


