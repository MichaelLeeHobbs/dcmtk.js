const {exec} = require('child_process')

async function dcmcjpeg({}) {
    return new Promise((resolve, reject) => {
        // let command = `${process.env.DCMTK_DCMCJPEG} --true-lossless C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002.DCM C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002new.DCM`
        let command = `${process.env.DCMTK_DCMDJPEG} --write-xfer-little C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002.DCM C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0002new.DCM`
        exec(command, (err, stdout, stderr) => (err) ?
            reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), command}) :
            resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), command}))
    })
}

module.exports = dcmcjpeg
