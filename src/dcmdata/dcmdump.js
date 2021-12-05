const {exec} = require('child_process')

async function dcmdump({file}) {
    return new Promise((resolve, reject) => {
        let command = `${process.env.DCMTK_DCMDUMP} --load-short ${file}`
        exec(command, (err, stdout, stderr) => (err) ?
            reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), command}) :
            resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), command}))
    })
}

module.exports = dcmdump
