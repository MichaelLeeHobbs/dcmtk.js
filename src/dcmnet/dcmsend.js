const {exec} = require('child_process')

async function dcmsend({ip, port, file, timeOut = 30, aec, aet}) {
    return new Promise((resolve, reject) => {
        let command = `${process.env.DCMTK_DCMSEND} --debug --no-uid-checks -pdu 131072 --max-send-pdu 131072 -dn +fo +sd +r +rd ${aec ? `-aec ${aec}` : ''} ${aet ? `-aet ${aet}` : ''} -to ${timeOut} -nh ${ip} ${port} "${file}"`
        exec(command, (err, stdout, stderr) => (err) ?
            reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), command}) :
            resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), command}))
    })
}

module.exports = dcmsend
