#!/usr/bin/env node
/**
 * Read-only probe of mken_orders: which tenant_slug values exist and how many
 * rows each has, so migrated admin pages can be validated against real data.
 * Usage: node scripts/probe-orders-table.cjs
 */
const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", "mkn-theme", ".env.local");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

const env = { ...loadEnv(ENV_PATH), ...process.env };
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL / key");
  process.exit(1);
}

(async () => {
  const res = await fetch(
    `${url}/rest/v1/mken_orders?select=tenant_slug,status,activity_id,created_at&order=created_at.desc&limit=200`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );

  if (!res.ok) {
    console.error(`SELECT failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const rows = await res.json();
  console.log(`rows fetched: ${rows.length}`);

  const byTenant = new Map();
  for (const row of rows) {
    const slug = row.tenant_slug || "(null)";
    if (!byTenant.has(slug)) byTenant.set(slug, { count: 0, statuses: new Set(), activities: new Set() });
    const entry = byTenant.get(slug);
    entry.count += 1;
    entry.statuses.add(row.status || "(null)");
    if (row.activity_id) entry.activities.add(row.activity_id);
  }

  for (const [slug, info] of byTenant) {
    console.log(
      `  ${slug}: ${info.count} orders | statuses: ${[...info.statuses].join(", ")} | activities: ${[...info.activities].join(", ") || "-"}`
    );
  }
})();
