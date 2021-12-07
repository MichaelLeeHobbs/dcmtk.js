const BaseDCMObj = require('./BaseDCMObj')

class PresentationContext extends BaseDCMObj {
  constructor({raw, contextID, contextAccepted, abstractSyntax, proposedSCPSCURole, acceptedSCPSCURole, acceptedTransferSyntax}) {
    super(...arguments)
    this._raw = raw
    this._contextID = contextID
    this._contextAccepted = contextAccepted
    this._abstractSyntax = abstractSyntax
    this._proposedSCPSCURole = proposedSCPSCURole
    this._acceptedSCPSCURole = acceptedSCPSCURole
    this._acceptedTransferSyntax = acceptedTransferSyntax
  }

  get raw() {
    return this._raw
  }

  get contextID() {
    return this._contextID
  }

  get contextAccepted() {
    return this._contextAccepted
  }

  get abstractSyntax() {
    return this._abstractSyntax
  }

  get proposedSCPSCURole() {
    return this._proposedSCPSCURole
  }

  get acceptedSCPSCURole() {
    return this._acceptedSCPSCURole
  }

  get acceptedTransferSyntax() {
    return this._acceptedTransferSyntax
  }
}
PresentationContext.parse = function (raw) {
  const regex = new RegExp(`
D:   Context ID:        (?<contextID>.*) \\((?<contextAccepted>.*)\\)
D:     Abstract Syntax: =(?<abstractSyntax>.*)
D:     Proposed SCP\\/SCU Role: (?<proposedSCPSCURole>.*)
D:     Accepted SCP\\/SCU Role: (?<acceptedSCPSCURole>.*)
D:     Accepted Transfer Syntax: =(?<acceptedTransferSyntax>.*)
`.trim(), 'g')

  let presentationContexts = []
  let result
  while ((result = regex.exec(raw)) !== null) {
    presentationContexts.push(new PresentationContext({raw: result[0], ...result.groups}))
  }
  return presentationContexts
}

module.exports = PresentationContext
