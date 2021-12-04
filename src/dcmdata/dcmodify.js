const path = require('path')
const {exec} = require('child_process')
const {DICOM_EVENTS} = require('./dicomEvents')


async function dcmodify({dcmtkPath, file, modifications, erasePrivate = false}) {
    return new Promise((resolve, reject) => {
        let events = [{event: DICOM_EVENTS.DICOM_MODIFY, message: 'dcmodify', dcmtkPath, file, modifications}]
        let modValue = modifications.reduce((a,c)=>`${a} -i "${c}"`, '')
        const dcmodifyPath = path.resolve(`${dcmtkPath.trim()}/dcmodify`)
        let command = `${dcmodifyPath} ${modValue} ${erasePrivate ? '-ep ' : ''}-nb -ie "${file}"`
        events.push({event: DICOM_EVENTS.DICOM_MODIFY, message: `dcmodify.exec(command: ${command}, ...)`})
        exec(command, (err, stdout, stderr) => err ?
            reject({event: DICOM_EVENTS.DICOM_MODIFY_FAILED.description, message: `FAILED: ${stdout}\n${stderr}`.trim(), error: err.message, stack: err.stack, events}) :
            resolve({event: DICOM_EVENTS.DICOM_MODIFY_SUCCESS.description, message: `SUCCESS: ${stdout}\n${stderr}`.trim(), events})
        )
    })
}

module.exports = dcmodify
