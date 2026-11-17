'use strict';

const { dispatch } = require('../_lib/router');

module.exports = function handler(req, res) {
  return dispatch('crm', req, res);
};


// WhatsApp verifies Meta/Twilio signatures against the raw body.
// bodyParser stays off for this whole function; the router parses JSON
// only for the non-webhook routes in the group (cron, webhook-proxy).
module.exports.config = {
  api: {
    bodyParser: false
  }
};
