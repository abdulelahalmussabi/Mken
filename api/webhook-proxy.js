const dns = require('dns').promises;
const { URL } = require('url');
const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./_lib/supabase-env');
const { getSafeCorsOrigin } = require('./_lib/cors');

module.exports = async function handler(req, res) {
  // 1. Set CORS headers dynamically
  const origin = getSafeCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
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

  const { url, method = 'POST', headers = {}, body, tenant } = req.body || {};

  if (!url) {
    return res.status(400).json({ error: 'Missing target "url" in request body.' });
  }

  // SSRF Mitigation: Validate URL and protocol
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid target "url" format.' });
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return res.status(403).json({ error: 'Only HTTP and HTTPS protocols are allowed.' });
  }

  const hostname = parsedUrl.hostname;

  // Block localhost/loopback directly
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return res.status(403).json({ error: 'Access to loopback/localhost is forbidden.' });
  }

  // DNS Resolution IP checks to block private IP ranges
  let ips = [];
  try {
    const addresses = await dns.resolve(hostname).catch(() => []);
    if (addresses.length > 0) {
      ips = addresses;
    } else {
      const lookup = await dns.lookup(hostname).catch(() => null);
      if (lookup && lookup.address) {
        ips.push(lookup.address);
      }
    }
  } catch (dnsErr) {
    console.warn(`[Proxy DNS Warning]: Failed to resolve ${hostname}: ${dnsErr.message}`);
  }

  const isPrivateIp = (ip) => {
    // IPv4 private/loopback/link-local/multicast ranges
    if (/^(127\.|10\.|172\.(16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31)\.|192\.168\.|169\.254\.)/.test(ip)) return true;
    // IPv6 loopback/link-local/unique local/site local ranges
    if (ip === '::1' || ip === 'fe80::' || ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:') || ip.startsWith('fec0:')) return true;
    return false;
  };

  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      return res.status(403).json({ error: 'Access to private or local networks is forbidden.' });
    }
  }

  // Tenant URL verification check
  const isMeta = url.startsWith('https://graph.facebook.com');
  if (!isMeta) {
    const tenantSlug = (tenant || 'default').trim().toLowerCase();
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseServiceKey = sbEnv.getSupabaseServiceKey();

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { data: clientRow } = await supabase
          .from('mken_saas_clients')
          .select('config_data')
          .eq('tenant_slug', tenantSlug)
          .maybeSingle();

        if (clientRow && clientRow.config_data) {
          const config = clientRow.config_data;
          const wa = config.whatsappApi || {};
          const normalize = (u) => String(u || '').trim().toLowerCase().replace(/\/+$/, '');
          const allowedUrl = normalize(wa.url);
          const targetUrlNorm = normalize(url);

          if (allowedUrl !== targetUrlNorm) {
            return res.status(403).json({ error: 'Target URL is not authorized for this tenant.' });
          }
        } else {
          return res.status(403).json({ error: 'Tenant configuration not found. Access denied.' });
        }
      } catch (dbErr) {
        console.error('[Proxy DB Error]:', dbErr.message);
        return res.status(500).json({ error: 'Failed to verify target URL authorization.' });
      }
    }
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

    return res.status(response.status).send(responseData);
  } catch (err) {
    console.error('[Proxy Error]:', err.message);
    return res.status(502).json({
      error: 'Failed to communicate with target server.',
      message: err.message
    });
  }
};
