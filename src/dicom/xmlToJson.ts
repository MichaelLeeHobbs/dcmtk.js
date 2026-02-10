/**
 * Public re-export of the XML-to-JSON converter for the DICOM data layer.
 *
 * Converts dcm2xml "Native DICOM Model" XML to the DICOM JSON Model (PS3.18 F.2).
 *
 * @module dicom/xmlToJson
 */

export { xmlToJson } from '../tools/_xmlToJson';
export type { DicomJsonModel, DicomJsonElement } from '../tools/_xmlToJson';
