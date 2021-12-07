const findDCMTK = require('../../../src/findDCMTK')
const storescp = require('../../../src/dcmnet/storescp')
const dcmsend = require('../../../src/dcmnet/dcmsend')


const main = async () => {
  // initialize dcmtk.js
  await findDCMTK()
  // const result = await storescp({options: {acceptAll: true, promiscuous: true, preferLossless: true, configFile: {filename: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\configs\\storescp.cfg', profile: 'default'}}})
  // const result = await storescp({options: {acceptAll: true, promiscuous: true, preferJ2kLossless: true}})
  const storeScpInst = storescp({options: {acceptAll: true, promiscuous: true}})
  storeScpInst.start()
  // const result = await echoscu({host: 'www.dicomserver.co.uk', port: 104})
  // const result = await echoscu({host: '184.73.255.26', port: 11112})

}

main().catch(console.error)
