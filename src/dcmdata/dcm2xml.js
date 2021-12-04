const {exec} = require('child_process')
const fs = require('fs/promises')
const path = require('path')
const parseString = require('xml2js').parseString
const DCMTK_PATH = process.env.DCMTK_PATH || '/usr/local/bin'
const os = require('os');
const isWindows = os.platform() === 'win32';

async function dcm2xml({srcPath, dstPath, flags = [], asJson, writeJson}) {
  srcPath = path.normalize(srcPath)
  dstPath = dstPath || path.dirname(srcPath)
  const inFileName = path.basename(srcPath)
  console.log('inFileName', inFileName)
  const xmlPath = path.normalize(`${dstPath}/${inFileName}.xml`)
  const jsonPath = path.normalize(`${dstPath}/${inFileName}.json`)

  return new Promise((resolve, reject) => {
    let commandFlags = flags.join(' ')
    const binPath = path.normalize(`${DCMTK_PATH}/dcm2xml${isWindows ? '.exe': ''}`)
    // let command = `${DCMTK_PATH}/dcm2xml --verbose ${commandFlags} "${srcPath}" "${xmlPath}"`
    let command = `${binPath} --verbose ${commandFlags} "${srcPath}" "${xmlPath}"`
    exec(command, async (error, stdout, stderr) => {
        if (error) {
          console.error(error)
          return reject({message: `FAILED: ${stdout}\n${stderr}`.trim(), error})
        }
        const xmlStr = await fs.readFile(xmlPath, 'utf-8')
        if (asJson) {
          parseString(xmlStr, async function (err, data) {
            if (err) return reject({message: `FAILED: xml2json`, error: err.message, stack: err.stack})
            if (writeJson) await fs.writeFile(jsonPath, JSON.stringify(data))
            resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), xmlPath, jsonPath, json: data, xml: xmlStr})
          })
        } else {
          resolve({message: `SUCCESS: ${stdout}\n${stderr}`.trim(), xmlPath, xml: xmlStr})
        }
      }
    )
  })
}

module.exports = dcm2xml
