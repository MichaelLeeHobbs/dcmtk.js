const presentationContext = function (raw) {
  const regex = new RegExp(`
D: *Context ID: *(?<contextID>.*) *\\((?<contextAccepted>.*)\\)
D: *Abstract Syntax: *=(?<abstractSyntax>.*)
D: *Proposed SCP\\/SCU Role: *(?<proposedSCPSCURole>.*)
D: *Accepted SCP\\/SCU Role: *(?<acceptedSCPSCURole>.*)
D: *Accepted Transfer Syntax: *=(?<acceptedTransferSyntax>.*)
`.trim(), 'g')

  let presentationContexts = []
  let result
  while ((result = regex.exec(raw)) !== null) {
    presentationContexts.push({
      // raw: result[0],
      ...result.groups
    })
  }
  return presentationContexts
}

module.exports = presentationContext
