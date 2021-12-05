const findDCMTK = require('../../findDCMTK')
const storescu = require('../../dcmnet/storescu')
const dcmsend = require('../../dcmnet/dcmsend')
const dcmcjpeg = require('../../dcmjpeg/dcmcjpeg')
const dcmconv = require('../../dcmdata/dcmconv')


const main = async () => {
    // initialize dcmtk.js
    await findDCMTK()
    // await dcmcjpeg({}).then(console.log).catch(console.error)
    // await dcmconv({dcmfileIn: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002new.DCM', dcmfileOut: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002new2.DCM'}).then(console.log).catch(console.error)
    // const result = await storescu({ip: '127.0.0.1', port: 104, file: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0091-21122416.dcm'})
    // const result = await storescu({ip: '127.0.0.1', port: 104, file: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002.DCM'})
    // const result = await dcmsend({ip: '127.0.0.1', port: 104, file: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002.DCM'})
    const result = await dcmsend({ip: '127.0.0.1', port: 104, file: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0091-21122416.DCM'})
    // const result = await storescu({ip: '127.0.0.1', port: 104, file: 'C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0091-21122416.dcm'})
    console.log(result.message)
    console.log(result.command)
}

main().catch(console.error)
