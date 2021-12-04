const {spawn, exec} = require('child_process')
const fs = require('fs-extra')
const {DICOM_EVENTS} = require('./dicomEvents')
const util = require('util')
const readFile = util.promisify(fs.readFile)
const jsonRepair = require('./dcm2jsonJsonRepair')

async function dcm2json(dcmtkPath, inFile) {
    let outFile = inFile.replace(/\.dcm/i, '') + '.json'
    //outFile += '.json'
    return new Promise((resolve, reject) => {
        let command = `${dcmtkPath}/dcm2json +m -v -fc "${inFile}" "${outFile}"`
        exec(command, async (error, stdout, stderr) => {
                if (error) {
                    let msg = {event: DICOM_EVENTS.DICOM_TO_JSON_FAILED, message: `Failed to run: ${command}`, error: error.message, stack: error.stack, stdout, stderr}
                    reject(msg)
                } else {
                    let json = undefined
                    try {
                        json = (await readFile(outFile)).toString()
                    } catch (e) {
                        let msg = {event: DICOM_EVENTS.JSON_READ_FAILED, message: 'Failed to read file!', error: e.message, stack: e.stack, stdout, stderr}
                        return reject(msg)
                    }

                    let result
                    try {
                        result = jsonRepair({json})
                        json = JSON.parse(result.json)
                        let msg = {event: DICOM_EVENTS.DICOM_TO_JSON_SUCCESS, message: `DICOM JSON parsed.${result.message ? `\n${result.message}`: ''}`, stdout, stderr}
                        resolve({...msg, json})
                    } catch (e) {
                        let msg = {event: DICOM_EVENTS.JSON_PARSE_FAILED, message: 'DICOM JSON parsed failed!', error: e.message, stack: e.stack, stdout, stderr}
                        reject(msg)
                        try {
                            await fs.mkdirs('/usr/src/app/dicom/bad')
                            fs.copyFile(outFile, `/usr/src/app/dicom/bad/${outFile.split('/').pop()}`)
                            fs.writeFile(`/usr/src/app/dicom/bad/${outFile.split('/').pop()}`.replace('.json', '.repaired.json'), result.json)
                        } catch (e) {
                            // do nothing
                        }

                    }
                }
            }
        )
    })
}

module.exports = dcm2json
