const DCMTKEvent = require('../../parsers/DCMTKEvent')

const headerPattern = '^D: adding DICOM file \'(?<file>[^]*?)\''
const footerPatternSuccess = 'D: successfully added SOP instance (?<sopInstanceID>[^]*?) to the transfer list'
const footerPatternError = 'E: cannot add DICOM file to the transfer list: (?<failedFile>[^]*?): (?<failedFileReason>[^]*?)'

const header = new RegExp(headerPattern)
const footer = new RegExp(`(?:${footerPatternSuccess})|(?:${footerPatternError})`)
const body = new RegExp(`${headerPattern}(?<body>[^]*?)(?:${footerPatternSuccess})|(?:${footerPatternError})`)

const processor = function (matches) {
  const {file, sopInstanceID, failedFile, failedFileReason} = matches.groups
  const result = {file}
  if (sopInstanceID) {
    result.sopInstanceID = sopInstanceID
  }
  if (failedFile) {
    result.failedFile = failedFile
  }
  if (failedFileReason) {
    result.failedFileReason = failedFileReason
  }
  return result
}

const addingDICOMFile = new DCMTKEvent({
  event: 'addingDICOMFile',
  header,
  footer,
  body,
  maxLines: 7,
  multiLine: true,
  processor,
})

module.exports = addingDICOMFile
