const findDCMTK = require('../../findDCMTK')
const echoscu = require('../../dcmnet/echoscu')


const main = async () => {
    // initialize dcmtk.js
    await findDCMTK()
    const result = await echoscu({host: '10.100.96.61', port: 30104})
    // const result = await echoscu({host: 'www.dicomserver.co.uk', port: 104})
    // const result = await echoscu({host: '184.73.255.26', port: 11112})
    console.log(result)
}

main().catch(console.error)