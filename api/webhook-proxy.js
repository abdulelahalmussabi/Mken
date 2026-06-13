module.exports = async function handler(req, res) {
  // 1. Set CORS headers to allow calls from any origin (e.g., localhost or custom domains)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 2. Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const { url, method = 'POST', headers = {}, body } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'Missing target "url" in request body.' });
  }

  try {
    console.log(`[Proxy] Forwarding request to target URL: ${url} [Method: ${method}]`);

    const fetchOptions = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    let responseData;

    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Set status and return response from target
    return res.status(response.status).send(responseData);
  } catch (err) {
    console.error('[Proxy Error]:', err.message);
    return res.status(502).json({
      error: 'Failed to communicate with target server.',
      message: err.message
    });
  }
};
