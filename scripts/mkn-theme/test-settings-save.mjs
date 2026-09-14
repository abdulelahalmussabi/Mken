/**
 * Verify social-link URL building and the public /api/clients/rewa payload.
 * Usage: node scripts/test-settings-save.mjs [baseUrl]
 */
const BASE = process.argv[2] || process.env.MKEN_BASE_URL || "http://localhost:3120";

function stripAt(value) {
  return (value || "").trim().replace(/^@+/, "");
}

function buildSocialUrl(platformId, rawValue) {
  const value = (rawValue || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  switch (platformId) {
    case "whatsapp": {
      const digits = value.replace(/\D/g, "");
      return digits ? `https://wa.me/${digits}` : "";
    }
    case "instagram":
      return `https://instagram.com/${encodeURIComponent(stripAt(value))}`;
    case "tiktok":
      return `https://www.tiktok.com/@${encodeURIComponent(stripAt(value))}`;
    case "snapchat":
      return `https://www.snapchat.com/add/${encodeURIComponent(stripAt(value))}`;
    default:
      return "";
  }
}

const expected = {
  instagram: buildSocialUrl("instagram", "rewa.100000"),
  tiktok: buildSocialUrl("tiktok", "rewa.1000"),
  snapchat: buildSocialUrl("snapchat", "rewa.1000"),
  whatsapp: buildSocialUrl("whatsapp", "966549462524"),
};

let failed = 0;
function assert(ok, label, detail) {
  if (ok) {
    console.log(`  ok  ${label}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("1) URL builders");
assert(
  expected.instagram === "https://instagram.com/rewa.100000",
  "instagram rewa.100000",
  expected.instagram
);
assert(
  expected.tiktok === "https://www.tiktok.com/@rewa.1000",
  "tiktok rewa.1000",
  expected.tiktok
);
assert(
  expected.snapchat === "https://www.snapchat.com/add/rewa.1000",
  "snapchat rewa.1000",
  expected.snapchat
);
assert(
  expected.whatsapp === "https://wa.me/966549462524",
  "whatsapp 966549462524",
  expected.whatsapp
);

console.log(`\n2) GET ${BASE}/api/clients/rewa`);
const res = await fetch(`${BASE}/api/clients/rewa`, { cache: "no-store" });
const data = await res.json().catch(() => ({}));
assert(res.ok && data.success, "api success", `${res.status} ${data.message || ""}`);

const links = data.client?.socialLinks || {};
const extras = (data.contactExtras?.social || []).filter((row) => row.url);
const extraById = Object.fromEntries(extras.map((row) => [row.id, row.url]));

assert(Boolean(links.instagram || extraById.instagram), "instagram present");
assert(Boolean(links.tiktok || extraById.tiktok), "tiktok present");
assert(Boolean(links.snapchat || extraById.snapchat), "snapchat present");
assert(Boolean(links.whatsapp || extraById.whatsapp || data.client?.whatsapp), "whatsapp present");

const ig = links.instagram || extraById.instagram || "";
const tt = links.tiktok || extraById.tiktok || "";
const sn = links.snapchat || extraById.snapchat || "";
assert(ig.includes("rewa.100000"), "instagram handle", ig);
assert(tt.includes("rewa.1000"), "tiktok handle", tt);
assert(sn.includes("rewa.1000"), "snapchat handle", sn);

console.log(`\n${failed ? `${failed} failed` : "all checks passed"}`);
process.exit(failed ? 1 : 0);
