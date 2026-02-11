/**
 * Type-level tests verifying the public API surface.
 *
 * Uses vitest's expectTypeOf to ensure types are correctly exported
 * and branded types prevent accidental mixing. These tests run at
 * compile-time (type checking) and at runtime (vitest assertions).
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
    Result,
    DicomTag,
    AETitle,
    Port,
    DcmrecvOptions,
    DcmrecvEventMap,
    StoreSCPOptions,
    StoreSCPEventMap,
    DcmprsCPOptions,
    DcmprsCPEventMap,
    DcmpsrcvOptions,
    DcmpsrcvEventMap,
    DcmQRSCPOptions,
    DcmQRSCPEventMap,
    WlmscpfsOptions,
    WlmscpfsEventMap,
    EchoscuResult,
    DcmdumpResult,
    DcmcjplsResult,
    DcmdjplsResult,
    DcmqridxResult,
    ToolBaseOptions,
    VRValue,
    DictionaryEntry,
    TagSegment,
    DicomFileOptions,
    AssociationReceivedData,
    StoredFileData,
    DatabaseReadyData,
    ReceiverListeningData,
    FileDeletedData,
    QRListeningData,
    QRCFindRequestData,
    WlmCFindRequestData,
} from '../src/index';
import {
    ok,
    err,
    createDicomTag,
    createAETitle,
    createPort,
    Dcmrecv,
    StoreSCP,
    DcmprsCP,
    Dcmpsrcv,
    DcmQRSCP,
    Wlmscpfs,
    DicomDataset,
    ChangeSet,
    VR,
    lookupTag,
    ProcessState,
} from '../src/index';

describe('Result<T, E> type narrowing', () => {
    it('ok result has value accessible after narrowing', () => {
        const result = ok(42);
        expectTypeOf(result).toMatchTypeOf<Result<number>>();
        if (result.ok) {
            expectTypeOf(result.value).toBeNumber();
        }
    });

    it('err result has error accessible after narrowing', () => {
        const result = err(new Error('fail'));
        expectTypeOf(result).toMatchTypeOf<Result<never>>();
        if (!result.ok) {
            expectTypeOf(result.error).toEqualTypeOf<Error>();
        }
    });

    it('Result discriminant prevents accessing wrong property', () => {
        const result: Result<string> = ok('hello');
        if (result.ok) {
            expectTypeOf(result.value).toBeString();
            // @ts-expect-error - error should not be accessible on ok result
            void result.error;
        } else {
            expectTypeOf(result.error).toEqualTypeOf<Error>();
            // @ts-expect-error - value should not be accessible on err result
            void result.value;
        }
    });
});

describe('Branded types', () => {
    it('DicomTag factory returns Result<DicomTag>', () => {
        const result = createDicomTag('00100010');
        expectTypeOf(result).toMatchTypeOf<Result<DicomTag>>();
    });

    it('AETitle factory returns Result<AETitle>', () => {
        const result = createAETitle('MYSCP');
        expectTypeOf(result).toMatchTypeOf<Result<AETitle>>();
    });

    it('Port factory returns Result<Port>', () => {
        const result = createPort(11112);
        expectTypeOf(result).toMatchTypeOf<Result<Port>>();
    });

    it('branded types are not interchangeable', () => {
        type CheckNotAssignable = DicomTag extends AETitle ? true : false;
        expectTypeOf<CheckNotAssignable>().toEqualTypeOf<false>();
    });
});

describe('Tool wrapper return types', () => {
    it('EchoscuResult has expected shape', () => {
        expectTypeOf<EchoscuResult>().toHaveProperty('success');
        expectTypeOf<EchoscuResult>().toHaveProperty('stderr');
    });

    it('DcmdumpResult has expected shape', () => {
        expectTypeOf<DcmdumpResult>().toHaveProperty('text');
    });

    it('ToolBaseOptions has signal field', () => {
        expectTypeOf<ToolBaseOptions>().toHaveProperty('signal');
    });

    it('DcmcjplsResult has expected shape', () => {
        expectTypeOf<DcmcjplsResult>().toHaveProperty('outputPath');
    });

    it('DcmdjplsResult has expected shape', () => {
        expectTypeOf<DcmdjplsResult>().toHaveProperty('outputPath');
    });

    it('DcmqridxResult is a discriminated union', () => {
        const registerResult: DcmqridxResult = { mode: 'register' };
        const printResult: DcmqridxResult = { mode: 'print', output: 'data' };
        expectTypeOf(registerResult).toMatchTypeOf<DcmqridxResult>();
        expectTypeOf(printResult).toMatchTypeOf<DcmqridxResult>();
    });
});

describe('Server class static factory return types', () => {
    it('Dcmrecv.create returns Result<Dcmrecv>', () => {
        type CreateReturn = ReturnType<typeof Dcmrecv.create>;
        expectTypeOf<CreateReturn>().toMatchTypeOf<Result<Dcmrecv>>();
    });

    it('StoreSCP.create returns Result<StoreSCP>', () => {
        type CreateReturn = ReturnType<typeof StoreSCP.create>;
        expectTypeOf<CreateReturn>().toMatchTypeOf<Result<StoreSCP>>();
    });

    it('DcmprsCP.create returns Result<DcmprsCP>', () => {
        type CreateReturn = ReturnType<typeof DcmprsCP.create>;
        expectTypeOf<CreateReturn>().toMatchTypeOf<Result<DcmprsCP>>();
    });

    it('Dcmpsrcv.create returns Result<Dcmpsrcv>', () => {
        type CreateReturn = ReturnType<typeof Dcmpsrcv.create>;
        expectTypeOf<CreateReturn>().toMatchTypeOf<Result<Dcmpsrcv>>();
    });

    it('DcmQRSCP.create returns Result<DcmQRSCP>', () => {
        type CreateReturn = ReturnType<typeof DcmQRSCP.create>;
        expectTypeOf<CreateReturn>().toMatchTypeOf<Result<DcmQRSCP>>();
    });

    it('Wlmscpfs.create returns Result<Wlmscpfs>', () => {
        type CreateReturn = ReturnType<typeof Wlmscpfs.create>;
        expectTypeOf<CreateReturn>().toMatchTypeOf<Result<Wlmscpfs>>();
    });
});

describe('Server event maps', () => {
    it('DcmrecvEventMap has expected events', () => {
        expectTypeOf<DcmrecvEventMap>().toHaveProperty('LISTENING');
        expectTypeOf<DcmrecvEventMap>().toHaveProperty('STORED_FILE');
        expectTypeOf<DcmrecvEventMap>().toHaveProperty('ASSOCIATION_RECEIVED');
        expectTypeOf<DcmrecvEventMap>().toHaveProperty('CANNOT_START_LISTENER');
    });

    it('StoreSCPEventMap has storescp-specific events', () => {
        expectTypeOf<StoreSCPEventMap>().toHaveProperty('STORING_FILE');
        expectTypeOf<StoreSCPEventMap>().toHaveProperty('SUBDIRECTORY_CREATED');
    });

    it('DcmprsCPEventMap has print server events', () => {
        expectTypeOf<DcmprsCPEventMap>().toHaveProperty('DATABASE_READY');
        expectTypeOf<DcmprsCPEventMap>().toHaveProperty('CONFIG_ERROR');
    });

    it('DcmpsrcvEventMap has receiver events', () => {
        expectTypeOf<DcmpsrcvEventMap>().toHaveProperty('LISTENING');
        expectTypeOf<DcmpsrcvEventMap>().toHaveProperty('FILE_DELETED');
        expectTypeOf<DcmpsrcvEventMap>().toHaveProperty('TERMINATING');
    });

    it('DcmQRSCPEventMap has Q/R events', () => {
        expectTypeOf<DcmQRSCPEventMap>().toHaveProperty('LISTENING');
        expectTypeOf<DcmQRSCPEventMap>().toHaveProperty('C_FIND_REQUEST');
        expectTypeOf<DcmQRSCPEventMap>().toHaveProperty('C_MOVE_REQUEST');
        expectTypeOf<DcmQRSCPEventMap>().toHaveProperty('C_GET_REQUEST');
        expectTypeOf<DcmQRSCPEventMap>().toHaveProperty('CANNOT_START_LISTENER');
    });

    it('WlmscpfsEventMap has worklist events', () => {
        expectTypeOf<WlmscpfsEventMap>().toHaveProperty('LISTENING');
        expectTypeOf<WlmscpfsEventMap>().toHaveProperty('C_FIND_REQUEST');
        expectTypeOf<WlmscpfsEventMap>().toHaveProperty('ECHO_REQUEST');
        expectTypeOf<WlmscpfsEventMap>().toHaveProperty('CANNOT_START_LISTENER');
    });
});

describe('Server options types', () => {
    it('DcmrecvOptions requires port', () => {
        expectTypeOf<DcmrecvOptions>().toHaveProperty('port');
    });

    it('StoreSCPOptions requires port', () => {
        expectTypeOf<StoreSCPOptions>().toHaveProperty('port');
    });

    it('DcmprsCPOptions requires configFile', () => {
        expectTypeOf<DcmprsCPOptions>().toHaveProperty('configFile');
    });

    it('DcmpsrcvOptions requires configFile', () => {
        expectTypeOf<DcmpsrcvOptions>().toHaveProperty('configFile');
    });

    it('DcmQRSCPOptions requires configFile', () => {
        expectTypeOf<DcmQRSCPOptions>().toHaveProperty('configFile');
    });

    it('WlmscpfsOptions requires port', () => {
        expectTypeOf<WlmscpfsOptions>().toHaveProperty('port');
    });

    it('WlmscpfsOptions requires worklistDirectory', () => {
        expectTypeOf<WlmscpfsOptions>().toHaveProperty('worklistDirectory');
    });
});

describe('Event data types', () => {
    it('AssociationReceivedData has expected fields', () => {
        expectTypeOf<AssociationReceivedData>().toHaveProperty('address');
        expectTypeOf<AssociationReceivedData>().toHaveProperty('callingAE');
        expectTypeOf<AssociationReceivedData>().toHaveProperty('calledAE');
    });

    it('StoredFileData has filePath', () => {
        expectTypeOf<StoredFileData>().toHaveProperty('filePath');
    });

    it('DatabaseReadyData has directory', () => {
        expectTypeOf<DatabaseReadyData>().toHaveProperty('directory');
    });

    it('ReceiverListeningData has receiverId and port', () => {
        expectTypeOf<ReceiverListeningData>().toHaveProperty('receiverId');
        expectTypeOf<ReceiverListeningData>().toHaveProperty('port');
    });

    it('FileDeletedData has filePath', () => {
        expectTypeOf<FileDeletedData>().toHaveProperty('filePath');
    });

    it('QRListeningData has port', () => {
        expectTypeOf<QRListeningData>().toHaveProperty('port');
    });

    it('QRCFindRequestData has raw', () => {
        expectTypeOf<QRCFindRequestData>().toHaveProperty('raw');
    });

    it('WlmCFindRequestData has raw', () => {
        expectTypeOf<WlmCFindRequestData>().toHaveProperty('raw');
    });
});

describe('DICOM data layer types', () => {
    it('DicomDataset has expected methods', () => {
        expectTypeOf<DicomDataset>().toHaveProperty('getString');
        expectTypeOf<DicomDataset>().toHaveProperty('patientName');
        expectTypeOf<DicomDataset>().toHaveProperty('studyInstanceUID');
    });

    it('ChangeSet has expected methods', () => {
        expectTypeOf<ChangeSet>().toHaveProperty('setTag');
        expectTypeOf<ChangeSet>().toHaveProperty('eraseTag');
        expectTypeOf<ChangeSet>().toHaveProperty('isEmpty');
    });

    it('DicomFileOptions has expected shape', () => {
        expectTypeOf<DicomFileOptions>().toHaveProperty('signal');
    });

    it('VRValue includes standard VRs', () => {
        expectTypeOf<'CS'>().toMatchTypeOf<VRValue>();
        expectTypeOf<'LO'>().toMatchTypeOf<VRValue>();
        expectTypeOf<'SQ'>().toMatchTypeOf<VRValue>();
    });

    it('DictionaryEntry has expected fields', () => {
        expectTypeOf<DictionaryEntry>().toHaveProperty('vr');
        expectTypeOf<DictionaryEntry>().toHaveProperty('name');
        expectTypeOf<DictionaryEntry>().toHaveProperty('vm');
    });

    it('TagSegment has tag property', () => {
        expectTypeOf<TagSegment>().toHaveProperty('tag');
    });
});

describe('Constant object types', () => {
    it('VR is an as-const object', () => {
        expectTypeOf(VR.CS).toEqualTypeOf<'CS'>();
        expectTypeOf(VR.LO).toEqualTypeOf<'LO'>();
        expectTypeOf(VR.SQ).toEqualTypeOf<'SQ'>();
    });

    it('ProcessState is an as-const object', () => {
        expectTypeOf(ProcessState.IDLE).toEqualTypeOf<'IDLE'>();
        expectTypeOf(ProcessState.RUNNING).toEqualTypeOf<'RUNNING'>();
        expectTypeOf(ProcessState.STOPPED).toEqualTypeOf<'STOPPED'>();
    });

    it('lookupTag returns DictionaryEntry or undefined', () => {
        expectTypeOf(lookupTag).returns.toMatchTypeOf<DictionaryEntry | undefined>();
    });
});

describe('Negative type tests', () => {
    it('cannot access .value without narrowing Result', () => {
        const result: Result<string> = ok('hello');
        // @ts-expect-error - cannot access value without narrowing
        void result.value;
    });

    it('cannot access .error without narrowing Result', () => {
        const result: Result<string> = ok('hello');
        // @ts-expect-error - cannot access error without narrowing
        void result.error;
    });

    it('cannot assign raw string to DicomTag', () => {
        // @ts-expect-error - raw string is not assignable to DicomTag
        const _tag: DicomTag = '(0010,0010)';
        void _tag;
    });

    it('cannot assign raw string to AETitle', () => {
        // @ts-expect-error - raw string is not assignable to AETitle
        const _ae: AETitle = 'MYSCP';
        void _ae;
    });

    it('cannot assign raw number to Port', () => {
        // @ts-expect-error - raw number is not assignable to Port
        const _port: Port = 11112;
        void _port;
    });

    it('cannot assign DicomTag to AETitle', () => {
        const tagResult = createDicomTag('(0010,0010)');
        expect(tagResult.ok).toBe(true);
        if (tagResult.ok) {
            // @ts-expect-error - DicomTag is not assignable to AETitle
            const _ae: AETitle = tagResult.value;
            void _ae;
        }
    });
});
