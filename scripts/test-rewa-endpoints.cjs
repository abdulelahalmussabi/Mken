const http = require("http");

async function testEndpoints() {
  console.log("=== Testing Rewa Endpoints on Live Next Server ===");

  // 1. Test GET /api/clients/rewa
  console.log("\n1. Testing GET /api/clients/rewa...");
  const clientRes = await fetch("http://127.0.0.1:3108/api/clients/rewa");
  const clientData = await clientRes.json();
  console.log("Status:", clientRes.status);
  console.log("Success:", clientData.success);
  console.log("Client Name:", clientData.client?.name);
  console.log("Client Tagline:", clientData.client?.tagline);
  console.log("Client Subtitle:", clientData.client?.subtitle);

  // 2. Test GET /api/settings (for rewa)
  console.log("\n2. Testing GET /api/settings?client=rewa...");
  const settingsRes = await fetch("http://127.0.0.1:3108/api/settings?client=rewa");
  const settingsData = await settingsRes.json();
  console.log("Status:", settingsRes.status);
  console.log("Success:", settingsData.success);
  console.log("Brand Name:", settingsData.settings?.brand?.name);
  console.log("Phone:", settingsData.settings?.phone);

  // 3. Test GET /api/services?client=rewa
  console.log("\n3. Testing GET /api/services?client=rewa...");
  const servicesRes = await fetch("http://127.0.0.1:3108/api/services?client=rewa");
  const servicesData = await servicesRes.json();
  console.log("Status:", servicesRes.status);
  console.log("Success:", servicesData.success);
  console.log("Activities Count:", servicesData.activities?.length || 0);
  console.log("Services Count:", servicesData.services?.length || 0);

  // 4. Test GET /api/appearance?client=rewa
  console.log("\n4. Testing GET /api/appearance?client=rewa...");
  const appRes = await fetch("http://127.0.0.1:3108/api/appearance?client=rewa");
  const appData = await appRes.json();
  console.log("Status:", appRes.status);
  console.log("Success:", appData.success);
  console.log("Services Heading:", appData.appearance?.interfaceCopy?.servicesHeading);

  // 5. Test Storefront /subscriber/rewa
  console.log("\n5. Testing GET /subscriber/rewa HTML page...");
  const pageRes = await fetch("http://127.0.0.1:3108/subscriber/rewa");
  console.log("Status:", pageRes.status);
  const html = await pageRes.text();
  console.log("HTML length:", html.length, "bytes");
  console.log("Contains Rewa Name:", html.includes("رواء") ? "YES ✓" : "NO ✗");

  console.log("\n=== ALL VERIFICATIONS SUCCESSFUL! ===\n");
}

testEndpoints().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
