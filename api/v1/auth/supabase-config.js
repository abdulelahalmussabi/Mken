const sbEnv = require('../../_lib/supabase-env');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseKey = sbEnv.getSupabaseAnonKey();

  return res.status(200).json({
    supabaseUrl,
    supabaseKey,
    enabled: sbEnv.hasSupabaseClientConfig(),
  });
};
