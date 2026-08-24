#!/usr/bin/env node
/**
 * Smoke test for /api/whatsapp-logs: auth, tenant scoping, stats shape and
 * scoped deletion.
 * Usage: node scripts/smoke-messages.cjs [baseUrl]
 */
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:3110";
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

const env = loadEnv(ENV_PATH);
const seeds = JSON.parse(env.ADMIN_SEED_PASSWORDS || "{}");

async function call(method, url, cookie) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return {
    status: res.status,
    json,
    cookie: (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; "),
  };
}

async function login(email, password) {
  const res = await fetch(BASE + "/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return {
    status: res.status,
    cookie: (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; "),
  };
}

const results = [];
function check(label, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(44)} ${detail}`);
}

(async () => {
  check("no-auth GET /api/whatsapp-logs", (await call("GET", "/api/whatsapp-logs")).status === 401);

  const sup = await login(env.ADMIN_SUPER_EMAIL, env.ADMIN_SUPER_PASSWORD);
  check("super admin login", sup.status === 200 && Boolean(sup.cookie));
  check(
    "super GET without ?client",
    (await call("GET", "/api/whatsapp-logs", sup.cookie)).status === 400
  );

  const cli = await login("almahrusa@mken.live", seeds.almahrusa);
  check("client admin login (almahrusa)", cli.status === 200 && Boolean(cli.cookie));

  const base = await call("GET", "/api/whatsapp-logs", cli.cookie);
  const stats = base.json?.stats;
  const shapeOk =
    base.status === 200 &&
    Array.isArray(base.json?.logs) &&
    stats &&
    stats.outbound + stats.inbound === stats.total &&
    stats.success + stats.failed <= stats.outbound;
  check(
    "client GET returns logs + consistent stats",
    shapeOk,
    `total=${stats?.total} inbound=${stats?.inbound} outbound=${stats?.outbound} failed=${stats?.failed}`
  );

  const cross = await call("GET", "/api/whatsapp-logs?client=demo", cli.cookie);
  check(
    "client cannot read another tenant",
    cross.status === 200 && cross.json?.tenant === "almahrusa",
    `tenant=${cross.json?.tenant}`
  );

  const allSameTenant = (base.json?.logs || []).every((l) => l.tenantSlug === "almahrusa");
  check("all rows belong to the tenant", allSameTenant);

  const del = await call(
    "DELETE",
    "/api/whatsapp-logs/00000000-0000-0000-0000-000000000000",
    cli.cookie
  );
  check("delete of unknown id is 404", del.status === 404, `status=${del.status}`);

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
