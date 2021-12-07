const {spawn, exec} = require('child_process')
const dcm2json = require('./dcm2json')
const DicomObject = require('../DicomObject')

const events = require('events')
// const {DICOM_EVENTS} = require('./dicomEvents')
const {DCMRECV_PDU, DCMRECV_ACSE_TIMEOUT, DCMTK_PATH} = require('../../config')
const fs = require('fs-extra')

class Dcmrecv_old {
  constructor(dcmtkPath, config, port, storePath, routerId) {
    this._dcmtkPath = dcmtkPath
    this._storePath = storePath
    this._config = config
    this._port = port
    this._isRunning = false
    this._child = undefined
    this._emitter = new events.EventEmitter()
    this._input = ''
    this._error = ''
    this._callingAET = ''
    this._calledAET = ''
    this._routerId = routerId
    fs.ensureDir(storePath, error => {
      if (error) throw error
      this.start()
    })
  }

  generateEventId() {
    return (new Date()).toISOString().replace(/[-:.]/g, '')
  }

  start() {
    if (this._isRunning) return true
    this._child = spawn(
      `${this._dcmtkPath}/dcmrecv`,
      [
        '-v',
        '-uca',
        '-pdu',
        `${DCMRECV_PDU}`,
        '-ta',
        `${DCMRECV_ACSE_TIMEOUT}`,
        // '--bit-preserving', // not compatible with --series-date-subdir
        '-od',
        // '/usr/src/app/dicom',
        `${this._storePath}`,
        '-xf',
        `${this._config}`,
        `default`,
        `${this._port}`,
        '--series-date-subdir',
        '--filename-extension',
        '.dcm'
      ]
    )
    this._child.stdout.on('data', (data) => this._handleData(data, 'stdout'))
    this._child.stderr.on('data', (data) => this._handleData(data, 'stderr'))
    this._child.on('close', (exitCode, signal) => {
      this._emitter.emit(Dcmrecv_old.events.DCMRECV_CLOSE, {eventId: this.generateEventId(), message: `DCMRECV_CLOSE - exitCode: ${exitCode}  signal: ${signal}`})
      this.stop()
    })
    this._child.on('exit', (exitCode, signal) => {
      this._emitter.emit(Dcmrecv_old.events.DCMRECV_EXIT, {eventId: this.generateEventId(), message: `DCMRECV_EXIT - exitCode: ${exitCode}  signal: ${signal}`})
      this.stop()
    })
    this._child.on('disconnect', () => {
      this._emitter.emit(Dcmrecv_old.events.DCMRECV_DISCONNECT, {eventId: this.generateEventId(), message: `DCMRECV_DISCONNECT`})
      this.stop()
    })
    this._child.on('error', (error) => {
      this._emitter.emit(Dcmrecv_old.events.DCMRECV_ERROR, {eventId: this.generateEventId(), message: `DCMRECV_ERROR - ${error.message}`})
      this.stop(error)
    })
    this._child.on('message', (message, sendHandle) => {
      this._emitter.emit(Dcmrecv_old.events.DCMRECV_MESSAGE, {eventId: this.generateEventId(), message})
    })
  }

  stop(error) {
    if (!this._child) {
      this._isRunning = false
      return
    }
    try {
      this._child.kill()
      delete this._child
    } catch {
    }
    this._isRunning = false
    this._child = undefined
    if (error) throw error
  }

  on(event, fn) {
    return this._emitter.on(event, fn)
  }

