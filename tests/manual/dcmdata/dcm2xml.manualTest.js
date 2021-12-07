const findDCMTK = require('../../../src/findDCMTK')
const dcm2xml = require('../../../src/dcmdata/dcm2xml')



const main = async () => {
    // initialize dcmtk.js
    await findDCMTK()
    const result = await dcm2xml({dcmfileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0091-21122416.dcm', asJson: true})
    console.log(result.message)
    console.log(result.command)
}

main().catch(console.error)
