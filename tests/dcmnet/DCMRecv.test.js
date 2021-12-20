const DCMRecv = require('../../src/dcmnet/DCMRecv')

describe('DCMRecv', () => {
  test('it should not throw on version', async () => {
    const dcmRecv = new DCMRecv({})
    const test = async () => {
      const version = await dcmRecv.version()
      console.log('version?\n', version)
    }
    await expect(test()).resolves.not.toThrow()

  })
})
