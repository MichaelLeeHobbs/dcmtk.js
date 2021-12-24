## Classes

<dl>
<dt><a href="#DCMProcess">DCMProcess</a> : <code><a href="#DCMProcess">DCMProcess</a></code></dt>
<dd><p>DCM Process</p>
</dd>
<dt><a href="#DCM2XML">DCM2XML</a></dt>
<dd><p>The dcm2xml utility converts the contents of a DICOM file (file format or raw data set) to XML (Extensible Markup Language). There are two
outputformats. The first one is specific to DCMTK with its DTD (Document Type Definition) described in the file dcm2xml.dtd. The second one refers to the
&quot;Native DICOM Model&quot; which is specified for the DICOM Application Hosting service found in DICOM part 19.</p>
<p>If dcm2xml reads a raw data set (DICOM data without a file format meta-header) it will attempt to guess the transfer syntax by examining the first few
bytes of the file. It is not always possible to correctly guess the transfer syntax and it is better to convert a data set to a file format whenever
possible (using the dcmconv utility). It is also possible to use the -f and -t[ieb] options to force dcm2xml to read a data set with a particular
transfer syntax.</p>
</dd>
<dt><a href="#DCMRecv">DCMRecv</a></dt>
<dd><p>Class representing a DCM Receiver</p>
</dd>
<dt><a href="#DCMRecv">DCMRecv</a> : <code><a href="#DCMRecv">DCMRecv</a></code></dt>
<dd><p>DCM Receiver</p>
</dd>
<dt><a href="#DCMSend">DCMSend</a></dt>
<dd><p>Class representing a DCM Sender</p>
</dd>
<dt><a href="#DCMSend">DCMSend</a> : <code><a href="#DCMRecv">DCMRecv</a></code></dt>
<dd><p>DCM Receiver</p>
</dd>
<dt><a href="#StoreSCP">StoreSCP</a> : <code><a href="#DCMRecv">DCMRecv</a></code></dt>
<dd><p>DCM Receiver</p>
</dd>
<dt><a href="#StoreSCU">StoreSCU</a> : <code><a href="#DCMRecv">DCMRecv</a></code></dt>
<dd><p>DCM Receiver</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#findIndexFromStart">findIndexFromStart(arr, start, callbackFn)</a> ⇒ <code>number</code></dt>
<dd><p>Same as Array.findIndex but requires a start index</p>
</dd>
</dl>

<a name="DCMProcess"></a>

## DCMProcess : [<code>DCMProcess</code>](#DCMProcess)

DCM Process

**Kind**: global class
<a name="DCMProcess+execute"></a>

### dcmProcess.execute(command, [parser]) ⇒ <code>Promise.&lt;string&gt;</code>

