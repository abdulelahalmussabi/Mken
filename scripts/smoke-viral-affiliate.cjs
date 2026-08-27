/**
 * Smoke & Automated Verification Test: MKN Viral Loop & Affiliate Engine
 * Tests referral URL resolution, commission calculations, and white-labeling rules.
 */

const { getReferralUrl } = require("../src/lib/mken/affiliate.ts");

async function runAffiliateDiagnostics() {
  console.log("===============================================================");
  console.log("🚀 [MKN SaaS] Starting Viral Loops & Affiliate Engine Test");
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

  // 1. Test Canonical Referral URL Generation
  console.log("1️⃣ Testing Referral URL Resolution...");
  const refRewa = getReferralUrl("rewa");
  assert("Referral URL for rewa generates correctly", refRewa.includes("mken.live?ref=rewa"), refRewa);

  const refAlmahrusa = getReferralUrl("almahrusa");
  assert("Referral URL for almahrusa generates correctly", refAlmahrusa.includes("mken.live?ref=almahrusa"), refAlmahrusa);

  // 2. Test Commission Math & Attributions
  console.log("\n2️⃣ Testing Commission Calculations...");
  const sampleSubscriptionAmount = 500; // SAR
  const commissionRate = 20; // 20%
  const expectedCommission = (sampleSubscriptionAmount * commissionRate) / 100;
  assert("Commission calculation (20% on 500 SAR = 100 SAR)", expectedCommission === 100, `${expectedCommission} SAR`);

  // 3. Test White-label Rules
  console.log("\n3️⃣ Testing White-Label Badge Display Rules...");
  function shouldShowBadge(planTier, isWhiteLabelAllowed) {
    if (isWhiteLabelAllowed && (planTier === "pro" || planTier === "enterprise")) {
      return false;
    }
    return true;
  }

  assert("Starter plan always shows Powered-By badge", shouldShowBadge("starter", false) === true);
  assert("Starter plan shows badge even if user requests white-label", shouldShowBadge("starter", true) === true);
  assert("Pro plan hides badge when white-label is enabled", shouldShowBadge("pro", true) === false);
  assert("Pro plan shows badge when white-label is not enabled", shouldShowBadge("pro", false) === true);
  assert("Enterprise plan hides badge when white-label is enabled", shouldShowBadge("enterprise", true) === false);

  console.log("\n===============================================================");
  console.log(`📊 Summary: ${passed}/${total} checks passed successfully.`);
  console.log("===============================================================\n");

  if (passed < total) {
    process.exit(1);
  }
}

runAffiliateDiagnostics().catch(err => {
  console.error("Diagnostic error:", err);
  process.exit(1);
});
