const findDCMTK = require('../../../src/findDCMTK')
const dcmsend = require('../../../src/dcmnet/dcmsend')

const main = async () => {
    // initialize dcmtk.js
    await findDCMTK()
    const result = await dcmsend({
      peer: '127.0.0.1', port: 104, dcmfileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\dicomSamples',
      noUidChecks: true, maxPdu: 131072, maxSendPdu: 131072, scanDirectories: true, recurse: true, readFromDicomdir: true,
      timeOut: 60,  noHalt: true,
      readFile: true, readFileOnly: true,// readDataset: true,
      // calledAETitle: '', callingAETitle: '',
    })
    console.log(result)

}

main().catch(console.error)
