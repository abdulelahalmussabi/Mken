/**
 * Smoke & Automated Verification Test: Cloudflare for SaaS & Edge Multi-Tenant Routing
 * Runs diagnostic checks on domain provisioning logic, DoH live resolvers, and edge scoping.
 */

const { getRequiredCloudflareDnsRecords, getCloudflareConfig } = require("../src/lib/cloudflare/domains.ts");
const { extractTenantSlug } = require("../src/proxy.ts");

async function runDiagnostics() {
  console.log("===============================================================");
  console.log("🚀 [MKN SaaS] Starting Cloudflare for SaaS & Edge Routing Test");
  console.log("===============================================================\n");

  let passed = 0;
  let total = 0;

  function assert(title, condition, extra = "") {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${title} ${extra ? `(${extra})` : ""}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${extra ? `(${extra})` : ""}`);
    }
  }

  // 1. Test Proxy Edge Tenant Extraction
  console.log("1️⃣ Testing Edge Proxy Tenant Resolution (extractTenantSlug)...");
  
  assert("Custom Domain rewa.care -> rewa", extractTenantSlug("rewa.care") === "rewa");
  assert("Custom Domain rewa.cre -> rewa", extractTenantSlug("rewa.cre") === "rewa");
  assert("Subdomain rewa.mken.live -> rewa", extractTenantSlug("rewa.mken.live") === "rewa");
  assert("Subdomain almahrusa.mken.live -> almahrusa", extractTenantSlug("almahrusa.mken.live") === "almahrusa");
  assert("Subdomain almasabi.mken.live -> almasabi", extractTenantSlug("almasabi.mken.live") === "almasabi");
  assert("Reserved Subdomain admin.mken.live -> null", extractTenantSlug("admin.mken.live") === null);
  assert("Reserved Subdomain www.mken.live -> null", extractTenantSlug("www.mken.live") === null);
  assert("Reserved Subdomain cname.mken.live -> null", extractTenantSlug("cname.mken.live") === null);

  // 2. Test Cloudflare DNS Instructions
  console.log("\n2️⃣ Testing Cloudflare DNS Record Generation...");
  const apexRecords = getRequiredCloudflareDnsRecords("rewa.cre");
  assert("Apex Domain generates CNAME record", apexRecords.some(r => r.type === "CNAME" && r.value.includes("mken.live")));
  assert("Apex Domain generates Fallback A record", apexRecords.some(r => r.type === "A"));

  const subRecords = getRequiredCloudflareDnsRecords("portal.rewa.cre");
  assert("Subdomain generates CNAME record with sub-name", subRecords.some(r => r.type === "CNAME" && r.name === "portal"));

  // 3. Test Live DoH DNS Resolution
  console.log("\n3️⃣ Testing Cloudflare DNS-over-HTTPS (DoH) Live Lookup...");
  try {
    const fetch = globalThis.fetch || require("node-fetch");
    const testDomain = "mken.live";
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${testDomain}&type=A`, {
      headers: { accept: "application/dns-json" }
    });
    const data = await res.json();
    assert(`Live DNS query for ${testDomain} via Cloudflare DoH`, Array.isArray(data.Answer) && data.Answer.length > 0, `Status: ${data.Status}`);
  } catch (err) {
    console.warn("  ⚠️ [WARN] Live DNS fetch skipped or errored:", err.message);
  }

  console.log("\n===============================================================");
  console.log(`📊 Summary: ${passed}/${total} checks passed successfully.`);
  console.log("===============================================================\n");

  if (passed < total) {
    process.exit(1);
  }
}

runDiagnostics().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
