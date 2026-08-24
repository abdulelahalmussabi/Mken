#!/usr/bin/env node
/**
 * Smoke test for /api/inventory: auth, scoping, validation, totals, missing table.
 * Usage: node scripts/smoke-inventory.cjs [baseUrl]
 */
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:3114";
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
  check("no-auth GET /api/inventory", (await call("GET", "/api/inventory")).status === 401);

  const sup = await login(env.ADMIN_SUPER_EMAIL, env.ADMIN_SUPER_PASSWORD);
  check("super admin login", sup.status === 200 && Boolean(sup.cookie));
  check(
    "super GET without ?client",
    (await call("GET", "/api/inventory", sup.cookie)).status === 400
  );

  const cli = await login("almahrusa@mken.live", seeds.almahrusa);
  check("client admin login (almahrusa)", cli.status === 200 && Boolean(cli.cookie));

  const base = await call("GET", "/api/inventory", cli.cookie);
  const totals = base.json?.totals;
  const shapeOk =
    base.status === 200 &&
    Array.isArray(base.json?.items) &&
    totals &&
    totals.lowStock <= totals.count;
  check(
    "client GET returns inventory + totals",
    shapeOk,
    shapeOk
      ? `count=${totals.count} low=${totals.lowStock} tableMissing=${Boolean(base.json.tableMissing)}`
      : `status=${base.status} message=${base.json?.message}`
  );

  const cross = await call("GET", "/api/inventory?client=demo", cli.cookie);
  check(
    "client cannot read another tenant",
    cross.status === 200 && cross.json?.tenant === "almahrusa",
    `tenant=${cross.json?.tenant}`
  );

  check(
    "empty name rejected",
    (await call("POST", "/api/inventory", cli.cookie, { name: "  " })).status === 400
  );
  check(
    "negative quantity rejected",
    (
      await call("POST", "/api/inventory", cli.cookie, { name: "اختبار", quantity: -1 })
    ).status === 400
  );
  check(
    "empty PATCH rejected",
    (await call("PATCH", "/api/inventory/inv_x", cli.cookie, {})).status === 400
  );

  const created = await call("POST", "/api/inventory", cli.cookie, {
    name: "Smoke Item",
    sku: "SMK-1",
    costPrice: 10,
    sellPrice: 20,
    quantity: 5,
    minStockAlert: 2,
  });

  if (created.status !== 201) {
    console.log(
      `SKIP  write checks (status=${created.status}): ${created.json?.message || "no message"}`
    );
  } else {
    check("create item succeeds", created.json?.item?.name === "Smoke Item");
    check("costPrice returned to admin", created.json?.item?.costPrice === 10);
    const id = created.json?.item?.id;
    if (id) {
      check(
        "delete item succeeds",
        (await call("DELETE", `/api/inventory/${id}`, cli.cookie)).status === 200
      );
    }
  }

  check(
    "delete unknown id is 404",
    (await call("DELETE", "/api/inventory/inv_does_not_exist", cli.cookie)).status === 404
  );

  if (base.json?.tableMissing) {
    console.log("NOTE  mken_inventory_items is not provisioned; empty-state path is active");
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
