const BaseDCMObj = require('./BaseDCMObj')
const PresentationContext = require('./PresentationContext')

class AAssociateAC extends BaseDCMObj {
  constructor({
                ourImplementationClassUID, ourImplementationVersionName, theirImplementationClassUID, theirImplementationVersionName, applicationContextName,
                callingApplicationName, calledApplicationName, respondingApplicationName, ourMaxPDUReceiveSize, theirMaxPDUReceiveSize,
                requestedExtendedNegotiation, acceptedExtendedNegotiation, requestedUserIdentityNegotiation, userIdentityNegotiationResponse,
                presentationContexts, raw
              }) {
    super(...arguments)

    this._ourImplementationClassUID = ourImplementationClassUID
    this._ourImplementationVersionName = ourImplementationVersionName
    this._theirImplementationClassUID = theirImplementationClassUID
    this._theirImplementationVersionName = theirImplementationVersionName
    this._applicationContextName = applicationContextName
    this._callingApplicationName = callingApplicationName
    this._calledApplicationName = calledApplicationName
    this._respondingApplicationName = respondingApplicationName
    this._ourMaxPDUReceiveSize = ourMaxPDUReceiveSize
    this._theirMaxPDUReceiveSize = theirMaxPDUReceiveSize
    this._requestedExtendedNegotiation = requestedExtendedNegotiation
    this._acceptedExtendedNegotiation = acceptedExtendedNegotiation
    this._requestedUserIdentityNegotiation = requestedUserIdentityNegotiation
    this._userIdentityNegotiationResponse = userIdentityNegotiationResponse
    this._presentationContexts = presentationContexts
    this._raw = raw
  }

  get raw() {
    return this._raw
  }

  get ourImplementationClassUID() {
    return this._ourImplementationClassUID
  }

  get ourImplementationVersionName() {
    return this._ourImplementationVersionName
  }

  get theirImplementationClassUID() {
    return this._theirImplementationClassUID
  }

  get theirImplementationVersionName() {
    return this._theirImplementationVersionName
  }

  get applicationContextName() {
    return this._applicationContextName
  }

  get callingApplicationName() {
    return this._callingApplicationName
  }

  get calledApplicationName() {
    return this._calledApplicationName
  }

  get respondingApplicationName() {
    return this._respondingApplicationName
  }

  get ourMaxPDUReceiveSize() {
    return this._ourMaxPDUReceiveSize
  }

  get theirMaxPDUReceiveSize() {
    return this._theirMaxPDUReceiveSize
  }

  get requestedExtendedNegotiation() {
    return this._requestedExtendedNegotiation
  }

  get acceptedExtendedNegotiation() {
    return this._acceptedExtendedNegotiation
  }

  get requestedUserIdentityNegotiation() {
    return this._requestedUserIdentityNegotiation
  }

  get userIdentityNegotiationResponse() {
    return this._userIdentityNegotiationResponse
  }

  get presentationContexts() {
    return this._presentationContexts
  }
}

AAssociateAC.parse = function (raw) {
  let header = new RegExp(`
D: ====================== BEGIN A-ASSOCIATE-AC =====================
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
D: Presentation Contexts:
`.trim())
  let footer = new RegExp(`
D: Requested Extended Negotiation: (?<requestedExtendedNegotiation>.*)
D: Accepted Extended Negotiation:  (?<acceptedExtendedNegotiation>.*)
D: Requested User Identity Negotiation: (?<requestedUserIdentityNegotiation>.*)
D: User Identity Negotiation Response:  (?<userIdentityNegotiationResponse>.*)
D: ======================= END A-ASSOCIATE-AC ======================
`.trim())
  const isValid = raw.includes('====================== BEGIN A-ASSOCIATE-AC =====================') && raw.includes('======================= END A-ASSOCIATE-AC ======================')
  if (!isValid) return
  const parsed = {
    raw,
    ...header.exec(raw).groups,
    presentationContexts: PresentationContext.parse(raw),
    ...footer.exec(raw).groups,
  }
  return new AAssociateAC(parsed)
}

module.exports = AAssociateAC

