// process.env.DEBUG = 'DCMTKParser'

const fs = require('fs')
const path = require('path')
const DCM2XML = require('../../src/dcmdata/DCM2XML')

const testOutputPath = path.resolve(path.resolve(process.cwd(), 'output/tests/dcmdata'))
const fileOut = path.resolve(path.resolve(process.cwd(), 'output/tests/dcmdata/0002.xml'))
const jsonOut = path.resolve(path.resolve(process.cwd(), 'output/tests/dcmdata/0002.json'))
const dicomFile = path.resolve(path.resolve(process.cwd(), 'dicomSamples/other/0002.DCM'))
fs.mkdirSync(testOutputPath, {recursive: true})

describe('DCM2XML', () => {
  // test('it should not throw on version', async () => {
  //   const dcmRecv = new DCMRecv({
  //     aeTitle: 'test',
  //     maxPDU: 131072,
  //     outputDirectory: path.resolve(process.cwd(), 'output'),
  //     subdirectory: true,
  //     filenameExtension: '.dcm',
  //     port: 13104,
  //   })
  //   const test = async () => {
  //     const version = await dcmRecv.version()
  //     console.log('version?\n', version)
  //   }
  //   await expect(test()).resolves.not.toThrow()
  //
  // })

  test('it should convert DICOM to XML', async () => {
    const dcm2xml = new DCM2XML({XMLOptions: {embedDTDReference: true, writeBinaryData: true, writeElementName: true}, binaryEncoding: 'base64'})
    // const dcm2xml = new DCM2XML({XMLFormat: 'native', XMLOptions: {writeBinaryData: false, writeElementName: undefined}, binaryEncoding: 'base64', useXMLNamespace: true})
    const main = async () => {
      // const result = await dcm2xml.toXML(dicomFile, outFile)
      const result = await dcm2xml.toXML({shouldParse: true, jsonOut, jsonOptions: [null, 2], fileIn: dicomFile, fileOut})
      console.log(result)
    }
    await expect(main()).resolves.not.toThrow()
  })

})