  // todo this needs to be cleaned up. This was a quick hack to cause the emitEvent to include a valid DicomObject
  _emitEvent(text) {
    if (typeof text !== 'string') text = JSON.stringify(text)
    if (text.trim() === '') return
    let eventId = this.generateEventId()
    let eventResult = Object.keys(Dcmrecv_old.events).some(key => {
      let event = dicomEvents[Dcmrecv_old.events[key]]
      if (event && text.indexOf(event.match) > -1) {
        let eventData = (event.transformer) ? event.transformer(text) : {}
        eventData.message = text
        eventData.event = key
        eventData.eventId = eventId

        if (Dcmrecv_old.events[key] === Dcmrecv_old.events.ASSOCIATION_RECEIVED) {
          this._callingAET = eventData.callingAET
          this._calledAET = eventData.calledAET
          this._emitter.emit(Dcmrecv_old.events[key], eventData)
        } else if (Dcmrecv_old.events[key] === Dcmrecv_old.events.STORED_FILE) {
          let {callingAET, calledAET} = this
          dcm2json(DCMTK_PATH, eventData.file)
            .then(async (res) => {

              eventData.dicom = new DicomObject({dcmtkPath: DCMTK_PATH, eventId, json: res.json, inFilePath: eventData.file, callingAET, calledAET})
              this._emitter.emit(Dcmrecv_old.events[key], eventData)
            })
            .catch(err => {
              console.log('dcm2json', err)
              this._emitter.emit(Dcmrecv_old.events[err.event], {message: err.message, error: err.err, stack: err.stack})
              // todo emit error
            })
        } else {
          this._emitter.emit(Dcmrecv_old.events[key], eventData)
        }
        return true
      }
    })
    if (!eventResult) this._emitter.emit(Dcmrecv_old.events.DCMRECV_UNKNOWN, {message: text, event: Dcmrecv_old.events.DCMRECV_UNKNOWN, eventId})
  }

  _handleData(data) {
    this._input += data
    let match = /\r\n|\n|\r/g.exec(this._input)
    let linebreak = (match && match[0])
    if (!!linebreak) {
      let lastBreak = this._input.lastIndexOf(linebreak)
      let temp = this._input.slice(0, lastBreak).split(linebreak)
      temp.forEach(ele => this._emitEvent(ele))
      this._input = this._input.slice(lastBreak)
    }
  }

  get callingAET() {
    return this._callingAET
  }

  get calledAET() {
    return this._calledAET
  }
}

Dcmrecv_old.events = {
  CONFIGURING: Symbol('CONFIGURING'),
  LISTENING: Symbol('LISTENING'),
  ASSOCIATION_RECEIVED: Symbol('ASSOCIATION_RECEIVED'),
  ASSOCIATION_ACKNOWLEDGED: Symbol('ASSOCIATION_ACKNOWLEDGED'),
  ASSOCIATION_RELEASE: Symbol('ASSOCIATION_RELEASE'),
  ASSOCIATION_ABORT: Symbol('ASSOCIATION_ABORT'),
  C_STORE_REQUEST: Symbol('C_STORE_REQUEST'),
  C_STORE_SUCCESS: Symbol('C_STORE_SUCCESS'),
  STORED_FILE: Symbol('STORED_FILE'),

  DCMRECV_CLOSE: Symbol('DCMRECV_CLOSE'),
  DCMRECV_EXIT: Symbol('DCMRECV_EXIT'),
  DCMRECV_DISCONNECT: Symbol('DCMRECV_DISCONNECT'),
  DCMRECV_ERROR: Symbol('DCMRECV_ERROR'),
  DCMRECV_MESSAGE: Symbol('DCMRECV_MESSAGE'),
  DCMRECV_FILE_EXIST: Symbol('DCMRECV_FILE_EXIST'),
  DCMRECV_REFUSING_ASSOCIATION_BAD_APPLICATION_CONTEXT: Symbol('DCMRECV_REFUSING_ASSOCIATION_BAD_APPLICATION_CONTEXT'),
  DCMRECV_READ_PDV_FAILED: Symbol('DCMRECV_READ_PDV_FAILED'),
  DCMRECV_DUL_NETWORK_CLOSED: Symbol('DCMRECV_DUL_NETWORK_CLOSED'),
  DCMRECV_UNABLE_TO_RECEIVE_CSTORE: Symbol('DCMRECV_UNABLE_TO_RECEIVE_CSTORE'),
  DCMRECV_UNKNOWN_TYPE: Symbol('DCMRECV_UNKNOWN_TYPE'),
  DCMRECV_EVENT: Symbol('DCMRECV_EVENT'),
  DCMRECV_UNKNOWN: Symbol('DCMRECV_UNKNOWN'),
  DCMRECV_NO_CONVERSION_TRANSFER_SYNTAX: Symbol('DCMRECV_NO_CONVERSION_TRANSFER_SYNTAX'),
  START_FAILED_PORT_CONFLICT: Symbol('START_FAILED_PORT_CONFLICT')
}

