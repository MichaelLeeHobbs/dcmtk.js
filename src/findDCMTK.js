const fsp = require('fs/promises')
const fs = require('fs')
const path = require('path')

const isWindows = process.platform === 'win32'


const DCMTK_KNOW_LOCATIONS = [
  '/dcmtk/usr/local/bin',
  '/usr/local/bin',
  'C:\\ProgramData\\chocolatey\\bin'
]

const DCMTK_BINARIES = [
  'cda2dcm',
  'dcm2json',
  'dcm2pdf',
  'dcm2xml',
  'dcmconv',
  'dcmcrle',
  'dcmdrle',
  'dcmdump',
  'dcmftest',
  'dcmgpdir',
  'dcmodify',
  'dump2dcm',
  'img2dcm',
  'pdf2dcm',
  'stl2dcm',
  'xml2dcm',

  'dcm2pnm',
  'dcmquant',
  'dcmscale',

  'dcmdspfn',
  'dcod2lum',
  'dconvlum',

  'dcmcjpeg',
  'dcmdjpeg',
  'dcmj2pnm',
  'dcmmkdir',

  'dcmcjpls',
  'dcmdjpls',
  'dcml2pnm',

  'dcmrecv',
  'dcmsend',
  'echoscu',
  'findscu',
  'getscu',
  'movescu',
  'storescp',
  'storescu',
  'termscu',

  'dcmmkcrv',
  'dcmmklut',
  'dcmp2pgm',
  'dcmprscp',
  'dcmprscu',
  'dcmpschk',
  'dcmpsmk',
  'dcmpsprt',
  'dcmpsrcv',
  'dcmpssnd',

  'dcmqridx',
  'dcmqrscp',
  'dcmqrti',

  'dsr2html',
  'dsr2xml',
  'dsrdump',
  'xml2dsr',

  'wlmscpfs',

  // 'dcm2json',
  // 'dcm2pdf',
  // 'dcm2pnm',
  // 'dcm2xml',
  // 'dcmcjpeg',
  // 'dcmcjpls',
  // 'dcmconv',
  // 'dcmcrle',
  // 'dcmdjpeg',
  // 'dcmdjpls',
  // 'dcmdrle',
  // 'dcmdspfn',
  // 'dcmdump',
  // 'dcmftest',
  // 'dcmgpdir',
  // 'dcmicmp',
  // 'dcmj2pnm',
  // 'dcml2pnm',
  // 'dcmmkcrv',
  // 'dcmmkdir',
  // 'dcmmklut',
  // 'dcmodify',
  // 'dcmp2pgm',
  // 'dcmprscp',
  // 'dcmprscu',
  // 'dcmpschk',
  // 'dcmpsmk',
  // 'dcmpsprt',
  // 'dcmpsrcv',
  // 'dcmpssnd',
  // 'dcmqridx',
  // 'dcmqrscp',
  // 'dcmqrti',
  // 'dcmquant',
  // 'dcmrecv',
  // 'dcmscale',
  // 'dcmsend',
  // 'dcmsign',
]

const asyncFind = async (arr, predicate) => {
  for (let e of arr) {
    if (await predicate(e)) return e
  }
}

const findDCMTKInstall = () => {
  return DCMTK_KNOW_LOCATIONS.find((installPath) => {
    let _path = path.resolve(installPath, isWindows ? `echoscu.exe` : 'echoscu')
    try {
      fs.accessSync(_path, fs.constants.X_OK)
      return true
    } catch {
      return false
    }
  })
}

const findDCMTK = () => {
  const dcmtkPath = process.env.DCMTK_PATH || findDCMTKInstall()
  if (dcmtkPath == null) throw new Error('Could not find DCMTK install!')
  const binaries = {}
  DCMTK_BINARIES.forEach((bin) => {
    binaries[bin] = path.resolve(dcmtkPath, bin + (isWindows ? `.exe` : ''))
    process.env[`DCMTK_${bin.toUpperCase()}`] = binaries[bin]
  })
  return binaries
}

module.exports = findDCMTK












































































