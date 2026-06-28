'use strict';

function pickEnvValue(names) {
  for (var i = 0; i < names.length; i++) {
    var val = process.env[names[i]];
    if (val) {
      var cleaned = String(val).trim().replace(/^['"]|['"]$/g, '').trim();
      if (cleaned && cleaned !== 'undefined' && cleaned !== 'null') {
        return cleaned;
      }
    }
  }
  return '';
}

function pickByPrefix(prefix) {
  var keys = Object.keys(process.env).filter(function (k) {
    return k.indexOf(prefix) === 0;
  });
  keys.sort();
  for (var i = 0; i < keys.length; i++) {
    var val = process.env[keys[i]];
    if (val && String(val).trim()) return String(val).trim();
  }
  return '';
}

function getSupabaseUrl() {
  return pickEnvValue([
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
  ]);
}

function getSupabaseAnonKey() {
  return pickEnvValue([
    'SUPABASE_KEY',
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_KEY',
  ]) || pickByPrefix('sb_publishable_');
}

function getSupabaseServiceKey() {
  return pickEnvValue([
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
  ]) || pickByPrefix('sb_secret_');
}

function hasSupabaseClientConfig() {
  return !!(getSupabaseUrl() && getSupabaseAnonKey());
}

function hasSupabaseServerConfig() {
  return !!(getSupabaseUrl() && getSupabaseServiceKey());
}

module.exports = {
  getSupabaseUrl: getSupabaseUrl,
  getSupabaseAnonKey: getSupabaseAnonKey,
  getSupabaseServiceKey: getSupabaseServiceKey,
  hasSupabaseClientConfig: hasSupabaseClientConfig,
  hasSupabaseServerConfig: hasSupabaseServerConfig,
};
