// https://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_6.2.html
// https://dicom.nema.org/medical/dicom/current/output/chtml/part05/sect_6.4.html
module.exports.VR_DEFINITIONS = {
  AE: {
    name: 'ApplicationEntity',
    type: 'String',
    bytes: 16,
    validator: /[\s!"#$%&'()*+,-./0-9:;<=>?@A-Z[\]^_`a-z{|}~]{0,16}/
  },
  AS: {
    name: 'AgeString',
    type: 'String',
    pad: '0',
    bytes: 4,
    validator: /[0-9DWMY]{4}/
  },
  AT: {
    name: 'AttributeTag',
    type: 'String',
    bytes: 8,
    validator: /[0-9A-F]{8}/
  },
  CS: {
    name: 'CodeString',
    type: 'String',
    bytes: 16,
    validator: /[A-Z0-9 _]{0,16}/
  },
  DA: {
    name: 'DateValue',
    type: 'Date',
    bytes: 8,
    validator: /[0-9]{8}/
  },
  DS: {
    name: 'DecimalString',
    type: 'String',
    bytes: 16,
    validator: /[0-9+\-Ee. ]{0,16}/
  },
  DT: {
    name: 'DateTime',
    type: 'DateTime',
    validator: /[0-9+\-.\s]{12,26}/,
    bytes: 26,
  },
  FL: {
    name: 'FloatingPointSingle',
    type: 'Float',
    bytes: 4,
  },
  FD: {
    name: 'FloatingPointDouble',
    type: 'Float',
    bytes: 8,
  },
  IS: {
    name: 'IntegerString',
    type: 'String',
    bytes: 12,
    validator: /[0-9+-]{0,12}/
  },
  LO: {
    name: 'LongString',
    type: 'String',
    bytes: 64,
    validator: /[s!"#$%&'()*+,-./0-9:;<=>?@A-Z[\]^_`a-z{|}~]{0,64}/
  },
  LT: {
    name: 'LongText',
    type: 'String',
    vm: 1,
    bytes: 10240,
    validator: /[s!"#$%&'()*+,-./0-9:;<=>?@A-Z[\]^_`a-z{|}~]{0,10240}/
  },
  OB: {
    name: 'OtherByte',
    type: 'Binary',
    vm: 1,
  },
  OD: {
    name: 'OtherDouble',
    type: 'Binary',
    vm: 1,
    bytes: 2 ** 32 - 8
  },
  OF: {
    name: 'OtherFloat',
    type: 'Binary',
    vm: 1,
    bytes: 2 ** 32 - 4
  },
  OL: {
    name: 'OtherLong',
    type: 'Binary',
    vm: 1,
    bytes: 4
  },
  OV: {
    name: 'OtherVeryLong',
    type: 'Binary',
    bytes: 8
  },
  OW: {
    name: 'OtherWord',
    type: 'Binary',
    vm: 1,
    bytes: 2
  },
  PN: {
    name: 'PersonName',
    type: 'Name',
    bytes: 64,
    validator: /[s!"#$%&'()*+,-./0-9:;<=>?@A-Z[\]^_`a-z{|}~]{0,64}/
  },
  SH: {
    name: 'ShortString',
    type: 'String',
    bytes: 16,
    validator: /[s!"#$%&'()*+,-./0-9:;<=>?@A-Z[\]^_`a-z{|}~]{0,16}/
  },
  SL: {
    name: 'SignedLong',
    type: 'Number',
    bytes: 4,
    min: (-2) ** 31,
    max: 2 ** 31 - 1,
  },
  SQ: {
    name: 'SequenceOfItems',
    type: 'Sequence',
    vm: 1,
  },
  SS: {
    name: 'SignedShort',
    type: 'Number',
    bytes: 2,
    min: (-2) ** 15,
    max: 2 ** 15 - 1,
  },
  ST: {
    name: 'ShortText',
    type: 'String',
    vm: 1,
    bytes: 1024,
    validator: /[s!"#$%&'()*+,-./0-9:;<=>?@A-Z[\]^_`a-z{|}~]{0,1024}/
  },
  SV: {
    name: 'SignedVeryLong',
    type: 'String',
    bytes: 8,
    min: (-2) ** 63,
    max: 2 ** 63 - 1,
  },
  TM: {
    name: 'TimeValue',
    type: 'String',
    bytes: 14,
    validator: /0-9\.\s-]{2,14}/
  },
  UC: {
    name: 'UnlimitedCharacters',
    type: 'String',
    bytes: 2 ** 32 - 2,
    validator: /[s!"#$%&'()*+,-./0-9:;<=>?@A-Z[\]^_`a-z{|}~]{0,4294967294}/
  },
  UI: {
    name: 'UniqueIdentifier',
    type: 'String',
    bytes: 64,
    validator: /0-9\.]{0,64}/
  },
  UL: {
    name: 'UnsignedLong',
    type: 'Number',
    bytes: 4,
    min: 0,
    max: 0 ** 32 - 1,
  },
  UN: {
    name: 'UnknownValue',
    type: 'Binary',
    bytes: 2 ** 16 - 2,
    vm: 1,
  },
  UR: {
    name: 'UniversalResourceIdentifierOrUniversalResourceLocator',
    type: 'String',
    vm: 1,
    bytes: 2 ** 32 - 2,
    validator: /(^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w.-]+)+[\w\-._~:/?#[\]@!$&'()*+,;=]+$)|(\w+:(\/?\/?)[^\s]+)/gm  // /(URL)|(URI/gm
  },
  US: {
    name: 'UnsignedShort',
    type: 'Number',
    bytes: 2,
    min: 0,
    max: 2 ** 16 - 1,
  },
  UT: {
    name: 'UnlimitedText',
    type: 'String',
    vm: 1,
    bytes: 2 ** 32 - 2,
    validator: /[s!"#$%&'()*+,-./0-9:;<=>?@A-Z[\\\]^_`a-z{|}~]{0,4294967294}/
  },
  UV: {
    name: 'UnsignedVeryLong',
    type: 'String',
    bytes: 8,
    min: 0,
    max: 2 ** 64 - 1,
  },
}
