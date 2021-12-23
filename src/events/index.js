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
  checkingInputFiles: new DCMTKEvent({event: 'checkingInputFiles', level: 'trace', body: /^(?<level>\w): checking input files ...$/}),
  initializingNetwork: new DCMTKEvent({event: 'initializingNetwork', level: 'trace', body: /^(?<level>\w): initializing network ...$/}),
  sendingSOPInstances: new DCMTKEvent({event: 'sendingSOPInstances', level: 'info', body: /^(?<level>\w): sending SOP instances ...$/}),
  startingSCP: new DCMTKEvent({event: 'startingSCP', level: 'info', body: /^(?<level>\w): starting service class provider and listening ...$/}),
  loadingConfiguration: new DCMTKEvent({
    event: 'loadingConfiguration',
    level: 'info',
    body: /^(?<level>\w): Loading association configuration file: (?<file>[^]*?)$/
  }),
  configuringSCP: new DCMTKEvent({event: 'configuringSCP', level: 'trace', body: /^(?<level>\w): configuring service class provider ...$/}),
  requestingAssociation: new DCMTKEvent({event: 'requestingAssociation', level: 'info', body: /^(?<level>\w): Requesting Association$/}),
  associationTerminated: new DCMTKEvent({event: 'associationTerminated', level: 'info', body: /^(?<level>\w): DcmSCP: Association Terminated$/}),
  cleaningUp: new DCMTKEvent({event: 'associationTerminated', level: 'info', body: /^(?<level>\w): Cleaning up internal association and network structures$/}),
  determiningInputFiles: new DCMTKEvent({event: 'determiningInputFiles', level: 'trace', body: /^(?<level>\w): determining input files ...$/}),
  checkingSOPUIDConsistent: new DCMTKEvent({
    event: 'checkingUIDConsistent',
    level: 'trace',
    body: /^(?<level>\w): checking whether SOP Class UID and SOP Instance UID in dataset are consistent with transfer list$/
  }),
  gettingSOPUID: new DCMTKEvent({
    event: 'gettingSOPUID',
    level: 'trace',
    body: /^(?<level>\w): getting SOP Class UID, SOP Instance UID and Transfer Syntax UID from DICOM dataset$/
  }),
  preparingPresentationContext: new DCMTKEvent({
    event: 'preparingPresentationContext',
    level: 'trace',
    body: /^(?<level>\w): preparing presentation context for SOP Class \/ Transfer Syntax: (?<msgID>[^]*?)$/
  }),
  proposeUncompressedTransferSyntaxes: new DCMTKEvent({
    event: 'preparingPresentationContext',
    level: 'trace',
    body: /^(?<level>\w): (?<message>also propose the three uncompressed transfer syntaxes, because we can decompress the SOP instance \(if required\))$/
  }),
  addedPresentationContext: new DCMTKEvent({
    event: 'addedPresentationContext',
    level: 'trace',
    body: /^(?<level>\w): added new presentation context with ID (?<id>[^]*?)$/
  }),
  configuredPresentationContext: new DCMTKEvent({
    event: 'configuredPresentationContext',
    level: 'trace',
    body: /^(?<level>\w): Configured a total of (?<count>[^]*?) presentation contexts for SCU$/
  }),
  startingAssociation: new DCMTKEvent({
    event: 'startingAssociation',
    level: 'info',
    body: /^(?<level>\w): starting association #(?<number>[^]*?)$/
  }),
  negotiatingNetworkAssociation: new DCMTKEvent({
    event: 'negotiatingNetworkAssociation',
    level: 'info',
    body: /^(?<level>\w): negotiating network association ...$/
  }),
  separator: new DCMTKEvent({
    event: 'separator',
    level: 'trace',
    body: /^(?<level>\w): -|\++$/
  }),
  multipleAssociationsAllowed: new DCMTKEvent({
    event: 'multipleAssociationsAllowed',
    level: 'trace',
    body: /^(?<level>\w): multiple associations allowed \(option --multi-associations used\)$/
  }),
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
  receivedDatasetPresentationContext: new DCMTKEvent({
    event: 'receivedDatasetPresentationContext',
    level: 'info',
    body: /^(?<level>\w): Received dataset on presentation context (?<id>[^]*?) and stored it directly to file$/
  }),
  receivedCStoreResponse: new DCMTKEvent({event: 'cStoreResponse', level: 'info', body: /^(?<level>\w): Received C-STORE Response$/}),
  receivedCStoreRequest: new DCMTKEvent({event: 'cStoreResponse', level: 'info', body: /^(?<level>\w): Received C-STORE Request$/}),
  receivedAssociationReleaseRequest: new DCMTKEvent({event: 'cStoreResponse', level: 'info', body: /^(?<level>\w): Received Association Release Request$/}),
  sendingCStoreRequest: new DCMTKEvent({event: 'sendingCStore', level: 'info', body: /^(?<level>\w): Sending C-STORE Request$/}),
  sendingCStoreResponse: new DCMTKEvent({event: 'sendingCStore', level: 'info', body: /^(?<level>\w): Sending C-STORE Response$/}),
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
  associationReceived2: new DCMTKEvent({
    event: 'associationReceived',
    level: 'info',
    body: /(?<level>\w): Association Received (?<host>[^]*): (?<callingAETitle>[^]*) -> (?<calledAETitle>[^]*)$/
  }),
  associationAcknowledged: new DCMTKEvent({
    event: 'associationAcknowledged',
    level: 'info',
    body: /(?<level>\w): Association Acknowledged \(Max Send PDV: (?<maxSendPDV>[^]*)\)$/
  }),
  associationAcknowledged2: new DCMTKEvent({
    event: 'associationAcknowledged',
    level: 'info',
    body: /(?<level>\w): DcmSCP: Association Acknowledged$/
  }),
  generatedFilename: new DCMTKEvent({
    event: 'generatedFilename',
    level: 'info',
    body: /(?<level>\w): generated filename for object to be received: (?<filename>[^]*?)$/
  }),
  overwritingFile: new DCMTKEvent({
    event: 'overwriting',
    level: 'info',
    body: /(?<level>\w): file already exists, overwriting: (?<filename>[^]*?)$/
  }),
  storedFile: new DCMTKEvent({
    event: 'overwriting',
    level: 'info',
    body: /(?<level>\w): Stored received object to file: (?<filename>[^]*?)$/
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
  checkAndReadPreamble: new DCMTKEvent({
    event: 'DcmMetaInfo.checkAndReadPreamble',
    level: 'trace',
    body: /(?<level>\w): DcmMetaInfo::checkAndReadPreamble\(\) TransferSyntax="(?<transferSyntax>[^]*?)"$/
  }),
  validateMetaInfo: new DCMTKEvent({
    event: 'DcmFileFormat.validateMetaInfo',
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
