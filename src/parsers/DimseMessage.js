const BaseDCMObj = require('./BaseDCMObj')

class DimseMessage extends BaseDCMObj {
  constructor({raw, messageType, presentationContextID, messageID, affectedSOPClassUID, affectedSOPInstanceUID, dataSet, priority}) {
    super(...arguments)
    this._messageType = messageType
    this._presentationContextID = presentationContextID
    this._messageID = messageID
    this._affectedSOPClassUID = affectedSOPClassUID
    this._affectedSOPInstanceUID = affectedSOPInstanceUID
    this._dataSet = dataSet
    this._priority = priority
    this._raw = raw
  }

  get messageType() {
    return this._messageType
  }

  get presentationContextID() {
    return this._presentationContextID
  }

  get messageID() {
    return this._messageID
  }

  get affectedSOPClassUID() {
    return this._affectedSOPClassUID
  }

  get affectedSOPInstanceUID() {
    return this._affectedSOPInstanceUID
  }

  get dataSet() {
    return this._dataSet
  }

  get priority() {
    return this._priority
  }

  get raw() {
    return this._raw
  }
}

DimseMessage.parse = function (raw) {
  let regex = new RegExp(`
D: ===================== INCOMING DIMSE MESSAGE ====================
D: Message Type                  : (?<messageType>.*)
D: Presentation Context ID       : (?<presentationContextID>.*)
D: Message ID                    : (?<messageID>.*)
D: Affected SOP Class UID        : (?<affectedSOPClassUID>.*)
D: Affected SOP Instance UID     : (?<affectedSOPInstanceUID>.*)
D: Data Set                      : (?<dataSet>.*)
D: Priority                      : (?<priority>.*)
D: ======================= END DIMSE MESSAGE =======================
`.trim())

  const isValid = raw.includes('===================== INCOMING DIMSE MESSAGE ====================') && raw.includes('======================= END DIMSE MESSAGE =======================')
  if (!isValid) return
  const parsed = regex.exec(raw).groups
  return new DimseMessage({raw, ...parsed})
}

module.exports = DimseMessage
