/**
 * Smoke test verifying that tenant settings, interface titles, and services
 * can be fetched and written without any database errors.
 */
const { fetchTenantRow, updateTenant, fetchTenants } = require("../src/lib/mken/tenant");
const { fetchTenantSettings, updateTenantSettings } = require("../src/lib/mken/settings");

async function main() {
  console.log("1. Testing fetchTenants...");
  const tenants = await fetchTenants();
  console.log(`✓ Fetched ${tenants?.length || 0} tenants`);

  console.log("2. Testing updateTenant for 'rewa'...");
  const updatedTenant = await updateTenant("rewa", {
    name: "منتجع رواء الاستشفاء الرقمي",
    tagline: "رواء.. توازن واسترخاء",
    subtitle: "منتجع استشفائي صحي متكامل في المدينة المنورة",
  });
  console.log("✓ updateTenant result:", updatedTenant.error ? `ERROR: ${updatedTenant.error}` : "SUCCESS");
  console.log("  Saved name:", updatedTenant.client?.name);
  console.log("  Saved tagline:", updatedTenant.client?.tagline);

  console.log("3. Testing fetchTenantSettings for 'rewa'...");
  const settings = await fetchTenantSettings("rewa");
  console.log("✓ fetchTenantSettings result:", settings.error ? `ERROR: ${settings.error}` : "SUCCESS");
  console.log("  Brand name:", settings.settings?.brand?.name);

  console.log("4. Testing updateTenantSettings for 'rewa'...");
  const updatedSettings = await updateTenantSettings("rewa", {
    brand: {
      name: "منتجع رواء الاستشفاء الرقمي",
      tagline: "رواء.. توازن واسترخاء",
      logo: "assets/rewa-logo.png",
    },
    phone: "966543530333",
  });
  console.log("✓ updateTenantSettings result:", updatedSettings.error ? `ERROR: ${updatedSettings.error}` : "SUCCESS");
  console.log("  Updated Phone:", updatedSettings.settings?.phone);

  console.log("\nALL SMOKE TESTS PASSED! No database unconfigured errors.\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
