'use strict';

const queue = require('../../v1/queue');

/** Public customer status: ticket number, counter, and status only. */
module.exports = function handler(req, res) {
  if (!req.query || typeof req.query !== 'object') req.query = {};
  req.query.action = 'intake-status';
  return queue(req, res);
};
