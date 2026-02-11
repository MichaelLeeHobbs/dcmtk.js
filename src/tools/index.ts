// ---------------------------------------------------------------------------
// Tools barrel export — all 51 short-lived DCMTK tool wrappers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Data & Metadata
// ---------------------------------------------------------------------------

export { dcm2xml, Dcm2xmlCharset } from './dcm2xml';
export type { Dcm2xmlOptions, Dcm2xmlResult, Dcm2xmlCharsetValue } from './dcm2xml';

export { dcm2json } from './dcm2json';
export type { Dcm2jsonOptions, Dcm2jsonResult, Dcm2jsonSource, DicomJsonModel } from './dcm2json';

export { dcmdump, DcmdumpFormat } from './dcmdump';
export type { DcmdumpOptions, DcmdumpResult, DcmdumpFormatValue } from './dcmdump';

export { dcmconv, TransferSyntax } from './dcmconv';
export type { DcmconvOptions, DcmconvResult, TransferSyntaxValue } from './dcmconv';

export { dcmodify } from './dcmodify';
export type { DcmodifyOptions, DcmodifyResult, TagModification } from './dcmodify';

export { dcmftest } from './dcmftest';
export type { DcmftestOptions, DcmftestResult } from './dcmftest';

export { dcmgpdir } from './dcmgpdir';
export type { DcmgpdirOptions, DcmgpdirResult } from './dcmgpdir';

export { dcmmkdir } from './dcmmkdir';
export type { DcmmkdirOptions, DcmmkdirResult } from './dcmmkdir';

export { dcmqridx } from './dcmqridx';
export type { DcmqridxOptions, DcmqridxResult } from './dcmqridx';

// ---------------------------------------------------------------------------
// File Conversion
// ---------------------------------------------------------------------------

export { xml2dcm } from './xml2dcm';
export type { Xml2dcmOptions, Xml2dcmResult } from './xml2dcm';

export { json2dcm } from './json2dcm';
export type { Json2dcmOptions, Json2dcmResult } from './json2dcm';

export { dump2dcm } from './dump2dcm';
export type { Dump2dcmOptions, Dump2dcmResult } from './dump2dcm';

export { img2dcm, Img2dcmInputFormat } from './img2dcm';
export type { Img2dcmOptions, Img2dcmResult, Img2dcmInputFormatValue } from './img2dcm';

export { pdf2dcm } from './pdf2dcm';
export type { Pdf2dcmOptions, Pdf2dcmResult } from './pdf2dcm';

export { dcm2pdf } from './dcm2pdf';
export type { Dcm2pdfOptions, Dcm2pdfResult } from './dcm2pdf';

export { cda2dcm } from './cda2dcm';
export type { Cda2dcmOptions, Cda2dcmResult } from './cda2dcm';

export { dcm2cda } from './dcm2cda';
export type { Dcm2cdaOptions, Dcm2cdaResult } from './dcm2cda';

export { stl2dcm } from './stl2dcm';
export type { Stl2dcmOptions, Stl2dcmResult } from './stl2dcm';

// ---------------------------------------------------------------------------
// Compression & Encoding
// ---------------------------------------------------------------------------

export { dcmcrle } from './dcmcrle';
export type { DcmcrleOptions, DcmcrleResult } from './dcmcrle';

export { dcmdrle } from './dcmdrle';
export type { DcmdrleOptions, DcmdrleResult } from './dcmdrle';

export { dcmencap } from './dcmencap';
export type { DcmencapOptions, DcmencapResult } from './dcmencap';

export { dcmdecap } from './dcmdecap';
export type { DcmdecapOptions, DcmdecapResult } from './dcmdecap';

export { dcmcjpeg } from './dcmcjpeg';
export type { DcmcjpegOptions, DcmcjpegResult } from './dcmcjpeg';

export { dcmdjpeg, ColorConversion } from './dcmdjpeg';
export type { DcmdjpegOptions, DcmdjpegResult, ColorConversionValue } from './dcmdjpeg';

export { dcmcjpls } from './dcmcjpls';
export type { DcmcjplsOptions, DcmcjplsResult } from './dcmcjpls';

