const { fetchTenantRow, updateTenant, fetchTenants } = require("../mkn-theme/src/lib/mken/tenant");
const { fetchTenantSettings, updateTenantSettings } = require("../mkn-theme/src/lib/mken/settings");
const { fetchAppearance, updateAppearance } = require("../mkn-theme/src/lib/mken/appearance");
const { fetchTenantCatalog, updateTenantCatalog } = require("../mkn-theme/src/lib/mken/catalog");

async function runFullVerification() {
  console.log("==================================================");
  console.log("  Running Full Multi-Tenant & Settings Verification");
  console.log("==================================================");

  // 1. Verify Interface Titles
  console.log("\n[1/4] Testing Interface Titles (العناوين الرئيسية والفرعية)...");
  const tenantRes = await updateTenant("rewa", {
    name: "منتجع رواء الاستشفاء الرقمي",
    tagline: "رواء.. توازن واسترخاء",
    subtitle: "منتجع استشفائي صحي متكامل يجمع بين خدمات الطب العام والتجميل ونادي الدفاع عن النفس",
  });
  if (tenantRes.error) {
    console.error("❌ Failed to update tenant titles:", tenantRes.error);
    process.exit(1);
  }
  console.log("✅ Success! Title updated to:", tenantRes.client.name);
  console.log("   Tagline:", tenantRes.client.tagline);

  // 2. Verify Services & Catalog
  console.log("\n[2/4] Testing Services & Catalog (الأنشطة والخدمات)...");
  const catalogRes = await fetchTenantCatalog("rewa");
  if (catalogRes.error) {
    console.error("❌ Failed to fetch catalog:", catalogRes.error);
    process.exit(1);
  }
  console.log(`✅ Success! Catalog loaded: ${catalogRes.catalog.activities.length} activities, ${catalogRes.catalog.services.length} services.`);
  
  const updateCatRes = await updateTenantCatalog("rewa", {
    featuredActivity: catalogRes.catalog.activities[0]?.id,
  });
  if (updateCatRes.error) {
    console.error("❌ Failed to update catalog:", updateCatRes.error);
    process.exit(1);
  }
  console.log("✅ Success! Catalog updated without errors.");

  // 3. Verify Interface Phrases & Appearance
  console.log("\n[3/4] Testing Interface Copy (العبارات أسفل الخدمات)...");
  const appRes = await updateAppearance("rewa", {
    interfaceCopy: {
      servicesHeading: "باقات وخدمات الاستشفاء الرقمي",
      servicesIntro: "اختر الباقة المناسبة لتجربة استشفائية متكاملة",
      servicesFooter: "كافة الباقات تشمل الاستشارة الطبية المبدئية المجانية",
    },
  });
  if (appRes.error) {
    console.error("❌ Failed to update appearance:", appRes.error);
    process.exit(1);
  }
  console.log("✅ Success! Heading updated to:", appRes.appearance.interfaceCopy.servicesHeading);

  // 4. Verify Facility Settings & Social Channels
  console.log("\n[4/4] Testing Facility Settings & Social Channels (الهوية ووسائل التواصل)...");
  const settingsRes = await updateTenantSettings("rewa", {
    brand: {
      name: "منتجع رواء الاستشفاء الرقمي",
      tagline: "رواء.. توازن واسترخاء",
      logo: "assets/rewa-logo.png",
    },
    phone: "966543530333",
    social: {
      whatsapp: { enabled: true, value: "966543530333" },
      twitter: { enabled: true, value: "rewa_care" },
      tiktok: { enabled: true, value: "rewa.care" },
      instagram: { enabled: true, value: "rewa.care" },
    },
  });
  if (settingsRes.error) {
    console.error("❌ Failed to update settings:", settingsRes.error);
    process.exit(1);
  }
  console.log("✅ Success! Facility settings updated:");
  console.log("   Phone:", settingsRes.settings.phone);
  console.log("   WhatsApp:", settingsRes.settings.social.whatsapp.value);
  console.log("   X (Twitter):", settingsRes.settings.social.twitter.value);
  console.log("   TikTok:", settingsRes.settings.social.tiktok.value);

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED! ZERO DATABASE ERRORS ENCOUNTERED");
  console.log("==================================================\n");
}

runFullVerification().catch((err) => {
  console.error("Verification Error:", err);
  process.exit(1);
});
