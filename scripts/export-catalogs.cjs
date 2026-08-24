#!/usr/bin/env node
/**
 * Exports the legacy browser catalogs (js/activities-catalog.js,
 * js/services-catalog.js) into JSON consumed by mkn-theme, so the catalog has a
 * single source of truth. Re-run after editing either catalog file.
 *
 * Usage: node scripts/export-catalogs.cjs
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "mkn-theme", "src", "data", "catalog");

const SOURCES = [
  { file: "js/activities-catalog.js", global: "MkenActivitiesCatalog", out: "activities.json" },
  { file: "js/services-catalog.js", global: "MkenServicesCatalog", out: "services.json" },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const sandbox = { window: {} };
vm.createContext(sandbox);

for (const source of SOURCES) {
  const code = fs.readFileSync(path.join(ROOT, source.file), "utf8");
  vm.runInContext(code, sandbox, { filename: source.file });

  const data = sandbox.window[source.global];
  if (!Array.isArray(data) || data.length === 0) {
    console.error(`FAIL ${source.file}: window.${source.global} is not a non-empty array`);
    process.exit(1);
  }

  const target = path.join(OUT_DIR, source.out);
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`${source.out}: ${data.length} entries`);
}

const services = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "services.json"), "utf8"));
const activities = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "activities.json"), "utf8"));
const activityIds = new Set(activities.map((a) => a.id));
const orphans = services.filter((s) => !activityIds.has(s.activityId)).map((s) => s.id);

if (orphans.length) {
  console.warn(`WARN services with unknown activityId: ${orphans.join(", ")}`);
}

const missing = [];
for (const activity of activities) {
  for (const id of activity.serviceIds || []) {
    if (!services.some((s) => s.id === id)) missing.push(`${activity.id}/${id}`);
  }
}
if (missing.length) {
  console.warn(`WARN activity serviceIds with no catalog entry: ${missing.join(", ")}`);
}