export { dcmdjpls, JplsColorConversion } from './dcmdjpls';
export type { DcmdjplsOptions, DcmdjplsResult, JplsColorConversionValue } from './dcmdjpls';

// ---------------------------------------------------------------------------
// Image Processing
// ---------------------------------------------------------------------------

export { dcmj2pnm, Dcmj2pnmOutputFormat } from './dcmj2pnm';
export type { Dcmj2pnmOptions, Dcmj2pnmResult, Dcmj2pnmOutputFormatValue } from './dcmj2pnm';

export { dcm2pnm, Dcm2pnmOutputFormat } from './dcm2pnm';
export type { Dcm2pnmOptions, Dcm2pnmResult, Dcm2pnmOutputFormatValue } from './dcm2pnm';

export { dcmscale } from './dcmscale';
export type { DcmscaleOptions, DcmscaleResult } from './dcmscale';

export { dcmquant } from './dcmquant';
export type { DcmquantOptions, DcmquantResult } from './dcmquant';

export { dcmdspfn } from './dcmdspfn';
export type { DcmdspfnOptions, DcmdspfnResult } from './dcmdspfn';

export { dcod2lum } from './dcod2lum';
export type { Dcod2lumOptions, Dcod2lumResult } from './dcod2lum';

export { dconvlum } from './dconvlum';
export type { DconvlumOptions, DconvlumResult } from './dconvlum';

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export { echoscu } from './echoscu';
export type { EchoscuOptions, EchoscuResult } from './echoscu';

export { dcmsend } from './dcmsend';
export type { DcmsendOptions, DcmsendResult } from './dcmsend';

export { storescu } from './storescu';
export type { StorescuOptions, StorescuResult } from './storescu';

export { findscu, QueryModel } from './findscu';
export type { FindscuOptions, FindscuResult, QueryModelValue } from './findscu';

export { movescu, MoveQueryModel } from './movescu';
export type { MovescuOptions, MovescuResult, MoveQueryModelValue } from './movescu';

export { getscu, GetQueryModel } from './getscu';
export type { GetscuOptions, GetscuResult, GetQueryModelValue } from './getscu';

export { termscu } from './termscu';
export type { TermscuOptions, TermscuResult } from './termscu';

// ---------------------------------------------------------------------------
// Structured Reports
// ---------------------------------------------------------------------------

export { dsrdump } from './dsrdump';
export type { DsrdumpOptions, DsrdumpResult } from './dsrdump';

export { dsr2xml } from './dsr2xml';
export type { Dsr2xmlOptions, Dsr2xmlResult } from './dsr2xml';

export { xml2dsr } from './xml2dsr';
export type { Xml2dsrOptions, Xml2dsrResult } from './xml2dsr';

export { drtdump } from './drtdump';
export type { DrtdumpOptions, DrtdumpResult } from './drtdump';

// ---------------------------------------------------------------------------
// Presentation State & Print
// ---------------------------------------------------------------------------

export { dcmpsmk } from './dcmpsmk';
export type { DcmpsmkOptions, DcmpsmkResult } from './dcmpsmk';

export { dcmpschk } from './dcmpschk';
export type { DcmpschkOptions, DcmpschkResult } from './dcmpschk';

export { dcmprscu } from './dcmprscu';
export type { DcmprscuOptions, DcmprscuResult } from './dcmprscu';

export { dcmpsprt } from './dcmpsprt';
export type { DcmpsprtOptions, DcmpsprtResult } from './dcmpsprt';

export { dcmp2pgm } from './dcmp2pgm';
export type { Dcmp2pgmOptions, Dcmp2pgmResult } from './dcmp2pgm';

export { dcmmkcrv } from './dcmmkcrv';
export type { DcmmkcrvOptions, DcmmkcrvResult } from './dcmmkcrv';

export { dcmmklut, LutType } from './dcmmklut';
export type { DcmmklutOptions, DcmmklutResult, LutTypeValue } from './dcmmklut';

// ---------------------------------------------------------------------------
// Shared tool types
// ---------------------------------------------------------------------------

export type { ToolBaseOptions } from './_toolTypes';
export type { DicomJsonElement } from './_xmlToJson';
