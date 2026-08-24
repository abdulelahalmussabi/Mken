#!/usr/bin/env node
/**
 * Smoke test for /api/settings: auth, tenant scoping, validation rules and a
 * read/write/restore round-trip on the tenant identity settings.
 * Usage: node scripts/smoke-settings.cjs [baseUrl]
 */
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:3108";
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
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${detail}`);
}

(async () => {
  check("no-auth GET /api/settings", (await call("GET", "/api/settings")).status === 401);

  const sup = await login(env.ADMIN_SUPER_EMAIL, env.ADMIN_SUPER_PASSWORD);
  check("super admin login", sup.status === 200 && Boolean(sup.cookie));
  check("super GET without ?client", (await call("GET", "/api/settings", sup.cookie)).status === 400);

  const cli = await login("almahrusa@mken.live", seeds.almahrusa);
  check("client admin login (almahrusa)", cli.status === 200 && Boolean(cli.cookie));

  const base = await call("GET", "/api/settings", cli.cookie);
  const original = base.json?.settings;
  const shapeOk =
    base.status === 200 &&
    original &&
    typeof original.brand?.name === "string" &&
    Object.keys(original.social || {}).length === 9 &&
    Object.keys(original.emails || {}).length === 3 &&
    typeof original.serviceArea?.radiusKm === "number";
  check(
    "client GET resolves settings",
    shapeOk,
    `brand="${original?.brand?.name}" city=${original?.serviceArea?.city} social=${Object.keys(original?.social || {}).length}`
  );

  if (!shapeOk) {
    console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
    process.exit(1);
  }

  const cross = await call("GET", "/api/settings?client=demo", cli.cookie);
  check(
    "client cannot read another tenant",
    cross.status === 200 && cross.json?.tenant === "almahrusa",
    `tenant=${cross.json?.tenant}`
  );

  check(
    "empty brand name rejected",
    (await call("PUT", "/api/settings", cli.cookie, { brand: { name: "  " } })).status === 400
  );
  check(
    "invalid phone rejected",
    (await call("PUT", "/api/settings", cli.cookie, { phone: "12" })).status === 400
  );
  check(
    "invalid email rejected",
    (
      await call("PUT", "/api/settings", cli.cookie, {
        emails: { inquiries: { enabled: true, value: "not-an-email" } },
      })
    ).status === 400
  );
  check(
    "enabled social without value rejected",
    (
      await call("PUT", "/api/settings", cli.cookie, {
        social: { instagram: { enabled: true, value: "" } },
      })
    ).status === 400
  );
  check(
    "out-of-range latitude rejected",
    (
      await call("PUT", "/api/settings", cli.cookie, {
        serviceArea: { center: { lat: 999, lng: 39 } },
      })
    ).status === 400
  );
  check("empty payload rejected", (await call("PUT", "/api/settings", cli.cookie, {})).status === 400);

  const marker = `smoke-${Date.now()}`;
  const written = await call("PUT", "/api/settings", cli.cookie, {
    serviceArea: { ...original.serviceArea, coverageNote: marker },
  });

  if (written.status !== 200 && /صلاحية/.test(written.json?.message || "")) {
    console.log(
      `SKIP  write round-trip: the configured Supabase key has no write access (${written.json.message})`
    );
    const failedEarly = results.filter((r) => !r).length;
    console.log(`\n${results.length - failedEarly}/${results.length} checks passed (writes skipped)`);
    process.exit(failedEarly ? 1 : 0);
  }

  check(
    "write persists a field",
    written.status === 200 && written.json?.settings?.serviceArea?.coverageNote === marker
  );

  const reread = await call("GET", "/api/settings", cli.cookie);
  check(
    "re-read returns the written value",
    reread.json?.settings?.serviceArea?.coverageNote === marker
  );
  check(
    "unrelated fields untouched",
    reread.json?.settings?.brand?.name === original.brand.name &&
      reread.json?.settings?.phone === original.phone &&
      reread.json?.settings?.serviceArea?.city === original.serviceArea.city
  );

  const restored = await call("PUT", "/api/settings", cli.cookie, {
    brand: original.brand,
    phone: original.phone,
    heroImage: original.heroImage,
    social: original.social,
    emails: original.emails,
    serviceArea: original.serviceArea,
  });
  check(
    "original settings restored",
    restored.status === 200 &&
      JSON.stringify(restored.json?.settings?.serviceArea) ===
        JSON.stringify(original.serviceArea) &&
      JSON.stringify(restored.json?.settings?.social) === JSON.stringify(original.social),
    `coverageNote="${restored.json?.settings?.serviceArea?.coverageNote}"`
  );

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