const dicomEvents = {
  // configuring service class provider ...
  [Dcmrecv_old.events.CONFIGURING]: {match: 'configuring'},
  [Dcmrecv_old.events.LISTENING]: {match: 'listening'},
  // Association Received 10: DCMSEND -> TRG
  [Dcmrecv_old.events.ASSOCIATION_RECEIVED]: {
    match: 'Association Received',
    transformer: (text) => {
      let matches = /Association Received .*: (.*) -> (.*)/.exec(text) || []
      return {text, callingAET: matches[1], calledAET: matches[2]}
    }
  },
  //Association Acknowledged (Max Send PDV: 16372)
  [Dcmrecv_old.events.ASSOCIATION_ACKNOWLEDGED]: {match: 'Association Acknowledged'},
  // Received Association Release Request
  [Dcmrecv_old.events.ASSOCIATION_RELEASE]: {match: 'Received Association Release Request'},
  [Dcmrecv_old.events.ASSOCIATION_ABORT]: {match: 'Received Association Abort Request'},
  // Received C-STORE Request (MsgID 1)
  [Dcmrecv_old.events.C_STORE_REQUEST]: {match: 'Received C-STORE'},
  [Dcmrecv_old.events.C_STORE_SUCCESS]: {match: 'Sending C-STORE Response (Success)'},
  // Stored received object to file: .\data\2015\12\07\CR_5d4d8cf472ed5522.dcm
  [Dcmrecv_old.events.STORED_FILE]: {
    match: 'Stored received object',
    transformer: (text) => ({text, file: text.replace('I: Stored received object to file: ', '')})
  },
  [Dcmrecv_old.events.DCMRECV_FILE_EXIST]: {match: 'file already exists'},
  [Dcmrecv_old.events.DCMRECV_REFUSING_ASSOCIATION_BAD_APPLICATION_CONTEXT]: {match: 'Refusing Association (bad application context)'},
  [Dcmrecv_old.events.DCMRECV_READ_PDV_FAILED]: {match: 'DIMSE Read PDV failed'},
  [Dcmrecv_old.events.DCMRECV_DUL_NETWORK_CLOSED]: {match: 'DUL network closed'},
  [Dcmrecv_old.events.DCMRECV_UNABLE_TO_RECEIVE_CSTORE]: {match: 'Unable to receive C-STORE'},
  [Dcmrecv_old.events.DCMRECV_UNKNOWN_TYPE]: {match: 'with VR UN and undefined length'},
  // [Dcmrecv_old.events.STOPPED]: {},
  // cannot start SCP and listen on port 104: TCP Initialization Error: Only one usage of each socket address (protocol/network address/port) is normally permitted.
  // child process exited with code 64
  [Dcmrecv_old.events.START_FAILED_PORT_CONFLICT]: {match: 'cannot start SCP and listen on port'},
  [Dcmrecv_old.events.DCMRECV_NO_CONVERSION_TRANSFER_SYNTAX]: {match: 'No conversion to transfer syntax'},
  // Sending C-STORE Response (Success)
  // [Dcmrecv_old.events.DICOM_SEND_SUCCESS]: {},
  // [Dcmrecv_old.events.DICOM_SEND_FAILED]: {},
  // [Dcmrecv_old.events.DICOM_SEND_FAILED_CONNECTION_REFUSED]: {},
  // [Dcmrecv_old.events.DICOM_MODIFY_SUCCESS]: {},
  // [Dcmrecv_old.events.DICOM_MODIFY_SUCCESS]: {},
}

//Dcmrecv_old.events = DICOM_EVENTS
module.exports = Dcmrecv_old
