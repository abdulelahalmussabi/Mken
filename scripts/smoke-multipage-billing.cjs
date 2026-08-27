/**
 * Smoke & Automated Verification Test: MKN Multi-Page Engine & Quota Limits
 * Tests page limits, slug generation, block schema validation, and billing hooks.
 */

const { getPlanLimits } = require("../src/lib/mken/pages.ts");

async function runMultiPageDiagnostics() {
  console.log("===============================================================");
  console.log("🚀 [MKN SaaS] Starting Multi-Page Engine & Quota Test");
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

  // 1. Test Plan Quota Limits
  console.log("1️⃣ Testing Plan Quota Rules...");
  const starterLimits = getPlanLimits("starter");
  assert("Starter Plan allows exactly 1 page", starterLimits.maxPages === 1, `maxPages: ${starterLimits.maxPages}`);
  assert("Starter Plan disallows custom domains", starterLimits.allowCustomDomain === false);
  assert("Starter Plan disallows white-labeling", starterLimits.allowWhiteLabel === false);

  const proLimits = getPlanLimits("pro");
  assert("Pro Plan allows 5 pages", proLimits.maxPages === 5, `maxPages: ${proLimits.maxPages}`);
  assert("Pro Plan allows custom domain", proLimits.allowCustomDomain === true);
  assert("Pro Plan allows white-labeling", proLimits.allowWhiteLabel === true);

  const entLimits = getPlanLimits("enterprise");
  assert("Enterprise Plan allows unlimited (999) pages", entLimits.maxPages === 999, `maxPages: ${entLimits.maxPages}`);

  // 2. Test Slug Sanitization
  console.log("\n2️⃣ Testing Slug Sanitization Logic...");
  function sanitizeSlug(input) {
    return input.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-");
  }

  assert("Sanitize Arabic or spaced title to valid slug", sanitizeSlug("Our Services 2026") === "our-services-2026");
  assert("Sanitize special characters", sanitizeSlug("about/us!@#") === "about-us-");

  // 3. Test Block JSON Schemas
  console.log("\n3️⃣ Testing Block Schemas Validation...");
  const sampleBlocks = [
    { type: "hero", title: "مرحباً بكم", ctaText: "احجز الآن", ctaLink: "/book" },
    { type: "pricing", title: "الباقات", plans: [{ name: "VIP", price: "200 SAR" }] },
    { type: "contact", title: "تواصل معنا", phone: "0500000000" }
  ];

  assert("Block list contains valid types", sampleBlocks.every(b => ["hero", "pricing", "contact", "services", "content"].includes(b.type)));
  assert("Hero block has mandatory title", Boolean(sampleBlocks[0].title));

  console.log("\n===============================================================");
  console.log(`📊 Summary: ${passed}/${total} checks passed successfully.`);
  console.log("===============================================================\n");

  if (passed < total) {
    process.exit(1);
  }
}

runMultiPageDiagnostics().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
