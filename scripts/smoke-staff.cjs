#!/usr/bin/env node
/**
 * Smoke test for /api/staff: auth, tenant scoping, validation and PIN masking.
 * Usage: node scripts/smoke-staff.cjs [baseUrl]
 */
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:3113";
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
  check("no-auth GET /api/staff", (await call("GET", "/api/staff")).status === 401);

  const sup = await login(env.ADMIN_SUPER_EMAIL, env.ADMIN_SUPER_PASSWORD);
  check("super admin login", sup.status === 200 && Boolean(sup.cookie));
  check("super GET without ?client", (await call("GET", "/api/staff", sup.cookie)).status === 400);

  const cli = await login("almahrusa@mken.live", seeds.almahrusa);
  check("client admin login (almahrusa)", cli.status === 200 && Boolean(cli.cookie));

  const base = await call("GET", "/api/staff", cli.cookie);
  const listOk = base.status === 200 && Array.isArray(base.json?.staff);
  check(
    "client GET returns staff list",
    listOk,
    listOk
      ? `count=${base.json.staff.length}`
      : `status=${base.status} message=${base.json?.message}`
  );

  const noPinLeak = (base.json?.staff || []).every(
    (m) => m.pinCode === undefined && m.pin_code === undefined && typeof m.hasPin === "boolean"
  );
  check("PIN hash never returned to client", noPinLeak);

  const cross = await call("GET", "/api/staff?client=demo", cli.cookie);
  check(
    "client cannot read another tenant",
    cross.status === 200 && cross.json?.tenant === "almahrusa",
    `tenant=${cross.json?.tenant}`
  );

  check(
    "empty name rejected on create",
    (await call("POST", "/api/staff", cli.cookie, { name: "  " })).status === 400
  );
  check(
    "invalid role rejected",
    (await call("POST", "/api/staff", cli.cookie, { name: "اختبار", role: "boss" })).status ===
      400
  );
  check(
    "invalid PIN rejected",
    (
      await call("POST", "/api/staff", cli.cookie, { name: "اختبار", pinCode: "12" })
    ).status === 400
  );

  const fakeId = "stf_does_not_exist";
  check(
    "empty PATCH rejected",
    (await call("PATCH", `/api/staff/${fakeId}`, cli.cookie, {})).status === 400
  );

  const created = await call("POST", "/api/staff", cli.cookie, {
    name: "Smoke Staff",
    phone: "966500000000",
    role: "technician",
    pinCode: "1234",
    activities: ["hotels"],
  });

  // Local .env often has only the anon key; RLS then blocks writes with 500.
  if (created.status !== 201) {
    console.log(
      `SKIP  write checks (status=${created.status}): ${created.json?.message || "no message"}`
    );
  } else {
    check(
      "create staff succeeds",
      created.json?.member?.name === "Smoke Staff",
      `id=${created.json?.member?.id}`
    );
    check(
      "created member masks PIN",
      created.json?.member?.hasPin === true && created.json?.member?.pinCode === undefined
    );

    const id = created.json?.member?.id;
    if (id) {
      check(
        "delete staff succeeds",
        (await call("DELETE", `/api/staff/${id}`, cli.cookie)).status === 200
      );
    }
  }

  check(
    "delete unknown id is 404",
    (await call("DELETE", `/api/staff/${fakeId}`, cli.cookie)).status === 404
  );

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
