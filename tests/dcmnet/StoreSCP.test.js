const path = require('path')
const StoreSCP = require('../../src/dcmnet/StoreSCP')
const DCMSend = require('../../src/dcmnet/DCMSend')

const sleep = (ms = 1000) => new Promise((resolve) => setTimeout(resolve, ms))

describe('StoreSCP', () => {
  test('it should not throw on listen and stop', async () => {
    const storeSCPStartStop = new StoreSCP({
      preferredTransferSyntaxes: ['all'],
      aeTitle: 'test',
      maxPDU: 131072,
      promiscuous: true,
      disableHostLookup: true,
      // outputDirectory: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\output',
      outputDirectory: path.resolve(process.cwd(), 'output'),
      sort: {by: 'timestamp', prefix: ''},
      filenameExtension: '.dcm',
      port: 11104,
    })
    const main = async () => {
      const result = await storeSCPStartStop.listen()
      // storeSCPStartStop.on('starting', () => storeSCPStartStop.close())
      await storeSCPStartStop.close()
    }
    await expect(main()).resolves.not.toThrow()
  })

  test('it should emit events while accepting a store request from DCMSend', async () => {
    const storeSCP = new StoreSCP({
      preferredTransferSyntaxes: ['all'],
      aeTitle: 'test',
      maxPDU: 131072,
      promiscuous: true,
      disableHostLookup: true,
      outputDirectory: path.resolve(process.cwd(), 'output'),
      // sort: {by: 'UID', prefix: ''},
      sort: {by: 'timestamp', prefix: ''},
      // bitPreserving: true,
      filenameExtension: '.dcm',
      port: 104,
    })
    const onExit = jest.fn()
    const onAssociationRelease = jest.fn()
    const onStarting = jest.fn()

    storeSCP.on('starting', onStarting)
    storeSCP.on('exit', (msg) => {
      // console.log('StoreSCP server exited...')
      // console.log('StoreSCP results:', JSON.stringify(msg, null, 2))
      onExit(msg)
    })
    storeSCP.on('associationRelease', (msg) => {
      onAssociationRelease(msg)
      storeSCP.close()
    })

    const main = async () => {
      await storeSCP.listen()
      const dcmSend = new DCMSend({
        peer: '127.0.0.1', port: 104,
        inputFiles: 'scan', recurse: true, compression: 0,
        noHalt: true, noIllegalProposal: false, noUidChecks: true,
        AETitle: 'dcmSend', calledAETitle: undefined,
        timeout: 15, maxPDU: 131072, maxSendPDU: 131072, reportFile: undefined,
      })

      const results = await dcmSend.send({dcmFileIn: path.resolve(process.cwd(), 'dicomSamples/other')})

      // todo do something with results?
      // console.log(JSON.stringify({dcmSendResults: results}, null, 2))
      // need to sleep to give storeSCP.on('exit' time to fire
      await sleep()
    }
    await expect(main()).resolves.not.toThrow()

    expect(onStarting).toBeCalledTimes(1)
    expect(onExit).toBeCalledTimes(1)
    expect(onAssociationRelease).toBeCalledTimes(1)
  })
})
