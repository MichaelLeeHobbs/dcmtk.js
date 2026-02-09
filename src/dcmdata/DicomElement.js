class DicomAttribute {
  #vr
  #Value
  #InlineBinary
  #BulkDataURI
  #group
  #element
  #len
  #name
  #vm
  constructor({vr, Value, InlineBinary, BulkDataURI, group, element, len, name, vm}) {
    this.#vr = vr
    this.#Value = Value
    this.#InlineBinary = InlineBinary
    this.#BulkDataURI = BulkDataURI
    this.#group = group
    this.#element = element
    this.#len = len
    this.#name = name
    this.#vm = vm
  }

  isBinary() {
    return ['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'UN',].includes(this.#vr)
  }

  isName() {
    return ['PN'].includes(this.#vr)
  }

  get vm() {
    return this.isBinary ? 1 : this.#Value.length
  }

  getValue(index) {
    return this.isBinary ? this.#InlineBinary : (index ? this.#Value[index] : this.#Value)
  }
}

module.exports = DicomAttribute
