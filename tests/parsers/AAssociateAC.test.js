const AAssociateAC = require('../../src/parsers/AAssociateAC')
const validInput = `
D: ====================== BEGIN A-ASSOCIATE-AC =====================
D: Our Implementation Class UID:      1.2.276.0.7230010.3.0.3.6.6
D: Our Implementation Version Name:   OFFIS_DCMTK_366
D: Their Implementation Class UID:    1.2.276.0.7230010.3.0.3.6.6
D: Their Implementation Version Name: OFFIS_DCMTK_366
D: Application Context Name:    1.2.840.10008.3.1.1.1
D: Calling Application Name:    DCMSEND
D: Called Application Name:     ANY-SCP
D: Responding Application Name: ANY-SCP
D: Our Max PDU Receive Size:    16384
D: Their Max PDU Receive Size:  131072
D: Presentation Contexts:
D:   Context ID:        1 (Accepted)
D:     Abstract Syntax: =XRayAngiographicImageStorage
D:     Proposed SCP/SCU Role: Default
D:     Accepted SCP/SCU Role: Default
D:     Accepted Transfer Syntax: =JPEGBaseline
D: Requested Extended Negotiation: none
D: Accepted Extended Negotiation:  none
D: Requested User Identity Negotiation: none
D: User Identity Negotiation Response:  none
D: ======================= END A-ASSOCIATE-AC ======================
`.trim()

const validParsed = {
  ourImplementationClassUID: '1.2.276.0.7230010.3.0.3.6.6',
  ourImplementationVersionName: 'OFFIS_DCMTK_366',
  theirImplementationClassUID: '1.2.276.0.7230010.3.0.3.6.6',
  theirImplementationVersionName: 'OFFIS_DCMTK_366',
  applicationContextName: '1.2.840.10008.3.1.1.1',
  callingApplicationName: 'DCMSEND',
  calledApplicationName: 'ANY-SCP',
  respondingApplicationName: 'ANY-SCP',
  ourMaxPDUReceiveSize: '16384',
  theirMaxPDUReceiveSize: '131072',
  requestedExtendedNegotiation: 'none',
  acceptedExtendedNegotiation: 'none',
  requestedUserIdentityNegotiation: 'none',
  userIdentityNegotiationResponse: 'none',
  presentationContexts: [
    {
      raw: 'D:   Context ID:        1 (Accepted)\n' +
        'D:     Abstract Syntax: =XRayAngiographicImageStorage\n' +
        'D:     Proposed SCP/SCU Role: Default\n' +
        'D:     Accepted SCP/SCU Role: Default\n' +
        'D:     Accepted Transfer Syntax: =JPEGBaseline',
      contextID: '1',
      contextAccepted: 'Accepted',
      abstractSyntax: 'XRayAngiographicImageStorage',
      proposedSCPSCURole: 'Default',
      acceptedSCPSCURole: 'Default',
      acceptedTransferSyntax: 'JPEGBaseline'
    }
  ],
  raw: 'D: ====================== BEGIN A-ASSOCIATE-AC =====================\n' +
    'D: Our Implementation Class UID:      1.2.276.0.7230010.3.0.3.6.6\n' +
    'D: Our Implementation Version Name:   OFFIS_DCMTK_366\n' +
    'D: Their Implementation Class UID:    1.2.276.0.7230010.3.0.3.6.6\n' +
    'D: Their Implementation Version Name: OFFIS_DCMTK_366\n' +
    'D: Application Context Name:    1.2.840.10008.3.1.1.1\n' +
    'D: Calling Application Name:    DCMSEND\n' +
    'D: Called Application Name:     ANY-SCP\n' +
    'D: Responding Application Name: ANY-SCP\n' +
    'D: Our Max PDU Receive Size:    16384\n' +
    'D: Their Max PDU Receive Size:  131072\n' +
    'D: Presentation Contexts:\n' +
    'D:   Context ID:        1 (Accepted)\n' +
    'D:     Abstract Syntax: =XRayAngiographicImageStorage\n' +
    'D:     Proposed SCP/SCU Role: Default\n' +
    'D:     Accepted SCP/SCU Role: Default\n' +
    'D:     Accepted Transfer Syntax: =JPEGBaseline\n' +
    'D: Requested Extended Negotiation: none\n' +
    'D: Accepted Extended Negotiation:  none\n' +
    'D: Requested User Identity Negotiation: none\n' +
    'D: User Identity Negotiation Response:  none\n' +
    'D: ======================= END A-ASSOCIATE-AC ======================'
}

describe("AAssociateAC", () => {
  test('AAssociateAC.parse should parse valid log output', async () => {
    const aAssociateAC = AAssociateAC.parse(validInput)
    expect(aAssociateAC.toJSON()).toEqual(validParsed)
  })
})
