'use strict';

const { EventEmitter } = require('events');
const table = require('./_lib/route-table');
const { dispatch } = require('./_lib/router');
const queueHandler = require('./queue');

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length']);

function headersToNode(request) {
  const headers = {};
  request.headers.forEach(function (value, key) {
    headers[key] = value;
  });
  return headers;
}

function queryFrom(url) {
  const query = {};
  url.searchParams.forEach(function (value, key) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const prev = query[key];
      query[key] = Array.isArray(prev) ? prev.concat(value) : [prev, value];
    } else {
      query[key] = value;
    }
  });
  return query;
}

function applyKnownQuery(pathname, url) {
  const known = table.QUERY_REWRITES.find(function (item) { return item.source === pathname; });
  if (!known) return;
  Object.keys(known.query).forEach(function (key) {
    if (!url.searchParams.has(key)) url.searchParams.set(key, known.query[key]);
  });
}

function parseBody(buf, contentType) {
  const text = buf.toString('utf8');
  const ct = String(contentType || '');
  if (!text) return {};
  if (ct.indexOf('application/json') !== -1 || text.charAt(0) === '{' || text.charAt(0) === '[') {
    try { return JSON.parse(text); } catch (err) { return {}; }
  }
  if (ct.indexOf('application/x-www-form-urlencoded') !== -1) {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return {};
}

function responseHeaders(headerBag) {
  const headers = new Headers();
  headerBag.forEach(function (value, key) {
    if (HOP_BY_HOP.has(String(key).toLowerCase())) return;
    if (Array.isArray(value)) {
      value.forEach(function (item) { headers.append(key, String(item)); });
    } else {
      headers.set(key, String(value));
    }
  });
  return headers;
}

function invoke(handler, request, publicUrl, options) {
  const url = new URL(publicUrl, 'http://localhost');
  const raw = !!(options && options.rawBody);
  return request.arrayBuffer().then(function (arrayBuffer) {
    const buf = Buffer.from(arrayBuffer);
    return new Promise(function (resolve, reject) {
      const req = new EventEmitter();
      req.method = request.method;
      req.url = url.pathname + url.search;
      req.query = queryFrom(url);
      req.headers = headersToNode(request);
      req.rawBody = buf;
      req.socket = { remoteAddress: '' };
      if (!raw) req.body = parseBody(buf, req.headers['content-type']);

      const headerBag = new Map();
      const chunks = [];
      const pendingChunks = [];
      let streaming = false;
      let settled = false;
      let controller = null;

      function finishBuffered() {
        if (settled) return;
        settled = true;
        const body = chunks.length ? Buffer.concat(chunks) : null;
        resolve(new Response(body && body.length ? body : null, {
          status: reqRes.statusCode || 200,
          headers: responseHeaders(headerBag)
        }));
      }

      const reqRes = new EventEmitter();
      reqRes.statusCode = 200;
      reqRes.headersSent = false;
      reqRes.setHeader = function (key, value) {
        headerBag.set(String(key), value);
        return reqRes;
      };
      reqRes.getHeader = function (key) { return headerBag.get(String(key)); };
      reqRes.removeHeader = function (key) { headerBag.delete(String(key)); };
      reqRes.status = function (code) {
        reqRes.statusCode = code;
        return reqRes;
      };
      reqRes.flushHeaders = function () { reqRes.headersSent = true; };
      reqRes.writeHead = function (code) {
        if (code) reqRes.statusCode = code;
        reqRes.headersSent = true;
        return reqRes;
      };
      reqRes.write = function (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
        if (!streaming) {
          streaming = true;
          settled = true;
          const stream = new ReadableStream({
            start: function (ctrl) {
              controller = ctrl;
              pendingChunks.splice(0).forEach(function (item) { ctrl.enqueue(item); });
            },
            cancel: function () {
              req.emit('close');
              req.emit('aborted');
            }
          });
          resolve(new Response(stream, {
            status: reqRes.statusCode || 200,
            headers: responseHeaders(headerBag)
          }));
        }
        if (controller) controller.enqueue(buffer);
        else pendingChunks.push(buffer);
        return true;
      };
      reqRes.end = function (data) {
        if (data !== undefined && data !== null) {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
          if (streaming) {
            if (controller) controller.enqueue(buffer);
            else pendingChunks.push(buffer);
          } else {
            chunks.push(buffer);
          }
        }
        if (streaming) {
          if (controller) controller.close();
          req.emit('close');
          return reqRes;
        }
        finishBuffered();
        req.emit('close');
        return reqRes;
      };
      reqRes.json = function (data) {
        if (!headerBag.has('Content-Type') && !headerBag.has('content-type')) {
          reqRes.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        chunks.length = 0;
        chunks.push(Buffer.from(JSON.stringify(data)));
        return reqRes.end();
      };
      reqRes.send = function (data) {
        if (data !== undefined && data !== null && typeof data === 'object' && !Buffer.isBuffer(data)) {
          return reqRes.json(data);
        }
        return reqRes.end(data);
      };

      let pending;
      try {
        pending = handler(req, reqRes);
      } catch (err) {
        reject(err);
        return;
      }
      if (raw) {
        process.nextTick(function () {
          if (buf.length) req.emit('data', buf);
          req.emit('end');
        });
      }
      Promise.resolve(pending).then(function () {
        if (!settled) finishBuffered();
      }, reject);
    });
  });
}

function publicPathFromSegments(pathSegments) {
  const parts = Array.isArray(pathSegments) ? pathSegments : [];
  let pathname = '/api/' + parts.map(function (part) { return decodeURIComponent(part); }).join('/');
  if (pathname === '/api/') pathname = '/api';
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  return pathname;
}

async function handlePlatform(request, pathSegments) {
  const current = new URL(request.url);
  const pathname = publicPathFromSegments(pathSegments);
  applyKnownQuery(pathname, current);
  const route = table.matchMount(pathname);
  if (!route) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
  const publicUrl = pathname + current.search;
  return invoke(function (req, res) {
    return dispatch(route.group, req, res);
  }, request, publicUrl, { rawBody: !!route.rawBody });
}

async function handleQueue(request) {
  const current = new URL(request.url);
  let pathname = current.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  let publicPath = '/api/v1/queue';
  if (pathname === '/api/v1/queue-events' || pathname === '/api/v1/queue/events') {
    current.searchParams.set('action', 'events');
  } else if (pathname === '/api/queue/tickets' || pathname === '/api/v1/queue/tickets') {
    publicPath = '/api/queue/tickets';
    if (!current.searchParams.has('action')) {
      current.searchParams.set('action', request.method === 'POST' ? 'manual-ticket' : 'list-tickets');
    }
  } else if (pathname === '/api/queue/intake/status' || pathname === '/api/v1/queue/intake/status') {
    publicPath = '/api/queue/intake/status';
    if (!current.searchParams.has('action')) current.searchParams.set('action', 'intake-status');
  }
  const publicUrl = publicPath + current.search;
  return invoke(queueHandler, request, publicUrl, { rawBody: false });
}

module.exports = {
  invoke,
  handlePlatform,
  handleQueue,
  applyKnownQuery
};
