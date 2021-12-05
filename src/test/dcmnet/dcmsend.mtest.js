const findDCMTK = require('../../findDCMTK')
const dcmsend = require('../../dcmnet/dcmsend')

const main = async () => {
    // initialize dcmtk.js
    await findDCMTK()
    const result = await dcmsend({
      peer: '127.0.0.1', port: 104, dcmfileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\dcm',
      noUidChecks: true, maxPdu: 131072, maxSendPdu: 131072, scanDirectories: true, recurse: true, readFromDicomdir: true,
      timeOut: 60,  noHalt: true,
      // calledAETitle: '', callingAETitle: '',
    })
    console.log(result)

}

main().catch(console.error)