**Kind**: instance method of [<code>DCMProcess</code>](#DCMProcess)

| Param | Type |
| --- | --- |
| command |  |
| [parser] | <code>function</code> |

<a name="DCM2XML"></a>

## DCM2XML

The dcm2xml utility converts the contents of a DICOM file (file format or raw data set) to XML (Extensible Markup Language). There are two outputformats. The
first one is specific to DCMTK with its DTD (Document Type Definition) described in the file dcm2xml.dtd. The second one refers to the
"Native DICOM Model" which is specified for the DICOM Application Hosting service found in DICOM part 19.

If dcm2xml reads a raw data set (DICOM data without a file format meta-header) it will attempt to guess the transfer syntax by examining the first few bytes of
the file. It is not always possible to correctly guess the transfer syntax and it is better to convert a data set to a file format whenever possible (using the
dcmconv utility). It is also possible to use the -f and -t[ieb] options to force dcm2xml to read a data set with a particular transfer syntax.

**Kind**: global class
<a name="new_DCM2XML_new"></a>

### new DCM2XML([inputFileFormat], [inputTransferSyntax], [longTagValues], [charset], [XMLFormat], [useXMLNamespace], XMLOptions, [binaryEncoding])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [inputFileFormat] | <code>&#x27;file&#x27;</code> \| <code>&#x27;file-only&#x27;</code> \| <code>&#x27;dataset&#x27;</code> | <code>file</code> | file; read file format or data set, file-only; read file format only, dataset; read data set without file meta information |
| [inputTransferSyntax] | <code>&#x27;auto&#x27;</code> \| <code>&#x27;detect&#x27;</code> \| <code>&#x27;little&#x27;</code> \| <code>&#x27;big&#x27;</code> \| <code>&#x27;implicit&#x27;</code> | <code>auto</code> | auto; use TS recognition detect; ignore TS specified in the file meta header little; read with explicit VR little endian TS big; read with explicit VR big endian TS implicit; read with implicit VR little endian TS |
| [longTagValues] | <code>Object</code> | <code>{load: &#x27;short&#x27;, maxReadLength: 4}</code> |  |
| [longTagValues.load] | <code>&#x27;all&#x27;</code> \| <code>&#x27;short&#x27;</code> | <code>short</code> | all; load very long tag values (e.g. pixel data), short; do not load very long values (default) |
| [longTagValues.maxReadLength] | <code>number</code> | <code>4</code> | integer (4..4194302, default: 4) set threshold for long values to k kbytes |
| [charset] | <code>Object</code> | <code>{option: &#x27;require&#x27;, maxReadLength: 4}</code> | processing options - specific character set |
| [charset.option] | <code>&#x27;require&#x27;</code> \| <code>&#x27;check-all&#x27;</code> \| <code>&#x27;assume&#x27;</code> | <code>require</code> | require; require declaration of extended charset, check-all; check all data elements with string values (default: only PN, LO, LT, SH, ST, UC and UT), assume; assume charset charset.assumeCharset if no extended charset declared |
| [charset.assumeCharset=] | <code>string</code> |  | charset to assume if charset.option=assume |
| [XMLFormat] | <code>&#x27;dcmtk&#x27;</code> \| <code>&#x27;native&#x27;</code> | <code>dcmtk</code> | dcmtk; output in DCMTK-specific format, native; output in Native DICOM Model format (part 19) |
| [useXMLNamespace] | <code>boolean</code> | <code>false</code> | add XML namespace declaration to root element |
| XMLOptions | <code>Object</code> |  | DCMTK-specific format (not with XMLFormat=native) |
| [XMLOptions.addDTDReference] | <code>boolean</code> | <code>false</code> |  |
| [XMLOptions.embedDTDReference] | <code>boolean</code> | <code>false</code> |  |
| [XMLOptions.useDTDFile] | <code>string</code> | <code>&quot;/usr/local/share/dcmtk/dcm2xml.dtd&quot;</code> |  |
| [XMLOptions.writeElementName] | <code>boolean</code> | <code>true</code> |  |
| [XMLOptions.writeBinaryData] | <code>boolean</code> | <code>false</code> | write binary data of OB and OW elements (default: off, be careful with longTagValues.load=all) |
| [binaryEncoding] | <code>&#x27;hex&#x27;</code> \| <code>&#x27;uuid&#x27;</code> \| <code>&#x27;base64&#x27;</code> | <code>(&#x27;hex&#x27;|&#x27;uuid&#x27;)</code> | hex; encode binary data as hex numbers (default for DCMTK-specific format), uuid; encode binary data as a UUID reference (default for Native DICOM Model), base64; encode binary data as Base64 (RFC 2045, MIME) |

<a name="DCMRecv"></a>

## DCMRecv

Class representing a DCM Receiver

**Kind**: global class

* [DCMRecv](#DCMRecv)
  * [new DCMRecv([port], configFile, [AETitle], useCalledAETitle, [acseTimeout], dimseTimeout, [maxPDU], [disableHostnameLookup], tls, outputDirectory, subdirectory, filenameGeneration, filenameExtension, storageMode)](#new_DCMRecv_new)
  * [.listen([port&#x3D;])](#DCMRecv+listen) ⇒ <code>Promise</code> \| <code>Promise.&lt;unknown&gt;</code>
  * [.close()](#DCMRecv+close) ⇒ <code>Promise.&lt;unknown&gt;</code>

<a name="new_DCMRecv_new"></a>

### new DCMRecv([port], configFile, [AETitle], useCalledAETitle, [acseTimeout], dimseTimeout, [maxPDU], [disableHostnameLookup], tls, outputDirectory, subdirectory, filenameGeneration, filenameExtension, storageMode)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [port] | <code>number</code> | <code>104</code> | port number to listen on |
| configFile | <code>Object</code> |  |  |
| configFile.filename | <code>string</code> |  | path to config file |
| configFile.profile | <code>string</code> |  | profile to use |
| [AETitle] | <code>string</code> | <code>&quot;&#x27;DCMRECV&#x27;&quot;</code> | set my AE title |
| useCalledAETitle | <code>boolean</code> |  | always respond with called AE title |
| [acseTimeout] | <code>number</code> | <code>30</code> | seconds timeout for ACSE messages |
| dimseTimeout | <code>number</code> |  | seconds timeout for DIMSE messages (default: unlimited) |
| [maxPDU] | <code>number</code> | <code>16384</code> | set max receive pdu to number of bytes: integer (4096..131072) |
| [disableHostnameLookup] | <code>boolean</code> | <code>false</code> | disable hostname lookup |
| tls | <code>Object</code> |  |  |
| [tls.enable] | <code>boolean</code> | <code>false</code> |  |
| [tls.passwd] | <code>null</code> \| <code>string</code> | <code></code> |  |
| [tls.format] | <code>&#x27;pem&#x27;</code> \| <code>&#x27;der&#x27;</code> | <code>&#x27;pem&#x27;</code> |  |
| tls.ca | <code>Object</code> |  |  |
| tls.ca.file | <code>string</code> |  | path to certificate file to add to list of certificates |
| tls.ca.directory | <code>string</code> |  | path to directory of certificates to add to list of certificates |
| [tls.profile] | <code>&#x27;bcp195&#x27;</code> \| <code>&#x27;bcp195-nd&#x27;</code> \| <code>&#x27;bcp195-ex&#x27;</code> \| <code>&#x27;basic&#x27;</code> \| <code>&#x27;aes&#x27;</code> \| <code>null</code> | <code>&#x27;bcp195&#x27;</code> | security profile - BCP 195 TLS Profile (default), Non-downgrading BCP 195 TLS Profile, Extended BCP 195 TLS Profile, Basic TLS Secure Transport Connection Profile (retired), AES TLS Secure Transport Connection Profile (retired), Authenticated unencrypted communication (retired, was used in IHE ATNA) |
| tls.cipherSuite | <code>Object</code> |  |  |
| tls.cipherSuite.name | <code>string</code> |  |  |
| tls.cipherSuite.dhparam | <code>string</code> |  | path to file to read DH parameters for DH/DSS ciphersuites |
| outputDirectory | <code>string</code> |  |  |
| subdirectory | <code>string</code> |  |  |
| filenameGeneration | <code>&#x27;default&#x27;</code> \| <code>&#x27;unique&#x27;</code> \| <code>&#x27;short&#x27;</code> \| <code>&#x27;system&#x27;</code> |  |  |
| filenameExtension | <code>string</code> |  |  |
| storageMode | <code>&#x27;normal&#x27;</code> \| <code>&#x27;preserving&#x27;</code> \| <code>&#x27;ignore&#x27;</code> |  |  |

<a name="DCMRecv+listen"></a>

### dcmRecv.listen([port&#x3D;]) ⇒ <code>Promise</code> \| <code>Promise.&lt;unknown&gt;</code>

Starts listening on port

**Kind**: instance method of [<code>DCMRecv</code>](#DCMRecv)
**Emits**: [<code>starting</code>](#StoreSCP+event_starting)

| Param | Type | Description |
| --- | --- | --- |
| [port=] | <code>Number</code> | defaults to StoreSCP.port or 104 |

<a name="DCMRecv+close"></a>

### dcmRecv.close() ⇒ <code>Promise.&lt;unknown&gt;</code>

Stop listening

**Kind**: instance method of [<code>DCMRecv</code>](#DCMRecv)
<a name="DCMRecv"></a>

## DCMRecv : [<code>DCMRecv</code>](#DCMRecv)

DCM Receiver

**Kind**: global class

* [DCMRecv](#DCMRecv) : [<code>DCMRecv</code>](#DCMRecv)
  * [new DCMRecv([port], configFile, [AETitle], useCalledAETitle, [acseTimeout], dimseTimeout, [maxPDU], [disableHostnameLookup], tls, outputDirectory, subdirectory, filenameGeneration, filenameExtension, storageMode)](#new_DCMRecv_new)
  * [.listen([port&#x3D;])](#DCMRecv+listen) ⇒ <code>Promise</code> \| <code>Promise.&lt;unknown&gt;</code>
  * [.close()](#DCMRecv+close) ⇒ <code>Promise.&lt;unknown&gt;</code>

<a name="new_DCMRecv_new"></a>

### new DCMRecv([port], configFile, [AETitle], useCalledAETitle, [acseTimeout], dimseTimeout, [maxPDU], [disableHostnameLookup], tls, outputDirectory, subdirectory, filenameGeneration, filenameExtension, storageMode)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [port] | <code>number</code> | <code>104</code> | port number to listen on |
| configFile | <code>Object</code> |  |  |
| configFile.filename | <code>string</code> |  | path to config file |
| configFile.profile | <code>string</code> |  | profile to use |
| [AETitle] | <code>string</code> | <code>&quot;&#x27;DCMRECV&#x27;&quot;</code> | set my AE title |
| useCalledAETitle | <code>boolean</code> |  | always respond with called AE title |
| [acseTimeout] | <code>number</code> | <code>30</code> | seconds timeout for ACSE messages |
| dimseTimeout | <code>number</code> |  | seconds timeout for DIMSE messages (default: unlimited) |
| [maxPDU] | <code>number</code> | <code>16384</code> | set max receive pdu to number of bytes: integer (4096..131072) |
| [disableHostnameLookup] | <code>boolean</code> | <code>false</code> | disable hostname lookup |
| tls | <code>Object</code> |  |  |
| [tls.enable] | <code>boolean</code> | <code>false</code> |  |
| [tls.passwd] | <code>null</code> \| <code>string</code> | <code></code> |  |
| [tls.format] | <code>&#x27;pem&#x27;</code> \| <code>&#x27;der&#x27;</code> | <code>&#x27;pem&#x27;</code> |  |
| tls.ca | <code>Object</code> |  |  |
| tls.ca.file | <code>string</code> |  | path to certificate file to add to list of certificates |
| tls.ca.directory | <code>string</code> |  | path to directory of certificates to add to list of certificates |
| [tls.profile] | <code>&#x27;bcp195&#x27;</code> \| <code>&#x27;bcp195-nd&#x27;</code> \| <code>&#x27;bcp195-ex&#x27;</code> \| <code>&#x27;basic&#x27;</code> \| <code>&#x27;aes&#x27;</code> \| <code>null</code> | <code>&#x27;bcp195&#x27;</code> | security profile - BCP 195 TLS Profile (default), Non-downgrading BCP 195 TLS Profile, Extended BCP 195 TLS Profile, Basic TLS Secure Transport Connection Profile (retired), AES TLS Secure Transport Connection Profile (retired), Authenticated unencrypted communication (retired, was used in IHE ATNA) |
| tls.cipherSuite | <code>Object</code> |  |  |
| tls.cipherSuite.name | <code>string</code> |  |  |
| tls.cipherSuite.dhparam | <code>string</code> |  | path to file to read DH parameters for DH/DSS ciphersuites |
| outputDirectory | <code>string</code> |  |  |
| subdirectory | <code>string</code> |  |  |
| filenameGeneration | <code>&#x27;default&#x27;</code> \| <code>&#x27;unique&#x27;</code> \| <code>&#x27;short&#x27;</code> \| <code>&#x27;system&#x27;</code> |  |  |
| filenameExtension | <code>string</code> |  |  |
| storageMode | <code>&#x27;normal&#x27;</code> \| <code>&#x27;preserving&#x27;</code> \| <code>&#x27;ignore&#x27;</code> |  |  |

<a name="DCMRecv+listen"></a>

### dcmRecv.listen([port&#x3D;]) ⇒ <code>Promise</code> \| <code>Promise.&lt;unknown&gt;</code>

Starts listening on port

**Kind**: instance method of [<code>DCMRecv</code>](#DCMRecv)
**Emits**: [<code>starting</code>](#StoreSCP+event_starting)

| Param | Type | Description |
| --- | --- | --- |
| [port=] | <code>Number</code> | defaults to StoreSCP.port or 104 |

<a name="DCMRecv+close"></a>

### dcmRecv.close() ⇒ <code>Promise.&lt;unknown&gt;</code>

Stop listening

**Kind**: instance method of [<code>DCMRecv</code>](#DCMRecv)
<a name="DCMSend"></a>

## DCMSend

Class representing a DCM Sender

**Kind**: global class

* [DCMSend](#DCMSend)
  * [new DCMSend(peer, [port], inputFileFormat, inputFiles, scanPattern, [recurse], decompress, compression, [noHalt], [noIllegalProposal], [noUidChecks], [AETitle], [calledAETitle], [association], timeout, [acseTimeout], dimseTimeout, [maxPDU], [maxSendPDU], reportFile)](#new_DCMSend_new)
  * [.send([peer&#x3D;], [port&#x3D;], dcmFileIn, [AETitle], [calledAETitle])](#DCMSend+send)

<a name="new_DCMSend_new"></a>

### new DCMSend(peer, [port], inputFileFormat, inputFiles, scanPattern, [recurse], decompress, compression, [noHalt], [noIllegalProposal], [noUidChecks], [AETitle], [calledAETitle], [association], timeout, [acseTimeout], dimseTimeout, [maxPDU], [maxSendPDU], reportFile)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| peer | <code>string</code> |  | ip or hostname of DICOM peer |
| [port] | <code>number</code> | <code>104</code> | port number to listen on |
| inputFileFormat | <code>&#x27;formatOrData&#x27;</code> \| <code>&#x27;format&#x27;</code> \| <code>&#x27;data&#x27;</code> |  | formatOrData; read file format or data set, format; read file format only (default), data; read data set without file meta information |
| inputFiles | <code>&#x27;dicomdir&#x27;</code> \| <code>&#x27;scan&#x27;</code> |  |  |
| scanPattern | <code>string</code> |  | pattern for filename matching (wildcards) only with inputFiles = scan |
| [recurse] | <code>boolean</code> | <code>false</code> | recurse within specified directories |
| decompress | <code>&#x27;never&#x27;</code> \| <code>&#x27;lossless&#x27;</code> \| <code>&#x27;lossy&#x27;</code> |  | never; never decompress compressed data sets, lossless; only decompress lossless compression (default), lossy; decompress both lossy and lossless compression |
| compression | <code>number</code> |  | 0=uncompressed, 1=fastest, 9=best compression |
| [noHalt] | <code>boolean</code> | <code>false</code> | do not halt on first invalid input file or if unsuccessful store encountered |
| [noIllegalProposal] | <code>boolean</code> | <code>false</code> | do not propose any presentation context that does not contain the default transfer syntax (if needed) |
| [noUidChecks] | <code>boolean</code> | <code>false</code> | do not check UID values of input files |
| [AETitle] | <code>string</code> | <code>&quot;&#x27;DCMSEND&#x27;&quot;</code> | set my AE title |
| [calledAETitle] | <code>string</code> | <code>&quot;&#x27;ANY-SCP&#x27;&quot;</code> | set called AE title of peer (default: ANY-SCP) |
| [association] | <code>&#x27;multi&#x27;</code> \| <code>&#x27;single&#x27;</code> | <code>&#x27;multi&#x27;</code> | multi; use multiple associations (one after the other) if needed to transfer the instances (default), single; always use a single association |
| timeout | <code>number</code> |  | timeout for connection requests (default: unlimited) |
| [acseTimeout] | <code>number</code> | <code>30</code> | seconds timeout for ACSE messages |
| dimseTimeout | <code>number</code> |  | seconds timeout for DIMSE messages (default: unlimited) |
| [maxPDU] | <code>number</code> | <code>131072</code> | set max receive pdu to number of bytes (4096..131072) |
| [maxSendPDU] | <code>number</code> | <code>131072</code> | restrict max send pdu to n bytes (4096..131072) |
| reportFile | <code>string</code> |  | create a detailed report on the transfer (if successful) and write it to text file reportFile |

<a name="DCMSend+send"></a>

### dcmSend.send([peer&#x3D;], [port&#x3D;], dcmFileIn, [AETitle], [calledAETitle])

Send dicom

**Kind**: instance method of [<code>DCMSend</code>](#DCMSend)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [peer=] | <code>string</code> |  | ip or hostname of DICOM peer |
| [port=] | <code>number</code> |  | port number to listen on |
| dcmFileIn | <code>string</code> |  | DICOM file or directory to be transmitted |
| [AETitle] | <code>string</code> | <code>&quot;&#x27;DCMSEND&#x27;&quot;</code> | my AE title |
| [calledAETitle] | <code>string</code> | <code>&quot;&#x27;ANY-SCP&#x27;&quot;</code> | called AE title of peer (default: ANY-SCP) |

<a name="DCMSend"></a>

## DCMSend : [<code>DCMRecv</code>](#DCMRecv)

DCM Receiver

**Kind**: global class

* [DCMSend](#DCMSend) : [<code>DCMRecv</code>](#DCMRecv)
  * [new DCMSend(peer, [port], inputFileFormat, inputFiles, scanPattern, [recurse], decompress, compression, [noHalt], [noIllegalProposal], [noUidChecks], [AETitle], [calledAETitle], [association], timeout, [acseTimeout], dimseTimeout, [maxPDU], [maxSendPDU], reportFile)](#new_DCMSend_new)
  * [.send([peer&#x3D;], [port&#x3D;], dcmFileIn, [AETitle], [calledAETitle])](#DCMSend+send)

<a name="new_DCMSend_new"></a>

### new DCMSend(peer, [port], inputFileFormat, inputFiles, scanPattern, [recurse], decompress, compression, [noHalt], [noIllegalProposal], [noUidChecks], [AETitle], [calledAETitle], [association], timeout, [acseTimeout], dimseTimeout, [maxPDU], [maxSendPDU], reportFile)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| peer | <code>string</code> |  | ip or hostname of DICOM peer |
| [port] | <code>number</code> | <code>104</code> | port number to listen on |
| inputFileFormat | <code>&#x27;formatOrData&#x27;</code> \| <code>&#x27;format&#x27;</code> \| <code>&#x27;data&#x27;</code> |  | formatOrData; read file format or data set, format; read file format only (default), data; read data set without file meta information |
| inputFiles | <code>&#x27;dicomdir&#x27;</code> \| <code>&#x27;scan&#x27;</code> |  |  |
| scanPattern | <code>string</code> |  | pattern for filename matching (wildcards) only with inputFiles = scan |
| [recurse] | <code>boolean</code> | <code>false</code> | recurse within specified directories |
| decompress | <code>&#x27;never&#x27;</code> \| <code>&#x27;lossless&#x27;</code> \| <code>&#x27;lossy&#x27;</code> |  | never; never decompress compressed data sets, lossless; only decompress lossless compression (default), lossy; decompress both lossy and lossless compression |
| compression | <code>number</code> |  | 0=uncompressed, 1=fastest, 9=best compression |
| [noHalt] | <code>boolean</code> | <code>false</code> | do not halt on first invalid input file or if unsuccessful store encountered |
| [noIllegalProposal] | <code>boolean</code> | <code>false</code> | do not propose any presentation context that does not contain the default transfer syntax (if needed) |
| [noUidChecks] | <code>boolean</code> | <code>false</code> | do not check UID values of input files |
| [AETitle] | <code>string</code> | <code>&quot;&#x27;DCMSEND&#x27;&quot;</code> | set my AE title |
| [calledAETitle] | <code>string</code> | <code>&quot;&#x27;ANY-SCP&#x27;&quot;</code> | set called AE title of peer (default: ANY-SCP) |
| [association] | <code>&#x27;multi&#x27;</code> \| <code>&#x27;single&#x27;</code> | <code>&#x27;multi&#x27;</code> | multi; use multiple associations (one after the other) if needed to transfer the instances (default), single; always use a single association |
| timeout | <code>number</code> |  | timeout for connection requests (default: unlimited) |
| [acseTimeout] | <code>number</code> | <code>30</code> | seconds timeout for ACSE messages |
| dimseTimeout | <code>number</code> |  | seconds timeout for DIMSE messages (default: unlimited) |
| [maxPDU] | <code>number</code> | <code>131072</code> | set max receive pdu to number of bytes (4096..131072) |
| [maxSendPDU] | <code>number</code> | <code>131072</code> | restrict max send pdu to n bytes (4096..131072) |
| reportFile | <code>string</code> |  | create a detailed report on the transfer (if successful) and write it to text file reportFile |

<a name="DCMSend+send"></a>

### dcmSend.send([peer&#x3D;], [port&#x3D;], dcmFileIn, [AETitle], [calledAETitle])

Send dicom

**Kind**: instance method of [<code>DCMSend</code>](#DCMSend)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [peer=] | <code>string</code> |  | ip or hostname of DICOM peer |
| [port=] | <code>number</code> |  | port number to listen on |
| dcmFileIn | <code>string</code> |  | DICOM file or directory to be transmitted |
| [AETitle] | <code>string</code> | <code>&quot;&#x27;DCMSEND&#x27;&quot;</code> | my AE title |
| [calledAETitle] | <code>string</code> | <code>&quot;&#x27;ANY-SCP&#x27;&quot;</code> | called AE title of peer (default: ANY-SCP) |

<a name="StoreSCP"></a>

## StoreSCP : [<code>DCMRecv</code>](#DCMRecv)

DCM Receiver

**Kind**: global class

* [StoreSCP](#StoreSCP) : [<code>DCMRecv</code>](#DCMRecv)
  * [new StoreSCP(port, [associationNegotiation], preferredTransferSyntaxes, [socketTimeout], [acseTimeout], [dimseTimeout], [aeTitle], [maxPDU], [disableHostLookup], [refuseAssociation], [rejectAssociation], [ignoreStoreData], [sleepAfter], [sleepDuring], [abortAfter], [abortDuring], [promiscuous], [uidPadding], outputDirectory, [sort&#x3D;], [bitPreserving], [outputFileFormat], outputTransferSyntax, [disableNewVR], [groupLengthEncoding], [lengthEncoding], [padding], [handlingOfDefinedLengthUNElements], [compressionLevel], [filenameGeneration], filenameExtension)](#new_StoreSCP_new)
  * [.listen([port&#x3D;])](#StoreSCP+listen) ⇒ <code>Promise</code> \| <code>Promise.&lt;unknown&gt;</code>
  * [.close()](#StoreSCP+close) ⇒ <code>Promise.&lt;unknown&gt;</code>
  * ["starting"](#StoreSCP+event_starting)

<a name="new_StoreSCP_new"></a>

### new StoreSCP(port, [associationNegotiation], preferredTransferSyntaxes, [socketTimeout], [acseTimeout], [dimseTimeout], [aeTitle], [maxPDU], [disableHostLookup], [refuseAssociation], [rejectAssociation], [ignoreStoreData], [sleepAfter], [sleepDuring], [abortAfter], [abortDuring], [promiscuous], [uidPadding], outputDirectory, [sort&#x3D;], [bitPreserving], [outputFileFormat], outputTransferSyntax, [disableNewVR], [groupLengthEncoding], [lengthEncoding], [padding], [handlingOfDefinedLengthUNElements], [compressionLevel], [filenameGeneration], filenameExtension)
StoreSCP


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| port | <code>number</code> |  | port to listen on |
| [associationNegotiation] | <code>Object</code> |  | association negotiation profile from configuration file |
| associationNegotiation.filename | <code>string</code> |  | config file |
| associationNegotiation.profile | <code>string</code> |  | profile |
| preferredTransferSyntaxes | <code>Array.&lt;string&gt;</code> |  | referred network transfer syntaxes - possiable values: ('uncompressed'|'little-endian'|'big-endian'|'lossless'|'jpeg8'|'jpeg12'|'j2k-lossless'|'j2k-lossy'|'jls-lossless'|'mpeg2'|'mpeg2-high'|'mpeg4'|'mpeg4-bd'|'mpeg4-2-2d'|'mpeg4-2-3d'|'mpeg4-2-st'|'hevc'|'hevc10'|'rle'|'deflated'|'implicit'|'all') |
| [socketTimeout] | <code>number</code> | <code>60</code> | timeout for network socket (0 for none) |
| [acseTimeout] | <code>number</code> | <code>30</code> | timeout for ACSE messages |
| [dimseTimeout] | <code>number</code> |  | timeout for DIMSE messages |
| [aeTitle] | <code>string</code> | <code>&quot;&#x27;STORESCP&#x27;&quot;</code> | set my AE title |
| [maxPDU] | <code>number</code> | <code>16384</code> | set max receive pdu to number of bytes (4096..131072) |
| [disableHostLookup] | <code>boolean</code> | <code>false</code> | disable hostname lookup |
| [refuseAssociation] | <code>boolean</code> | <code>false</code> | refuse association |
| [rejectAssociation] | <code>boolean</code> | <code>false</code> | reject association if no implementation class UID |
| [ignoreStoreData] | <code>boolean</code> | <code>false</code> | ignore store data, receive but do not store |
| [sleepAfter] | <code>number</code> | <code>0</code> | sleep s seconds after store |
| [sleepDuring] | <code>number</code> | <code>0</code> | sleep s seconds during store |
| [abortAfter] | <code>boolean</code> | <code>false</code> | abort association after receipt of C-STORE-RQ |
| [abortDuring] | <code>boolean</code> | <code>false</code> | abort association during receipt of C-STORE-RQ |
| [promiscuous] | <code>boolean</code> | <code>false</code> | promiscuous mode, accept unknown SOP classes |
| [uidPadding] | <code>boolean</code> | <code>false</code> | silently correct space-padded UIDs |
| outputDirectory | <code>string</code> |  | write received objects to existing directory |
| [sort=] | <code>Object</code> |  | sorting into subdirectories (not with bitPreserving) |
| sort.by | [<code>SortBy</code>](#SortBy) |  | timestamp; sort studies using prefix and a timestamp, UID; sort studies using prefix and the Study Instance UID, patientname; sort studies using the Patient's Name and a timestamp |
| sort.prefix | <code>string</code> |  | only with sort.by timestamp and UID |
| [bitPreserving] | <code>boolean</code> | <code>false</code> | true; write data exactly as read, false; allow implicit format conversions |
| [outputFileFormat] | <code>&#x27;file&#x27;</code> \| <code>&#x27;dataset&#x27;</code> | <code>&#x27;file&#x27;</code> | file; write file format, dataset; write data set without file meta information |
| outputTransferSyntax | <code>&#x27;same&#x27;</code> \| <code>&#x27;little&#x27;</code> \| <code>&#x27;big&#x27;</code> \| <code>&#x27;implicit&#x27;</code> \| <code>&#x27;deflated&#x27;</code> |  | output transfer syntax |
| [disableNewVR] | <code>boolean</code> | <code>false</code> | disable support for new VRs, convert to OB |
| [groupLengthEncoding] | <code>&#x27;recalc&#x27;</code> \| <code>&#x27;create&#x27;</code> \| <code>&#x27;remove&#x27;</code> | <code>&#x27;recalc&#x27;</code> | group length encoding |
| [lengthEncoding] | <code>&#x27;explicit&#x27;</code> \| <code>&#x27;undefined&#x27;</code> | <code>&#x27;explicit&#x27;</code> | length encoding in sequences and items |
| [padding] | <code>Object</code> | <code>{}</code> | data set trailing padding |
| padding.filePad | <code>Object</code> |  | align file on multiple of f bytes |
| padding.itemPad | <code>Object</code> |  | items on multiple of i bytes |
| [handlingOfDefinedLengthUNElements] | <code>&#x27;retain&#x27;</code> \| <code>&#x27;convert&#x27;</code> | <code>&#x27;retain&#x27;</code> | handling of defined length UN elements: retain elements as UN or convert to real VR if known |
| [compressionLevel] | <code>number</code> | <code>6</code> | 0=uncompressed, 1=fastest, 9=best compression |
| [filenameGeneration] | <code>&#x27;default&#x27;</code> \| <code>&#x27;unique&#x27;</code> \| <code>&#x27;timenames&#x27;</code> | <code>&#x27;default&#x27;</code> | default; generate filename from instance UID, unique; generate unique filenames, timenames; generate filename from creation time |
| filenameExtension | <code>string</code> |  | append to all filenames |

<a name="StoreSCP+listen"></a>

### storeSCP.listen([port&#x3D;]) ⇒ <code>Promise</code> \| <code>Promise.&lt;unknown&gt;</code>

Starts listening on port

**Kind**: instance method of [<code>StoreSCP</code>](#StoreSCP)
**Emits**: [<code>starting</code>](#StoreSCP+event_starting)

| Param | Type | Description |
| --- | --- | --- |
| [port=] | <code>Number</code> | defaults to StoreSCP.port or 104 |

<a name="StoreSCP+close"></a>

### storeSCP.close() ⇒ <code>Promise.&lt;unknown&gt;</code>

Stop listening

**Kind**: instance method of [<code>StoreSCP</code>](#StoreSCP)
<a name="StoreSCP+event_starting"></a>

### "starting"

Start Listening

**Kind**: event emitted by [<code>StoreSCP</code>](#StoreSCP)
**Properties**

| Name | Type | Description |
| --- | --- | --- |
| level | <code>string</code> | Event level |
| dt | <code>Date</code> | date/time of the event |
| message | <code>string</code> |  |
| binary | <code>string</code> |  |
| version | <code>string</code> |  |

<a name="StoreSCU"></a>

## StoreSCU : [<code>DCMRecv</code>](#DCMRecv)

DCM Receiver

**Kind**: global class
<a name="StoreSCU+send"></a>

### storeSCU.send([peer&#x3D;], [port&#x3D;], dcmFileIn, [AETitle], [calledAETitle])

Send dicom

**Kind**: instance method of [<code>StoreSCU</code>](#StoreSCU)

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [peer=] | <code>string</code> |  | ip or hostname of DICOM peer |
| [port=] | <code>number</code> |  | port number to listen on |
| dcmFileIn | <code>string</code> |  | DICOM file or directory to be transmitted |
| [AETitle] | <code>string</code> | <code>&quot;&#x27;DCMSEND&#x27;&quot;</code> | my AE title |
| [calledAETitle] | <code>string</code> | <code>&quot;&#x27;ANY-SCP&#x27;&quot;</code> | called AE title of peer (default: ANY-SCP) |

<a name="SortBy"></a>

## SortBy : <code>enum</code>

Enum string values.

**Kind**: global enum
**Properties**

| Name | Type | Default |
| --- | --- | --- |
| timestamp | <code>string</code> | <code>&quot;timestamp&quot;</code> |
| UID | <code>string</code> | <code>&quot;UID&quot;</code> |
| patientname | <code>string</code> | <code>&quot;patientname&quot;</code> |

<a name="findIndexFromStart"></a>

## findIndexFromStart(arr, start, callbackFn) ⇒ <code>number</code>

Same as Array.findIndex but requires a start index

**Kind**: global function

| Param | Type |
| --- | --- |
| arr | <code>Array</code> |
| start | <code>Number</code> |
| callbackFn | <code>function</code> |

