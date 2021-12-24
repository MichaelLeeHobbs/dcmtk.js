<a name="DCM2XML"></a>

## DCM2XML

**Kind**: global class
<a name="new_DCM2XML_new"></a>

### new DCM2XML([inputFileFormat], [inputTransferSyntax], [longTagValues])

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [inputFileFormat] | <code>&#x27;file&#x27;</code> \| <code>&#x27;file-only&#x27;</code> \| <code>&#x27;dataset&#x27;</code> | <code>file</code> |  |
| [inputTransferSyntax] | <code>&#x27;auto&#x27;</code> \| <code>&#x27;detect&#x27;</code> \| <code>&#x27;little&#x27;</code> \| <code>&#x27;big&#x27;</code> \| <code>&#x27;implicit&#x27;</code> | <code>auto</code> |  |
| [longTagValues] | <code>Object</code> | <code>{load: &#x27;short&#x27;, maxReadLength: 4}</code> |  |
| [longTagValues.load] | <code>string</code> | <code>&quot;&#x27;short&#x27;&quot;</code> |  |
| [longTagValues.maxReadLength] | <code>number</code> | <code>4</code> | integer (4..4194302, default: 4) set threshold for long values to k kbytes |
