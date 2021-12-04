const {exec} = require('child_process')

async function storescu({ip, port, file, timeOut = 30, aec, aet}) {
    return new Promise((resolve, reject) => {
        let command = `${process.env.DCMTK_STORESCU} --debug -pdu 131072 -xf C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\configs\\storescp.cfg AllDICOM --max-send-pdu 131072 +f +sd +r ${aec ? `-aec ${aec}` : ''} ${aet ? `-aet ${aet}` : ''} -to ${timeOut} -nh ${ip} ${port} "${file}"`
        // let command = `${process.env.DCMTK_STORESCU} --debug -pdu 131072 --propose-lossless --max-send-pdu 131072 +f +sd +r ${aec ? `-aec ${aec}` : ''} ${aet ? `-aet ${aet}` : ''} -to ${timeOut} -nh ${ip} ${port} "${file}"`
        exec(command, (err, stdout, stderr) => (err) ?
            reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), command}) :
            resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), command}))
    })
}

module.exports = storescu
