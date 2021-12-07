const findDCMTK = require('../src/findDCMTK')

describe("findDCMTK", () => {
  test('it should find DCMTK install location', async () => {
    const isWindows = process.platform === 'win32'
    const windowsExpected = {
      cda2dcm: 'C:\\ProgramData\\chocolatey\\bin\\cda2dcm.exe',
      dcm2json: 'C:\\ProgramData\\chocolatey\\bin\\dcm2json.exe',
      dcm2pdf: 'C:\\ProgramData\\chocolatey\\bin\\dcm2pdf.exe',
      dcm2xml: 'C:\\ProgramData\\chocolatey\\bin\\dcm2xml.exe',
      dcmconv: 'C:\\ProgramData\\chocolatey\\bin\\dcmconv.exe',
      dcmcrle: 'C:\\ProgramData\\chocolatey\\bin\\dcmcrle.exe',
      dcmdrle: 'C:\\ProgramData\\chocolatey\\bin\\dcmdrle.exe',
      dcmdump: 'C:\\ProgramData\\chocolatey\\bin\\dcmdump.exe',
      dcmftest: 'C:\\ProgramData\\chocolatey\\bin\\dcmftest.exe',
      dcmgpdir: 'C:\\ProgramData\\chocolatey\\bin\\dcmgpdir.exe',
      dcmodify: 'C:\\ProgramData\\chocolatey\\bin\\dcmodify.exe',
      dump2dcm: 'C:\\ProgramData\\chocolatey\\bin\\dump2dcm.exe',
      img2dcm: 'C:\\ProgramData\\chocolatey\\bin\\img2dcm.exe',
      pdf2dcm: 'C:\\ProgramData\\chocolatey\\bin\\pdf2dcm.exe',
      stl2dcm: 'C:\\ProgramData\\chocolatey\\bin\\stl2dcm.exe',
      xml2dcm: 'C:\\ProgramData\\chocolatey\\bin\\xml2dcm.exe',
      dcm2pnm: 'C:\\ProgramData\\chocolatey\\bin\\dcm2pnm.exe',
      dcmquant: 'C:\\ProgramData\\chocolatey\\bin\\dcmquant.exe',
      dcmscale: 'C:\\ProgramData\\chocolatey\\bin\\dcmscale.exe',
      dcmdspfn: 'C:\\ProgramData\\chocolatey\\bin\\dcmdspfn.exe',
      dcod2lum: 'C:\\ProgramData\\chocolatey\\bin\\dcod2lum.exe',
      dconvlum: 'C:\\ProgramData\\chocolatey\\bin\\dconvlum.exe',
      dcmcjpeg: 'C:\\ProgramData\\chocolatey\\bin\\dcmcjpeg.exe',
      dcmdjpeg: 'C:\\ProgramData\\chocolatey\\bin\\dcmdjpeg.exe',
      dcmj2pnm: 'C:\\ProgramData\\chocolatey\\bin\\dcmj2pnm.exe',
      dcmmkdir: 'C:\\ProgramData\\chocolatey\\bin\\dcmmkdir.exe',
      dcmcjpls: 'C:\\ProgramData\\chocolatey\\bin\\dcmcjpls.exe',
      dcmdjpls: 'C:\\ProgramData\\chocolatey\\bin\\dcmdjpls.exe',
      dcml2pnm: 'C:\\ProgramData\\chocolatey\\bin\\dcml2pnm.exe',
      dcmrecv: 'C:\\ProgramData\\chocolatey\\bin\\dcmrecv.exe',
      dcmsend: 'C:\\ProgramData\\chocolatey\\bin\\dcmsend.exe',
      echoscu: 'C:\\ProgramData\\chocolatey\\bin\\echoscu.exe',
      findscu: 'C:\\ProgramData\\chocolatey\\bin\\findscu.exe',
      getscu: 'C:\\ProgramData\\chocolatey\\bin\\getscu.exe',
      movescu: 'C:\\ProgramData\\chocolatey\\bin\\movescu.exe',
      storescp: 'C:\\ProgramData\\chocolatey\\bin\\storescp.exe',
      storescu: 'C:\\ProgramData\\chocolatey\\bin\\storescu.exe',
      termscu: 'C:\\ProgramData\\chocolatey\\bin\\termscu.exe',
      dcmmkcrv: 'C:\\ProgramData\\chocolatey\\bin\\dcmmkcrv.exe',
      dcmmklut: 'C:\\ProgramData\\chocolatey\\bin\\dcmmklut.exe',
      dcmp2pgm: 'C:\\ProgramData\\chocolatey\\bin\\dcmp2pgm.exe',
      dcmprscp: 'C:\\ProgramData\\chocolatey\\bin\\dcmprscp.exe',
      dcmprscu: 'C:\\ProgramData\\chocolatey\\bin\\dcmprscu.exe',
      dcmpschk: 'C:\\ProgramData\\chocolatey\\bin\\dcmpschk.exe',
      dcmpsmk: 'C:\\ProgramData\\chocolatey\\bin\\dcmpsmk.exe',
      dcmpsprt: 'C:\\ProgramData\\chocolatey\\bin\\dcmpsprt.exe',
      dcmpsrcv: 'C:\\ProgramData\\chocolatey\\bin\\dcmpsrcv.exe',
      dcmpssnd: 'C:\\ProgramData\\chocolatey\\bin\\dcmpssnd.exe',
      dcmqridx: 'C:\\ProgramData\\chocolatey\\bin\\dcmqridx.exe',
      dcmqrscp: 'C:\\ProgramData\\chocolatey\\bin\\dcmqrscp.exe',
      dcmqrti: 'C:\\ProgramData\\chocolatey\\bin\\dcmqrti.exe',
      dsr2html: 'C:\\ProgramData\\chocolatey\\bin\\dsr2html.exe',
      dsr2xml: 'C:\\ProgramData\\chocolatey\\bin\\dsr2xml.exe',
      dsrdump: 'C:\\ProgramData\\chocolatey\\bin\\dsrdump.exe',
      xml2dsr: 'C:\\ProgramData\\chocolatey\\bin\\xml2dsr.exe',
      wlmscpfs: 'C:\\ProgramData\\chocolatey\\bin\\wlmscpfs.exe'
    }
    if (isWindows) expect(findDCMTK()).toEqual(windowsExpected)
    else {
      throw new Error(`Unsupported Platform ${process.platform} for testing! FIXME!`)
    }
  })
})
