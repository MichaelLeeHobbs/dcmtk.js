const {exec} = require('child_process')

async function dcmconv({dcmfileIn, dcmfileOut}) {
    return new Promise((resolve, reject) => {
        let command = `${process.env.DCMTK_DCMCONV} --write-xfer-deflated --compression-level 9 ${dcmfileIn} ${dcmfileOut}`
        exec(command, (err, stdout, stderr) => (err) ?
            reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), command}) :
            resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), command}))
    })
}

module.exports = dcmconv
