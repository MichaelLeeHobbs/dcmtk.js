const DCMTKEvent = require('../parsers/DCMTKEvent')
const statusSummary = require('./dcmSend/statusSummary')
const addingDICOMFile = require('./dcmSend/addingDICOMFile')
const aAssociateAC = require('./aAssociateAC')
const aAssociateRQ = require('./aAssociateRQ')
const dimseMessage = require('./dimseMessage')
const pdu = require('./pdu')

const receivedEvent = (matches) => {
  let data = matches.groups.data.replaceAll('\\', '\\\\')
  data = JSON.parse(data)
  return {...data}
}

// todo
//  cannot create network: 0006:031c TCP Initialization Error: Only one usage of each socket address (protocol/network address/port) is normally permitted.

const EVENTS = {
  starting: new DCMTKEvent({
    event: 'starting',
    level: 'info',
    body: /^(?<level>\w): \$(?<message>dcmtk: (?<binary>[^]*?) (?<version>v\d+\.\d+.\d+) (?<date>[^]*?)) \$$/
  }),
  sendingEchoRequest: new DCMTKEvent({event: 'sendingEchoRequest', level: 'info', body: /^(?<level>\w): Sending Echo Request \(MsgID (?<msgID>[^]*?)\)$/}),
  receivedEchoResponse: new DCMTKEvent({event: 'receivedEchoResponse', level: 'info', body: /^(?<level>\w): Received Echo Response \((?<status>[^]*?)\)$/}),
  checkingInputFiles: new DCMTKEvent({event: 'checkingInputFiles', level: 'info', body: /^(?<level>\w): (?<message>sending SOP instances) ...$/}),
  sendingSOPInstances: new DCMTKEvent({event: 'sendingSOPInstances', level: 'info', body: /^(?<level>\w): (?<message>sending SOP instances) ...$/}),
  requestingAssociation: new DCMTKEvent({event: 'requestingAssociation', level: 'info', body: /^(?<level>\w): (?<message>Requesting Association)$/}),
  networkSendTimeout: new DCMTKEvent({
    event: 'networkSendTimeout',
    level: 'trace',
    body: /^(?<level>\w): (?<message>setting network send timeout to \d+ seconds)$/
  }),
  networkReceiveTimeout: new DCMTKEvent({
    event: 'networkReceiveTimeout',
    level: 'trace',
    body: /^(?<level>\w): (?<message>setting network receive timeout to \d+ seconds)$/
  }),
  cStoreResponse: new DCMTKEvent({event: 'cStoreResponse', level: 'info', body: /^(?<level>\w): (?<message>Received C-STORE Response)$/}),
  sendingSOPInstance: new DCMTKEvent({
    event: 'sendingSOPInstance',
    level: 'info',
    body: /^(?<level>\w): (?<message>sending SOP instance from file: (?<file>[^]*))$/
  }),
  associationAccepted: new DCMTKEvent({
    event: 'associationAccepted',
    level: 'info',
    body: /^(?<level>\w): (?<message>Association Accepted \(Max Send PDV: (?<maxSendPDV>[^]*)\))$/
  }),
  releasingAssociation: new DCMTKEvent({event: 'releasingAssociation', level: 'info', body: /^(?<level>\w): (?<message>Releasing Association)$/}),
  totalInstances: new DCMTKEvent({
    event: 'totalInstances',
    level: 'info',
    // eslint-disable-next-line max-len
    body: /^(?<level>\w): (?<message>in total, there are (?<totalInstances>[^]*?) SOP instances to be sent, (?<invalidInstances>[^]*?) invalid files are ignored)$/
  }),
  received: new DCMTKEvent({event: 'received', level: 'info', body: /(?<level>\w): cannot execute command '# "(?<data>[^]*?)"'$/, processor: receivedEvent}),
  associationReceivedInitial: new DCMTKEvent({event: 'associationReceivedInitial', level: 'info', body: /(?<level>\w): Association Received$/}),
  associationReceived: new DCMTKEvent({event: 'associationReceived', level: 'info', body: /(?<level>\w): Association Received: (?<host>[^]*)$/}),
  associationAcknowledged: new DCMTKEvent({
    event: 'associationAcknowledged',
    level: 'info',
    body: /(?<level>\w): Association Acknowledged \(Max Send PDV: (?<maxSendPDV>[^]*)\)$/
  }),
  associationRelease: new DCMTKEvent({event: 'associationRelease', level: 'info', body: /(?<level>\w): (?<message>Association Release)$/}),
  creatingSubdirectory: new DCMTKEvent({
    event: 'creatingSubdirectory',
    level: 'info',
    body: /(?<level>\w): creating new subdirectory for study: (?<directory>[^]*)$/
  }),
  constructingAssociatePDU: new DCMTKEvent({
    event: 'constructingAssociatePDU',
    level: 'info',
    body: /(?<level>\w): Constructing Associate (?<type>[^]*?) PDU$/
  }),
  empty: new DCMTKEvent({event: 'empty', level: 'trace', body: /(?<level>\w):\s*$/}),
  validateMetaInfo: new DCMTKEvent({
    event: 'validateMetaInfo',
    level: 'trace',
    body: /(?<level>\w): DcmFileFormat::validateMetaInfo\(\) found \d+ Elements in DcmMetaInfo 'metinf'$/
  }),
  'DcmFileFormat.checkMetaHeaderValueOn': new DCMTKEvent({
    event: 'DcmFileFormat.checkMetaHeaderValueOn',
    level: 'trace',
    body: /(?<level>\w): DcmFileFormat::checkMetaHeaderValue\(\) use (?<use>[^]*?) \[[^]*?] on writing following Dataset$/
  }),
  'DcmFileFormat.checkMetaHeaderValueFrom': new DCMTKEvent({
    event: 'DcmFileFormat.checkMetaHeaderValueFrom',
    level: 'trace',
    body: /(?<level>\w): DcmFileFormat::checkMetaHeaderValue\(\) use (?<use>[^]*?) \[(?<used>[^]*?)] from Dataset$/
  }),
  'DcmFileFormat.checkMetaHeaderValueVersion': new DCMTKEvent({
    event: 'DcmFileFormat.checkMetaHeaderValueVersion',
    level: 'trace',
    body: /(?<level>\w): DcmFileFormat::checkMetaHeaderValue\(\) Version of MetaHeader is (?<isOK>[^]*?): (?<version>[^]*?)$/
  }),
  'DcmDataset.read': new DCMTKEvent({
    event: 'DcmDataset.read',
    level: 'trace',
    body: /(?<level>\w): DcmDataset::read\(\) TransferSyntax="(?<transferSyntax>[^]*?)"$/
  }),
  receivedStoreRequest: new DCMTKEvent({event: 'receivedStoreRequest', level: 'info', body: /(?<level>\w): Received Store Request$/}),
  storing: new DCMTKEvent({event: 'storing', level: 'info', body: /(?<level>\w): storing DICOM file: (?<path>[^]*)\\(?<file>[^]*?)$/}),

  statusSummary,
  addingDICOMFile,
  aAssociateAC,
  aAssociateRQ,
  dimseMessage,
  pdu,
  unhandled: new DCMTKEvent({event: 'unhandled', level: 'warn', body: /(?<level>\w): (?<message>[^]*)/}),
}

const events = Object.values(EVENTS)

module.exports = events
