const DimseMessage = require('../../src/parsers/DimseMessage')
const validInput = `
D: ===================== INCOMING DIMSE MESSAGE ====================
D: Message Type                  : C-STORE RQ
D: Presentation Context ID       : 1
D: Message ID                    : 1
D: Affected SOP Class UID        : XRayAngiographicImageStorage
D: Affected SOP Instance UID     : 1.3.12.2.1107.5.4.3.321890.19960124.162922.29
D: Data Set                      : present
D: Priority                      : medium
D: ======================= END DIMSE MESSAGE =======================
`.trim()

const validParsed = {
  messageType: 'C-STORE RQ',
  presentationContextID: '1',
  messageID: '1',
  affectedSOPClassUID: 'XRayAngiographicImageStorage',
  affectedSOPInstanceUID: '1.3.12.2.1107.5.4.3.321890.19960124.162922.29',
  dataSet: 'present',
  priority: 'medium',
  raw: 'D: ===================== INCOMING DIMSE MESSAGE ====================\n' +
    'D: Message Type                  : C-STORE RQ\n' +
    'D: Presentation Context ID       : 1\n' +
    'D: Message ID                    : 1\n' +
    'D: Affected SOP Class UID        : XRayAngiographicImageStorage\n' +
    'D: Affected SOP Instance UID     : 1.3.12.2.1107.5.4.3.321890.19960124.162922.29\n' +
    'D: Data Set                      : present\n' +
    'D: Priority                      : medium\n' +
    'D: ======================= END DIMSE MESSAGE ======================='
}


describe("DimseMessage", () => {
  test('DimseMessage.parse should parse valid log output', async () => {
    const dimseMessage = DimseMessage.parse(validInput)
    expect(dimseMessage.toJSON()).toEqual(validParsed)
  })
})
