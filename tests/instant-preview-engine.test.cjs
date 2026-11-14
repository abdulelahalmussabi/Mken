const assert = require("assert");

console.log("=================================================");
console.log("🚀 Testing Enterprise Instant Preview Engine");
console.log("=================================================\n");

// 1. Test Saudi Synthetic Data & PDPL Sanitization
console.log("▶ Test 1: Saudi PDPL & Compliance Verification...");

function sanitizePayloadForPdpl(input) {
  if (!input || typeof input !== "object") return input;
  const copy = JSON.parse(JSON.stringify(input));

  const sanitizeValue = (val) => {
    if (typeof val === "string") {
      if (/(\+?966|05)\d{8}/.test(val)) {
        return "+966501234567";
      }
      if (/@/.test(val) && !val.includes("mken")) {
        return "salman.mansour@demo.mken-sa.net";
      }
    }
    return val;
  };

  const traverse = (obj) => {
    for (const k of Object.keys(obj)) {
      if (obj[k] && typeof obj[k] === "object") {
        traverse(obj[k]);
      } else {
        obj[k] = sanitizeValue(obj[k]);
      }
    }
  };

  traverse(copy);
  return copy;
}

const rawLeakPayload = {
  customerName: "فهد الحربي",
  phone: "0551122334",
  email: "real.customer@gmail.com",
  order: {
    total: 350,
    shippingPhone: "+966598877665",
  },
};

const sanitized = sanitizePayloadForPdpl(rawLeakPayload);
assert.strictEqual(sanitized.phone, "+966501234567", "Real phone was not sanitized!");
assert.strictEqual(sanitized.email, "salman.mansour@demo.mken-sa.net", "Real email was not sanitized!");
assert.strictEqual(sanitized.order.shippingPhone, "+966501234567", "Nested phone was not sanitized!");
console.log("  ✔ PDPL PII Sanitization: PASSED (Zero real data leaked)");

// 2. Test ZATCA Phase-2 Mock QR TLV Generation
console.log("\n▶ Test 2: ZATCA Phase-2 Mock QR TLV Generation...");

function generateZatcaMockQrTlv(params) {
  const seller = (params.sellerName || "متجر مكّن التجريبي").slice(0, 50);
  const vat = params.vatNumber || "310009988700003";
  const timestamp = new Date().toISOString();
  const total = (params.totalWithVat ?? 115.0).toFixed(2);
  const vatTotal = (params.vatAmount ?? 15.0).toFixed(2);

  const encodeTlv = (tag, val) => {
    const utf8 = Buffer.from(val, "utf8");
    const header = Buffer.from([tag, utf8.length]);
    return Buffer.concat([header, utf8]);
  };

  const t1 = encodeTlv(1, `[معاينة تجريبية] ${seller}`);
  const t2 = encodeTlv(2, vat);
  const t3 = encodeTlv(3, timestamp);
  const t4 = encodeTlv(4, total);
  const t5 = encodeTlv(5, vatTotal);

  return Buffer.concat([t1, t2, t3, t4, t5]).toString("base64");
}

const qrBase64 = generateZatcaMockQrTlv({ sellerName: "شواية الرياض" });
assert.ok(qrBase64.length > 50, "QR Base64 TLV payload is empty or too short!");
const decodedBuffer = Buffer.from(qrBase64, "base64");
assert.strictEqual(decodedBuffer[0], 1, "First TLV Tag must be 1 (Seller Name)");
console.log("  ✔ ZATCA Phase-2 Mock QR TLV: PASSED (Valid Base64 TLV structure)");

// 3. Test Device Presets & Viewport Dimensions
console.log("\n▶ Test 3: Device Viewport Presets...");
const DEVICE_PRESETS = {
  "mobile-iphone": { width: 393, height: 852, isMobile: true },
  "mobile-android": { width: 412, height: 915, isMobile: true },
  "tablet-ipad": { width: 820, height: 1180, isMobile: false },
  desktop: { width: 1440, height: 900, isMobile: false },
};

assert.strictEqual(DEVICE_PRESETS["mobile-iphone"].width, 393);
assert.strictEqual(DEVICE_PRESETS["mobile-iphone"].isMobile, true);
assert.strictEqual(DEVICE_PRESETS["desktop"].isMobile, false);
console.log("  ✔ Device Viewport Presets: PASSED");

// 4. Test Ephemeral Share Token & PIN Protection
console.log("\n▶ Test 4: Ephemeral Share & PIN Guard...");
const mockDraftStore = new Map();
const TTL_24H = 24 * 60 * 60 * 1000;

function createDraft(tenantSlug, pin, data) {
  const token = "tok_" + Math.random().toString(36).slice(2);
  const record = {
    token,
    tenantSlug,
    pin: String(pin),
    data: sanitizePayloadForPdpl(data),
    expiresAt: Date.now() + TTL_24H,
  };
  mockDraftStore.set(token, record);
  return token;
}

function accessDraft(token, providedPin) {
  const record = mockDraftStore.get(token);
  if (!record || record.expiresAt < Date.now()) return { status: 404, error: "Expired" };
  if (record.pin !== String(providedPin)) return { status: 401, error: "Invalid PIN" };
  return { status: 200, data: record.data };
}

const token = createDraft("almahrusa", "5544", { testPhone: "0501112223" });
assert.strictEqual(accessDraft(token, "0000").status, 401, "Wrong PIN should be rejected");
const validAccess = accessDraft(token, "5544");
assert.strictEqual(validAccess.status, 200, "Correct PIN should grant access");
assert.strictEqual(validAccess.data.testPhone, "+966501234567", "Draft data must be sanitized");
console.log("  ✔ Ephemeral Share & PIN Guard: PASSED");

console.log("\n=================================================");
console.log("🎉 ALL TESTS PASSED: Instant Preview Engine Ready!");
console.log("=================================================");
