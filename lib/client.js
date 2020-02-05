'use strict'

const WebSocket = require('ws')
const uuid = require('uuid')

const Commands = require('./commands')

const DEFAULT_OPTIONS = {
  'url': 'wss://demoserver.dev/ws',
  'pullIntervalMs': 12000,
  'win': 100
}

/**
 * @typedef {{_reqId: string}} Message
 * @typedef {number[]} Set
 * @typedef {string} EventId
 * @typedef {string} SetId
 */
/**
 * @typedef {Object} Message
 * @property {string} _reqId
 */
/**
 * @typedef {Message} Data
 * @property {{set1: Set, set2: Set}} data
 */
/**
 * @typedef {Message} Events
 * @property {number} minDiv -
 * @property {number} maxDiv -
 * @property {Object<eventId,Object>} events
 */

/**
 * Implements a public interface that allows to interacts with a random data set server.
 * @class
 */
class Client {
  /**
   * @typedef {Object} ClientOptions
   * @property {string} url -
   * @property {number} pullIntervalMs -
   * @property {number} win -
   */
  /**
   * @constructor
   * @param {ClientOptions} options -
   */
  constructor (options = DEFAULT_OPTIONS) {
    const { url, pullIntervalMs, win } = options

    this._url = url || DEFAULT_OPTIONS.url

    this._pullInterval = null
    this._pullIntervalMs = pullIntervalMs || DEFAULT_OPTIONS.pullIntervalMs

    this._win = win || DEFAULT_OPTIONS.win

    this._minDiv = null
    this._maxDiv = null
    this._events = {}

    this._logger = console
  }

  /**
   * Starts a client.
   * @returns {void} -
   */
  start () {
    this._connect()
  }

  /**
   * Stops a client.
   * @param {number} [code=0] -
   * @private
   */
  stop (code = 0) {
    clearInterval(this._pullInterval)
    this._ws.close()
    process.exit(code)
  }

  /**
   * Connects to a server.
   * @returns {void} -
   * @private
   */
  _connect () {
    this._ws = new WebSocket(this._url)

    this._ws.on('open', this._onOpen.bind(this))
    this._ws.on('message', this._onMessage.bind(this))
  }

  /**
   * Handles a websocket connection opening.
   * @description Sets up an interval for pulling events from a server.
   * @return {void} -
   * @private
   */
  _onOpen () {
    this._send(Commands.getEvents())
    this._pullInterval = setInterval(this._send.bind(this, Commands.getEvents()), this._pullIntervalMs)
  }

  /**
   * Handles a message in a websocket connection.
   * @param {string} msg -
   * @returns {void} -
   * @private
   */
  _onMessage (msg) {
    this._logger.log('<< ' + msg)

    const data = JSON.parse(msg)

    switch (true) {
      case typeof data.events === 'object':
        return this._onEventsHandler(data)
      case typeof data.data === 'object':
        return this._onDataHandler(data)
      case data.message === 'Lose':
        return this._onLoseHandler(data)
      case data.message === 'Win':
        return this._onWinHandler(data)
    }
  }

  /**
   * Handles a message with new events.
   * @param {Events} data -
   * @returns {void} -
   * @private
   */
  _onEventsHandler (data) {
    const { minDiv, maxDiv, events } = data

    this._events = {}
    this._minDiv = minDiv
    this._maxDiv = maxDiv

    Object.keys(events).forEach(eventId => {
      const reqId = uuid()

      this._events[reqId] = eventId
      this._send(Commands.getData(eventId), reqId)
    })
  }

  /**
   * Handles a message with new data.
   * @param {Data} data -
   * @returns {void} -
   * @private
   */
  _onDataHandler (data) {
    const { data: { set1, set2 }, _reqId: reqId } = data
    const eventId = this._events[reqId]

    this._processSet(set1, set2, { set: 'set1', eventId })
    this._processSet(set2, set1, { set: 'set2', eventId })
  }

  /**
   * Processes a data sets.
   * @description Sends a confirmation message if a solution is found.
   * @param {Set} set1 -
   * @param {Set} set2 -
   * @param {Object} options -
   * @param {SetId} options.set set identifier
   * @param {EventId} options.eventId -
   * @returns {void} -
   * @private
   */
  _processSet (set1, set2, options) {
    const { set, eventId } = options

    for (let n in set1) {
      const div = parseFloat(parseFloat(set1[n] / set2[n]).toPrecision(3))

      if (this._minDiv < div && div < this._maxDiv) {
        this._send(Commands.confirm(eventId, set, Number(n), div))
      }
    }
  }

  /**
   * Handles a lose message.
   * @returns {void} -
   * @private
   */
  _onLoseHandler () {
    this.stop(1)
  }

  /**
   * Handles a win message.
   * @returns {void} -
   * @private
   */
  _onWinHandler () {
    this.stop(0)
  }

  /**
   * Sends a message to a server.
   * @param {Object} command -
   * @param {string} [reqId] -
   * @returns {void} -
   * @private
   */
  _send (command, reqId = uuid()) {
    const msg = JSON.stringify({ ...command, _reqId: reqId })

    this._logger.log('>> ' + msg)
    this._ws.send(msg)
  }
}

module.exports = Client
