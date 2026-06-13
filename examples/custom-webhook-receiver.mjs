/**
 * خادم استقبال تجريبي لـ Custom Webhook — منصة مكِّن
 *
 * التشغيل:
 *   node examples/custom-webhook-receiver.mjs
 *
 * ثم في لوحة الإدارة:
 *   - اختر Custom Webhook
 *   - ضع الرابط: http://localhost:3030/webhook
 *   - ضع التوكن (اختياري): test-secret-123
 *   - اضغط "اختبار الإرسال التجريبي"
 */

import http from 'node:http';

const PORT = Number(process.env.WEBHOOK_PORT || 3030);
const EXPECTED_TOKEN = process.env.WEBHOOK_TOKEN || 'test-secret-123';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return sendJson(res, 200, {
      ok: true,
      message: 'Custom Webhook receiver is running',
      webhookUrl: `http://localhost:${PORT}/webhook`,
      expectedToken: EXPECTED_TOKEN,
    });
  }

  if (req.method !== 'POST' || req.url !== '/webhook') {
    return sendJson(res, 404, { ok: false, error: 'Not found' });
  }

  const auth = req.headers.authorization || '';
  if (EXPECTED_TOKEN && auth !== `Bearer ${EXPECTED_TOKEN}`) {
    console.warn('Rejected request: invalid or missing Authorization header');
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Invalid JSON payload:', err.message);
    return sendJson(res, 400, { ok: false, error: 'Invalid JSON payload' });
  }

  const { to, body, event, appointment, item } = payload;
  if (!to || !body) {
    return sendJson(res, 400, { ok: false, error: 'Missing required fields: to, body' });
  }

  console.log('--- Incoming Custom Webhook ---');
  console.log('Event:', event || '(none)');
  console.log('To:', to);
  console.log('Body preview:', String(body).slice(0, 120) + (String(body).length > 120 ? '...' : ''));
  if (appointment) console.log('Appointment:', appointment);
  if (item) console.log('Item:', item);
  console.log('-------------------------------');

  // هنا تربط خدمة الإرسال الفعلية (UltraMsg API، WhatsApp Business API، إلخ)
  return sendJson(res, 200, {
    ok: true,
    received: true,
    event: event || null,
    to,
    messageLength: String(body).length,
  });
});

server.listen(PORT, () => {
  console.log(`Custom Webhook receiver listening on http://localhost:${PORT}/webhook`);
  console.log(`Expected token: Bearer ${EXPECTED_TOKEN}`);
  console.log('Press Ctrl+C to stop.');
});
