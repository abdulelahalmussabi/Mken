'use strict';

const queue = require('../v1/queue');

/**
 * Staff ticket list. Anonymous callers receive 401.
 * POST without an action issues a manual ticket and also requires a staff session.
 */
module.exports = function handler(req, res) {
  if (!req.query || typeof req.query !== 'object') req.query = {};
  if (!req.query.action) {
    req.query.action = req.method === 'POST' ? 'manual-ticket' : 'list-tickets';
  }
  return queue(req, res);
};
