#!/usr/bin/env node
/**
 * Smoke test for /api/orders: auth requirement, tenant scoping, status validation.
 * Usage: node scripts/smoke-orders.cjs [baseUrl]
 * Credentials are read from mkn-theme/.env.local and never printed.
 */
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:3105";
const ENV_PATH = path.join(__dirname, "..", "mkn-theme", ".env.local");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnv(ENV_PATH);
const seeds = JSON.parse(env.ADMIN_SEED_PASSWORDS || "{}");

async function call(method, url, cookie, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response */
  }
  const setCookie = res.headers.getSetCookie?.() || [];
  return {
    status: res.status,
    json,
    cookie: setCookie.map((c) => c.split(";")[0]).join("; "),
  };
}

async function login(email, password) {
  const res = await call("POST", "/api/admin/login", null, { email, password });
  return { status: res.status, cookie: res.cookie, role: res.json?.session?.role };
}

function report(label, res, expect) {
  const scope = res.json?.tenant ? ` tenant=${res.json.tenant}` : "";
  const count = Array.isArray(res.json?.orders) ? ` orders=${res.json.orders.length}` : "";
  const ok = res.status === expect ? "PASS" : "FAIL";
  console.log(
    `${ok}  ${label.padEnd(38)} => ${res.status} (expected ${expect})${scope}${count}`
  );
  return res.status === expect;
}

(async () => {
  const results = [];

  results.push(report("no-auth GET /api/orders", await call("GET", "/api/orders"), 401));

  const sup = await login(env.ADMIN_SUPER_EMAIL, env.ADMIN_SUPER_PASSWORD);
  console.log(
    `${sup.status === 200 && sup.cookie ? "PASS" : "FAIL"}  ${"super admin login".padEnd(38)} => ${sup.status} role=${sup.role}`
  );
  results.push(sup.status === 200 && Boolean(sup.cookie));

  results.push(
    report("super GET without ?client", await call("GET", "/api/orders", sup.cookie), 400)
  );
  const superScoped = await call("GET", "/api/orders?client=almahrusa", sup.cookie);
  results.push(report("super GET ?client=almahrusa", superScoped, 200));

  const cli = await login("almahrusa@mken.live", seeds.almahrusa);
  console.log(
    `${cli.status === 200 && cli.cookie ? "PASS" : "FAIL"}  ${"client admin login (almahrusa)".padEnd(38)} => ${cli.status} role=${cli.role}`
  );
  results.push(cli.status === 200 && Boolean(cli.cookie));

  const cross = await call("GET", "/api/orders?client=demo", cli.cookie);
  const isolated = cross.status === 200 && cross.json?.tenant === "almahrusa";
  console.log(
    `${isolated ? "PASS" : "FAIL"}  ${"client GET ?client=demo (isolation)".padEnd(38)} => ${cross.status} tenant=${cross.json?.tenant}`
  );
  results.push(isolated);

  const fakeId = "00000000-0000-0000-0000-000000000000";
  results.push(
    report(
      "client PATCH invalid status",
      await call("PATCH", `/api/orders/${fakeId}`, cli.cookie, { status: "hacked" }),
      400
    )
  );
  results.push(
    report(
      "client PATCH invalid paymentStatus",
      await call("PATCH", `/api/orders/${fakeId}`, cli.cookie, { paymentStatus: "free" }),
      400
    )
  );
  results.push(
    report("client PATCH empty body", await call("PATCH", `/api/orders/${fakeId}`, cli.cookie, {}), 400)
  );
  results.push(
    report(
      "client PATCH unknown order id",
      await call("PATCH", `/api/orders/${fakeId}`, cli.cookie, { status: "stitching" }),
      404
    )
  );

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
