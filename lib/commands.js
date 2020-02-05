'use strict'

/**
 * A helper for generating commands for a client-server protocol.
 */
module.exports = {
  getEvents: () => {
    return {
      cmd: 'getEvents'
    }
  },
  getData: eventId => {
    return {
      cmd: 'getData',
      eventId
    }
  },
  confirm: (eventId, set, n, div) => {
    return {
      cmd: 'confirm',
      eventId,
      set,
      n,
      div
    }
  }
}
