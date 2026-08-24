#!/usr/bin/env node
/**
 * Smoke test for /api/invoices: auth, tenant scoping, totals consistency and
 * payment-status validation.
 * Usage: node scripts/smoke-invoices.cjs [baseUrl]
 */
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:3111";
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

async function call(method, url, cookie, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
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
  const res = await call("POST", "/api/admin/login", null, { email, password });
  return { status: res.status, cookie: res.cookie };
}

const results = [];
function check(label, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(44)} ${detail}`);
}

(async () => {
  check("no-auth GET /api/invoices", (await call("GET", "/api/invoices")).status === 401);

  const sup = await login(env.ADMIN_SUPER_EMAIL, env.ADMIN_SUPER_PASSWORD);
  check("super admin login", sup.status === 200 && Boolean(sup.cookie));
  check("super GET without ?client", (await call("GET", "/api/invoices", sup.cookie)).status === 400);

  const cli = await login("almahrusa@mken.live", seeds.almahrusa);
  check("client admin login (almahrusa)", cli.status === 200 && Boolean(cli.cookie));

  const base = await call("GET", "/api/invoices", cli.cookie);
  const totals = base.json?.totals;
  const shapeOk =
    base.status === 200 &&
    Array.isArray(base.json?.invoices) &&
    totals &&
    totals.invoices + totals.estimates === totals.count &&
    totals.paid + totals.unpaid === totals.invoices;
  check(
    "client GET returns invoices + consistent totals",
    shapeOk,
    shapeOk
      ? `count=${totals.count} invoices=${totals.invoices} estimates=${totals.estimates} revenue=${totals.revenue}`
      : `status=${base.status} message=${base.json?.message}`
  );

  const cross = await call("GET", "/api/invoices?client=demo", cli.cookie);
  check(
    "client cannot read another tenant",
    cross.status === 200 && cross.json?.tenant === "almahrusa",
    `tenant=${cross.json?.tenant}`
  );

  const noMetaLeak = (base.json?.invoices || []).every((inv) =>
    (inv.items || []).every((item) => item.isZatcaMeta !== true)
  );
  check("ZATCA meta is not exposed as an item", noMetaLeak);

  const fakeId = "00000000-0000-0000-0000-000000000000";
  check(
    "invalid payment status rejected",
    (await call("PATCH", `/api/invoices/${fakeId}`, cli.cookie, { paymentStatus: "free" }))
      .status === 400
  );
  check(
    "empty payload rejected",
    (await call("PATCH", `/api/invoices/${fakeId}`, cli.cookie, {})).status === 400
  );
  check(
    "unknown invoice id is 404",
    (await call("PATCH", `/api/invoices/${fakeId}`, cli.cookie, { paymentStatus: "paid" }))
      .status === 404
  );

  if (base.json?.tableMissing) {
    console.log(
      "NOTE  mken_invoices is not provisioned in this database; the module reports an empty state"
    );
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
