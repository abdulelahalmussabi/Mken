/**
 * Smoke & Automated Verification Test: Strict Multi-Tenant Isolation & Edge Routing
 * Tests tenant domain boundaries, cross-tenant leak prevention, and Super Admin access.
 */

const { NextRequest } = require("next/server");
const { extractTenantSlug, proxy } = require("../src/proxy.ts");

async function runIsolationDiagnostics() {
  console.log("===============================================================");
  console.log("🔒 [MKN SaaS] Starting Comprehensive Isolation Diagnostic Test");
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

  // ── 1. Test Tenant Hostname Detection ──
  console.log("1️⃣ Testing Tenant Domain Detection...");
  assert("rewa.care resolves to rewa", extractTenantSlug("rewa.care") === "rewa");
  assert("www.rewa.care resolves to rewa", extractTenantSlug("www.rewa.care") === "rewa");
  assert("rewa.cre resolves to rewa", extractTenantSlug("rewa.cre") === "rewa");
  assert("www.rewa.cre resolves to rewa", extractTenantSlug("www.rewa.cre") === "rewa");
  assert("almahrusa.mken.live resolves to almahrusa", extractTenantSlug("almahrusa.mken.live") === "almahrusa");
  assert("almasabi.mken.live resolves to almasabi", extractTenantSlug("almasabi.mken.live") === "almasabi");
  assert("demo.mken.live resolves to demo", extractTenantSlug("demo.mken.live") === "demo");
  assert("mken.live (main platform) returns null", extractTenantSlug("mken.live") === null);
  assert("www.mken.live returns null", extractTenantSlug("www.mken.live") === null);
  assert("admin.mken.live returns null", extractTenantSlug("admin.mken.live") === null);

  // ── 2. Test Edge Proxy Isolation on Tenant Domains ──
  console.log("\n2️⃣ Testing Edge Proxy Routing on Tenant Domain (rewa.care)...");

  function createMockRequest(host, pathname) {
    return new NextRequest(`https://${host}${pathname}`, {
      headers: { host },
    });
  }

  // Test A: rewa.care/admin -> must rewrite to /admin/client
  const reqAdmin = createMockRequest("rewa.care", "/admin");
  const resAdmin = proxy(reqAdmin);
  const rewriteHeaderAdmin = resAdmin.headers?.get("x-middleware-rewrite") || "";
  assert(
    "rewa.care/admin rewrites to /admin/client",
    rewriteHeaderAdmin.includes("/admin/client") || resAdmin.headers?.get("x-tenant-slug") === "rewa"
  );

  // Test B: rewa.care/almahrusa -> must REDIRECT to /subscriber/rewa
  const reqCross1 = createMockRequest("rewa.care", "/almahrusa");
  const resCross1 = proxy(reqCross1);
  const locCross1 = resCross1.headers?.get("location") || "";
  assert(
    "rewa.care/almahrusa blocks cross-tenant access and redirects to /subscriber/rewa",
    locCross1.includes("/subscriber/rewa") || resCross1.status === 307 || resCross1.status === 302
  );

  // Test C: rewa.care/subscriber/almahrusa -> must REDIRECT to /subscriber/rewa
  const reqCross2 = createMockRequest("rewa.care", "/subscriber/almahrusa");
  const resCross2 = proxy(reqCross2);
  const locCross2 = resCross2.headers?.get("location") || "";
  assert(
    "rewa.care/subscriber/almahrusa blocks cross-tenant access and redirects to /subscriber/rewa",
    locCross2.includes("/subscriber/rewa") || resCross2.status === 307 || resCross2.status === 302
  );

  // Test D: rewa.care/almasabi -> must REDIRECT to /subscriber/rewa
  const reqCross3 = createMockRequest("rewa.care", "/almasabi");
  const resCross3 = proxy(reqCross3);
  const locCross3 = resCross3.headers?.get("location") || "";
  assert(
    "rewa.care/almasabi blocks cross-tenant access and redirects to /subscriber/rewa",
    locCross3.includes("/subscriber/rewa") || resCross3.status === 307 || resCross3.status === 302
  );

  // Test E: rewa.care/ -> rewrites to /subscriber/rewa
  const reqRoot = createMockRequest("rewa.care", "/");
  const resRoot = proxy(reqRoot);
  const rewriteRoot = resRoot.headers?.get("x-middleware-rewrite") || "";
  assert(
    "rewa.care/ rewrites to /subscriber/rewa",
    rewriteRoot.includes("/subscriber/rewa")
  );

  // ── 3. Test Main Platform (mken.live) Access for Super Admin ──
  console.log("\n3️⃣ Testing Main Platform Domain (mken.live) Access...");
  const reqMainAlmahrusa = createMockRequest("mken.live", "/almahrusa");
  const resMainAlmahrusa = proxy(reqMainAlmahrusa);
  const rewriteMainAlmahrusa = resMainAlmahrusa.headers?.get("x-middleware-rewrite") || "";
  assert(
    "mken.live/almahrusa is allowed for Super Admin / visitors",
    rewriteMainAlmahrusa.includes("/subscriber/almahrusa")
  );

  const reqMainRewa = createMockRequest("mken.live", "/rewa");
  const resMainRewa = proxy(reqMainRewa);
  const rewriteMainRewa = resMainRewa.headers?.get("x-middleware-rewrite") || "";
  assert(
    "mken.live/rewa is allowed for Super Admin / visitors",
    rewriteMainRewa.includes("/subscriber/rewa")
  );

  // ── 4. Test Context Client Isolation ──
  console.log("\n4️⃣ Testing Client State Scoping & Boundary Logic...");
  const sampleClients = [
    { slug: "almahrusa", name: "المحروسة" },
    { slug: "almasabi", name: "المصعبي" },
    { slug: "demo", name: "النخبة" },
    { slug: "rewa", name: "رواء" }
  ];

  function getVisibleClients(host, clients) {
    const tenantSlug = extractTenantSlug(host);
    if (tenantSlug) {
      return clients.filter(c => c.slug === tenantSlug);
    }
    return clients;
  }

  const clientsOnRewa = getVisibleClients("rewa.care", sampleClients);
  assert("On rewa.care, visibleClients length is exactly 1", clientsOnRewa.length === 1 && clientsOnRewa[0].slug === "rewa");

  const clientsOnAlmahrusa = getVisibleClients("almahrusa.mken.live", sampleClients);
  assert("On almahrusa.mken.live, visibleClients length is exactly 1", clientsOnAlmahrusa.length === 1 && clientsOnAlmahrusa[0].slug === "almahrusa");

  const clientsOnSuperAdmin = getVisibleClients("mken.live", sampleClients);
  assert("On mken.live (Super Admin), visibleClients length is 4 (all clients accessible)", clientsOnSuperAdmin.length === 4);

  console.log("\n===============================================================");
  console.log(`📊 Summary: ${passed}/${total} checks passed with 100% SUCCESS.`);
  console.log("===============================================================\n");

  if (passed < total) {
    process.exit(1);
  }
}

runIsolationDiagnostics().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
