const findDCMTK = require('../../findDCMTK')
const storescp = require('../../dcmnet/storescp')
const dcmsend = require('../../dcmnet/dcmsend')


const main = async () => {
    // initialize dcmtk.js
    await findDCMTK()
    const result = await storescp({}, {acceptAll: true, promiscuous: true, preferLossless: true, configFile: {filename: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\configs\\storescp.cfg', profile: 'default'}})
    // const result = await echoscu({host: 'www.dicomserver.co.uk', port: 104})
    // const result = await echoscu({host: '184.73.255.26', port: 11112})
    console.log(result)
}

main().catch(console.error)