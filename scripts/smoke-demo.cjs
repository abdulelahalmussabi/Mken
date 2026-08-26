#!/usr/bin/env node
/**
 * Run the Next.js admin/API smoke checks against the demo tenant
 * (صالون النخبة / demo@mken.live). Write tests restore original values.
 * Usage: node scripts/smoke-demo.cjs [baseUrl]
 */
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:3114";
const ENV_PATH = path.join(__dirname, "..", "mkn-theme", ".env.local");
const TENANT = "demo";
const EMAIL = "demo@mken.live";
const OTHER = "almahrusa";

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
  return { status: res.status, cookie: res.cookie, json: res.json };
}

const results = [];
function check(label, ok, detail = "") {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)} ${detail}`);
}

(async () => {
  console.log(`demo smoke against ${BASE}\n`);

  check("no-auth GET /api/settings", (await call("GET", "/api/settings")).status === 401);
  check("no-auth GET /api/services", (await call("GET", "/api/services")).status === 401);
  check("no-auth GET /api/appearance", (await call("GET", "/api/appearance")).status === 401);
  check("no-auth GET /api/staff", (await call("GET", "/api/staff")).status === 401);
  check("no-auth GET /api/invoices", (await call("GET", "/api/invoices")).status === 401);
  check("no-auth GET /api/inventory", (await call("GET", "/api/inventory")).status === 401);
  check("no-auth GET /api/orders", (await call("GET", "/api/orders")).status === 401);
  check("no-auth GET /api/whatsapp-logs", (await call("GET", "/api/whatsapp-logs")).status === 401);

  const demo = await login(EMAIL, seeds.demo);
  check("demo client login", demo.status === 200 && Boolean(demo.cookie), `status=${demo.status}`);
  if (!demo.cookie) {
    console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
    process.exit(1);
  }
  const c = demo.cookie;

  const settings = await call("GET", "/api/settings", c);
  check(
    "GET /api/settings tenant=demo",
    settings.status === 200 && settings.json?.tenant === TENANT,
    `tenant=${settings.json?.tenant} brand="${settings.json?.settings?.brand?.name || ""}"`
  );

  const crossSettings = await call("GET", `/api/settings?client=${OTHER}`, c);
  check(
    "demo cannot read another tenant (settings)",
    crossSettings.status === 200 && crossSettings.json?.tenant === TENANT,
    `tenant=${crossSettings.json?.tenant}`
  );

  const services = await call("GET", "/api/services", c);
  check(
    "GET /api/services catalog",
    services.status === 200 &&
      services.json?.tenant === TENANT &&
      Array.isArray(services.json?.activities) &&
      Array.isArray(services.json?.services),
    `tenant=${services.json?.tenant} activities=${services.json?.activities?.length} services=${services.json?.services?.length}`
  );

  const staff = await call("GET", "/api/staff", c);
  check(
    "GET /api/staff",
    staff.status === 200 && Array.isArray(staff.json?.staff) && staff.json?.tenant === TENANT,
    `count=${staff.json?.staff?.length} tenant=${staff.json?.tenant}`
  );

  const invoices = await call("GET", "/api/invoices", c);
  check(
    "GET /api/invoices",
    invoices.status === 200 && Array.isArray(invoices.json?.invoices),
    `status=${invoices.status} count=${invoices.json?.invoices?.length}`
  );

  const inventory = await call("GET", "/api/inventory", c);
  check(
    "GET /api/inventory",
    inventory.status === 200 && (Array.isArray(inventory.json?.items) || Array.isArray(inventory.json?.inventory)),
    `status=${inventory.status}`
  );

  const orders = await call("GET", "/api/orders", c);
  check(
    "GET /api/orders",
    orders.status === 200 && Array.isArray(orders.json?.orders),
    `status=${orders.status} count=${orders.json?.orders?.length}`
  );

  const logs = await call("GET", "/api/whatsapp-logs", c);
  check(
    "GET /api/whatsapp-logs",
    logs.status === 200 && Array.isArray(logs.json?.logs),
    `status=${logs.status} count=${logs.json?.logs?.length}`
  );

  const appearance = await call("GET", "/api/appearance", c);
  check(
    "GET /api/appearance",
    appearance.status === 200 && Boolean(appearance.json?.appearance),
    `status=${appearance.status}`
  );

  const publicBefore = await call("GET", `/api/clients/${TENANT}`);
  check(
    "public GET /api/clients/demo",
    publicBefore.status === 200 && publicBefore.json?.success && publicBefore.json?.client?.slug === TENANT,
    `source=${publicBefore.json?.source} name="${publicBefore.json?.client?.name || ""}"`
  );

  const originalCopy = appearance.json?.appearance?.interfaceCopy || {};
  const originalClient = publicBefore.json?.client || {};
  const marker = `demo-smoke-${Date.now()}`;

  const titles = await call("PUT", `/api/clients/${TENANT}`, c, {
    name: originalClient.name || "صالون النخبة",
    tagline: marker,
    subtitle: originalClient.subtitle || "",
  });
  check(
    "PUT titles (tagline marker)",
    titles.status === 200 && titles.json?.success,
    `status=${titles.status} ${titles.json?.message || ""}`
  );

  const phrases = await call("PUT", "/api/appearance", c, {
    interfaceCopy: {
      servicesHeading: marker,
      servicesIntro: originalCopy.servicesIntro || "",
      servicesFooter: originalCopy.servicesFooter || "",
    },
  });
  check(
    "PUT appearance phrases (heading marker)",
    phrases.status === 200 && phrases.json?.appearance?.interfaceCopy?.servicesHeading === marker,
    `status=${phrases.status} ${phrases.json?.message || ""}`
  );

  const publicAfter = await call("GET", `/api/clients/${TENANT}`);
  check(
    "homepage payload shows saved titles",
    publicAfter.json?.client?.tagline === marker,
    `tagline="${publicAfter.json?.client?.tagline || ""}" source=${publicAfter.json?.source}`
  );
  check(
    "homepage payload shows saved phrases",
    publicAfter.json?.appearance?.interfaceCopy?.servicesHeading === marker,
    `heading="${publicAfter.json?.appearance?.interfaceCopy?.servicesHeading || ""}"`
  );

  const restoreTitles = await call("PUT", `/api/clients/${TENANT}`, c, {
    name: originalClient.name || "صالون النخبة",
    tagline: originalClient.tagline || "",
    subtitle: originalClient.subtitle || "",
  });
  check("restore demo titles", restoreTitles.status === 200 && restoreTitles.json?.success);

  const restorePhrases = await call("PUT", "/api/appearance", c, {
    interfaceCopy: {
      servicesHeading: originalCopy.servicesHeading || "",
      servicesIntro: originalCopy.servicesIntro || "",
      servicesFooter: originalCopy.servicesFooter || "",
    },
  });
  check(
    "restore demo phrases",
    restorePhrases.status === 200 &&
      (restorePhrases.json?.appearance?.interfaceCopy?.servicesHeading || "") ===
        (originalCopy.servicesHeading || "")
  );

  const originalNote = settings.json?.settings?.serviceArea?.coverageNote;
  if (settings.status === 200 && settings.json?.settings?.serviceArea) {
    const written = await call("PUT", "/api/settings", c, {
      serviceArea: { ...settings.json.settings.serviceArea, coverageNote: marker },
    });
    if (written.status !== 200 && /صلاحية/.test(written.json?.message || "")) {
      console.log(`SKIP  settings write: ${written.json.message}`);
    } else {
      check(
        "settings write persists",
        written.status === 200 && written.json?.settings?.serviceArea?.coverageNote === marker
      );
      const restored = await call("PUT", "/api/settings", c, {
        serviceArea: settings.json.settings.serviceArea,
      });
      check(
        "restore demo settings note",
        restored.status === 200 &&
          restored.json?.settings?.serviceArea?.coverageNote === originalNote
      );
    }
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
