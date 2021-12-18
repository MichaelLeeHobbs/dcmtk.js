const headerPattern = "^D: adding DICOM file '(?<file>[^]*?)'"
const footerPatternSuccess = 'D: successfully added SOP instance (?<sopInstanceID>[^]*?) to the transfer list'
const footerPatternError = 'E: cannot add DICOM file to the transfer list: (?<failedFile>[^]*?): (?<failedFileReason>[^]*?)'

const header = new RegExp(headerPattern)
const footer = new RegExp(`(?:${footerPatternSuccess})|(?:${footerPatternError})`)

const addingDICOMFile = function (raw) {
  const allRegexSuccess = new RegExp(`${headerPattern}(?<body>[^]*?)${footerPatternSuccess}`)
  const allRegexError = new RegExp(`${headerPattern}(?<body>[^]*?)${footerPatternError}`)

  if (allRegexSuccess.test(raw)) {
    const matches = allRegexSuccess.exec(raw)
    const {file, sopInstanceID} = matches.groups
    return {dt: new Date(), file, sopInstanceID, /* raw: matches[0]*/}
  } else if (allRegexError.test(raw)) {
    const matches = allRegexError.exec(raw)
    const {file, failedFile, failedFileReason} = matches.groups
    return {dt: new Date(), file, failedFile, failedFileReason, /* raw: matches[0]*/}
  }
}
module.exports = {
  parse: addingDICOMFile,
  header,
  footer
}
