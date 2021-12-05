const findDCMTK = require('../../findDCMTK')
const dcmdump = require('../../dcmdata/dcmdump')



const main = async () => {
    // initialize dcmtk.js
    await findDCMTK()
    const result = await dcmdump({file: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002.DCM'})
    console.log(result.message)
    console.log(result.command)
}

main().catch(console.error)
