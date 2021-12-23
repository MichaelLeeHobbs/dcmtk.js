// process.env.DEBUG = 'DCMTKParser'

const fs = require('fs')
const path = require('path')
const DCMRecv = require('../../src/dcmnet/DCMRecv')
const DCMSend = require('../../src/dcmnet/DCMSend')
const sleep = require('../../src/libs/sleep')

const testOutputPath = path.resolve(path.resolve(process.cwd(), 'output/tests'))
fs.mkdirSync(testOutputPath, {recursive: true})

describe('DCMRecv', () => {
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

  test('it should not throw on listen and stop', async () => {
    const dcmRecv = new DCMRecv({
      aeTitle: 'test',
      maxPDU: 131072,
      outputDirectory: path.resolve(process.cwd(), 'output'),
      subdirectory: true,
      filenameExtension: '.dcm',
      port: 13104,
    })
    const main = async () => {
      await dcmRecv.listen()
      await dcmRecv.close()
    }
    await expect(main()).resolves.not.toThrow()
  })

  jest.setTimeout(10000)
  test('it should emit events while accepting a store request from DCMSend', async () => {

    const dcmRecv = new DCMRecv({
      configFile: {
        fileName: path.resolve(process.cwd(), 'src/configs/storescp.cfg'),
        profile: 'default'
      },
      aeTitle: 'test',
      maxPDU: 131072,
      outputDirectory: path.resolve(process.cwd(), 'output'),
      // subdirectory: true,
      filenameExtension: '.dcm',
      port: 13105,
      storageMode: 'preserving',
    })
    const onExit = jest.fn()
    const onAssociationTerminated = jest.fn()
    const onStarting = jest.fn()

    dcmRecv.on('starting', onStarting)
    dcmRecv.on('exit', (msg) => {
      fs.writeFileSync(path.resolve(testOutputPath, 'dcmRecvResult.json'), JSON.stringify(msg, null, 2))
      const unhandled = msg.messages.filter(ele => ele.event === 'unhandled')
      if (unhandled.length > 0) {

        const testOutputFile = path.resolve(path.resolve(process.cwd(), 'output/tests/dcmRecvUnhandledEvents.json'))
        fs.writeFileSync(testOutputFile, JSON.stringify(unhandled, null, 2))

        throw new Error(`Unhandled Events Detected!\n${JSON.stringify(unhandled, null, 2)}`)
      }
      onExit(msg)
    })
    dcmRecv.on('associationTerminated', (msg) => {
      onAssociationTerminated(msg)
      dcmRecv.close()
    })

    const main = async () => {
      await dcmRecv.listen()
      const dcmSend = new DCMSend({
        peer: '127.0.0.1', port: 13105,
        inputFiles: 'scan', recurse: true, compression: 6,
        noHalt: true, noIllegalProposal: false, noUidChecks: true, decompress: 'lossy',
        AETitle: 'dcmSend', calledAETitle: undefined,
        timeout: 15, reportFile: undefined,
      })
      const result = await dcmSend.send({dcmFileIn: path.resolve(process.cwd(), 'dicomSamples/other/0002.DCM')})

      // need to sleep to give dcmRecv.on('exit' time to fire
      await sleep(500)
    }
    await expect(main()).resolves.not.toThrow()

    expect(onStarting).toBeCalledTimes(1)
    expect(onStarting).toBeCalledTimes(1)
    expect(onExit).toBeCalledTimes(1)
    expect(onAssociationTerminated).toBeCalledTimes(1)
  })
})
