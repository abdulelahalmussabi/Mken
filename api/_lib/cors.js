function getSafeCorsOrigin(req) {
  const origin = req.headers.origin || req.headers.Origin;
  if (!origin) return 'https://mken.live';

  const trustedPattern = /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https?:\/\/([a-zA-Z0-9-]+\.)*mken\.(live|app|com))$/;
  if (trustedPattern.test(origin)) {
    return origin;
  }
  return 'https://mken.live';
}

function handleCors(req, res, allowedMethods = 'GET,OPTIONS,PATCH,DELETE,POST,PUT') {
  const origin = getSafeCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Admin-Pin'
  );
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = {
  getSafeCorsOrigin,
  handleCors
};
