// process.env.DEBUG = 'DCMTKParser'

const path = require('path')
const StoreSCP = require('../../src/dcmnet/StoreSCP')
const EchoSCU = require('../../src/dcmnet/EchoSCU')

describe('EchoSCU', () => {
  test('it should do echo and parse response', async () => {
    const storeSCP = new StoreSCP({
      preferredTransferSyntaxes: ['all'],
      aeTitle: 'test',
      maxPDU: 131072,
      promiscuous: true,
      disableHostLookup: true,
      // outputDirectory: 'output',
      outputDirectory: path.resolve(process.cwd(), 'output'),
      sort: {by: 'timestamp', prefix: ''},
      filenameExtension: '.dcm',
      port: 12104,
    })
    const echoSCU = new EchoSCU({
      callingAETitle: 'CALLER',
      calledAETitle: 'CALLED',
      dimseTimeout: 60,
      maxPDU: 131072,
      repeat: 5,
      host: 'localhost',
      port: 12104,
    })
    const main = async () => {
      await storeSCP.listen()
      const result = await echoSCU.ping()
      await storeSCP.close()

      const unhandled = result.messages.filter(ele => ele.event === 'unhandled')
      if (unhandled.length > 0) {
        throw new Error(`Unhandled Events Detected!\n${JSON.stringify(unhandled, null, 2)}`)
      }
      return result
    }

    await expect(main()).resolves.not.toThrow()
  })

})
