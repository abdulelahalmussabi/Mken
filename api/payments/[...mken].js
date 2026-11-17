'use strict';

const { dispatch } = require('../_lib/router');

module.exports = function handler(req, res) {
  return dispatch('payments', req, res);
};

