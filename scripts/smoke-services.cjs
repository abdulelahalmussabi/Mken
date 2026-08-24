#!/usr/bin/env node
/**
 * Smoke test for /api/services: auth, tenant scoping, catalog resolution and
 * the pruning rules (no enabled service under a disabled activity).
 * Usage: node scripts/smoke-services.cjs [baseUrl]
 */
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:3107";
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
  check("no-auth GET /api/services", (await call("GET", "/api/services")).status === 401);

  const sup = await login(env.ADMIN_SUPER_EMAIL, env.ADMIN_SUPER_PASSWORD);
  check("super admin login", sup.status === 200 && Boolean(sup.cookie));
  check(
    "super GET without ?client",
    (await call("GET", "/api/services", sup.cookie)).status === 400
  );

  const cli = await login("almahrusa@mken.live", seeds.almahrusa);
  check("client admin login (almahrusa)", cli.status === 200 && Boolean(cli.cookie));

  const base = await call("GET", "/api/services", cli.cookie);
  const catalogOk =
    base.status === 200 &&
    Array.isArray(base.json?.activities) &&
    base.json.activities.length > 20 &&
    Array.isArray(base.json?.services) &&
    base.json.services.length > 100;
  check(
    "client GET resolves full catalog",
    catalogOk,
    `activities=${base.json?.activities?.length} services=${base.json?.services?.length} tenant=${base.json?.tenant}`
  );

  if (!catalogOk) {
    console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
    process.exit(1);
  }

  const cross = await call("GET", "/api/services?client=demo", cli.cookie);
  check(
    "client cannot read another tenant",
    cross.status === 200 && cross.json?.tenant === "almahrusa",
    `tenant=${cross.json?.tenant}`
  );

  const enabledActivities = base.json.activities.filter((a) => a.enabled).map((a) => a.id);
  const enabledServices = base.json.services.filter((s) => s.enabled).map((s) => s.id);
  console.log(
    `      current: activities=[${enabledActivities.join(", ")}] services=[${enabledServices.join(", ")}] featured=${base.json.featuredService}`
  );

  const firstWrite = await call("PUT", "/api/services", cli.cookie, {
    enabledActivities: [...enabledActivities, "not-a-real-activity"],
    enabled: enabledServices,
  });

  if (firstWrite.status !== 200 && /صلاحية/.test(firstWrite.json?.message || "")) {
    console.log(
      `SKIP  write checks: the configured Supabase key has no write access (${firstWrite.json.message})`
    );
    const failedEarly = results.filter((r) => !r).length;
    console.log(`\n${results.length - failedEarly}/${results.length} checks passed (writes skipped)`);
    process.exit(failedEarly ? 1 : 0);
  }

  check(
    "unknown ids are rejected on save",
    firstWrite.json?.activities?.some((a) => a.id === "not-a-real-activity") !== true
  );

  const pruned = await call("PUT", "/api/services", cli.cookie, {
    enabledActivities: [],
    enabled: enabledServices,
  });
  check(
    "services pruned when activity disabled",
    pruned.status === 200 && pruned.json.services.every((s) => !s.enabled),
    `enabled=${pruned.json?.services?.filter((s) => s.enabled).length}`
  );

  const restored = await call("PUT", "/api/services", cli.cookie, {
    enabledActivities,
    enabled: enabledServices,
    featuredActivity: base.json.featuredActivity,
    featured: base.json.featuredService,
  });
  const sameActivities =
    restored.json?.activities?.filter((a) => a.enabled).map((a) => a.id).join(",") ===
    enabledActivities.join(",");
  const sameServices =
    restored.json?.services?.filter((s) => s.enabled).map((s) => s.id).join(",") ===
    enabledServices.join(",");
  check(
    "original state restored",
    restored.status === 200 && sameActivities && sameServices,
    `featured=${restored.json?.featuredService}`
  );

  check(
    "empty payload rejected",
    (await call("PUT", "/api/services", cli.cookie, {})).status === 400
  );
  check(
    "bad enabledActivities type rejected",
    (await call("PUT", "/api/services", cli.cookie, { enabledActivities: "hotels" })).status === 400
  );

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
