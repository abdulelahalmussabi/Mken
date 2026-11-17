'use strict';

const queueHandler = require('../api/v1/queue.js');
const { staffCookie } = require('./queue-http.cjs');

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
  return res;
}

async function main() {
  const action = process.argv[2];
  const tenant = process.argv[3];
  const extra = JSON.parse(process.argv[4] || '{}');
  const req = {
    method: extra.method || 'POST',
    url: '/api/v1/queue?action=' + action,
    query: Object.assign({ action: action, tenant: tenant }, extra.query || {}),
    body: extra.body || {},
    headers: {
      host: tenant + '.mken.live',
      origin: 'https://' + tenant + '.mken.live',
      'x-forwarded-for': extra.ip || '203.0.113.40',
      cookie: extra.staff === false ? '' : staffCookie(tenant, 'client', 'receptionist')
    }
  };
  const res = mockRes();
  await queueHandler(req, res);
  process.stdout.write('RESULT ' + JSON.stringify({ status: res.statusCode, body: res.body }) + '\n');
}

main().catch(function (err) {
  process.stderr.write(String(err && err.stack || err) + '\n');
  process.exit(1);
});
