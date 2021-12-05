const {exec} = require('child_process')
const fs = require('fs/promises')
const path = require('path')
const parseString = require('xml2js').parseString


async function dcm2xml({dcmfileIn, xmlfileOut, flags = [], asJson, writeJson}) {
  dcmfileIn = path.normalize(dcmfileIn)
  xmlfileOut = xmlfileOut || path.dirname(dcmfileIn)
  const inFileName = path.basename(dcmfileIn)

  const xmlPath = path.normalize(`${xmlfileOut}/${inFileName}.xml`)
  const jsonPath = path.normalize(`${xmlfileOut}/${inFileName}.json`)

  return new Promise((resolve, reject) => {
    let commandFlags = flags.join(' ')
    let command = `${process.env.DCMTK_DCM2XML} --verbose --use-xml-namespace --write-element-name ${commandFlags} "${dcmfileIn}" "${xmlPath}"`
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
