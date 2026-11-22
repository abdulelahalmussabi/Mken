import assert from "node:assert";
import {
  extractCoordinatesFromMapsUrl,
  extractPlaceIdFromMapsUrl,
  getCleanBusinessName,
  resolveCoordinates,
  resolveMapEmbedSrc,
  resolveGoogleMapsUrl,
} from "../src/lib/mken/location-resolver.ts";

console.log("--- Testing TenantLocationSection URL Builders ---");

// Test 1: Coordinate extraction from various Google Maps URLs
{
  const url1 = "https://www.google.com/maps/@24.4672,39.6111,16z";
  const coords1 = extractCoordinatesFromMapsUrl(url1);
  assert.deepStrictEqual(coords1, { lat: 24.4672, lng: 39.6111 }, "Should extract @lat,lng");

  const url2 = "https://www.google.com/maps/place/Data/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d24.46624!4d39.550085";
  const coords2 = extractCoordinatesFromMapsUrl(url2);
  assert.deepStrictEqual(coords2, { lat: 24.46624, lng: 39.550085 }, "Should extract !3dlat!4dlng");

  const url3 = "https://maps.google.com/?q=24.4789,39.5532";
  const coords3 = extractCoordinatesFromMapsUrl(url3);
  assert.deepStrictEqual(coords3, { lat: 24.4789, lng: 39.5532 }, "Should extract ?q=lat,lng");
  console.log("✓ Test 1: Coordinate extraction passed");
}

// Test 2: Clean Business Name (no الفرع الرئيسي)
{
  assert.strictEqual(getCleanBusinessName("منتجع رواء الاستشفاء الرقمي", "الفرع الرئيسي"), "منتجع رواء الاستشفاء الرقمي");
  assert.strictEqual(getCleanBusinessName("الفرع الرئيسي", "منتجع رواء الاستشفاء الرقمي"), "منتجع رواء الاستشفاء الرقمي");
  assert.strictEqual(getCleanBusinessName("", "صالون النخبة"), "صالون النخبة");
  console.log("✓ Test 2: Clean business name passed");
}

// Test 3: Priority 1 (Exact Coordinates lat & lng)
{
  const location = {
    businessName: "منتجع رواء الاستشفاء الرقمي",
    lat: 24.46624,
    lng: 39.550085,
    city: "المدينة المنورة",
    district: "الجماوات",
  };

  const embedSrc = resolveMapEmbedSrc(location);
  assert.strictEqual(
    embedSrc,
    "https://maps.google.com/maps?q=24.46624,39.550085&hl=ar&z=16&output=embed",
    "Embed iframe must strictly match Priority 1 format with hl=ar&z=16&output=embed"
  );

  const directionsUrl = resolveGoogleMapsUrl(location);
  assert.strictEqual(
    directionsUrl,
    "https://www.google.com/maps/search/?api=1&query=24.46624,39.550085",
    "Directions link must strictly match Priority 1 format"
  );

  // With placeId
  const locationWithPlaceId = {
    ...location,
    placeId: "ChIJ123456789",
  };
  const directionsUrlWithPlace = resolveGoogleMapsUrl(locationWithPlaceId);
  assert.strictEqual(
    directionsUrlWithPlace,
    "https://www.google.com/maps/search/?api=1&query=24.46624,39.550085&query_place_id=ChIJ123456789"
  );
  console.log("✓ Test 3: Priority 1 (Exact Coordinates) passed");
}

// Test 4: Priority 1 via coordinates extracted from googleMapsUrl
{
  const location = {
    businessName: "منتجع رواء الاستشفاء الرقمي",
    googleMapsUrl: "https://maps.google.com/?q=24.4789,39.5532",
    city: "المدينة المنورة",
    district: "الجماوات",
  };

  const embedSrc = resolveMapEmbedSrc(location);
  assert.strictEqual(
    embedSrc,
    "https://maps.google.com/maps?q=24.4789,39.5532&hl=ar&z=16&output=embed",
    "Embed iframe should extract coordinates from URL if not stored separately"
  );
  console.log("✓ Test 4: Coordinates extracted from googleMapsUrl passed");
}

// Test 5: Priority 2 (No coordinates, fallback to businessName + district/city, NOT الفرع الرئيسي)
{
  const location = {
    name: "الفرع الرئيسي",
    businessName: "منتجع رواء الاستشفاء الرقمي",
    city: "المدينة المنورة",
    district: "الجماوات",
  };

  const embedSrc = resolveMapEmbedSrc(location, "منتجع رواء الاستشفاء الرقمي");
  assert(
    !embedSrc.includes(encodeURIComponent("الفرع الرئيسي")),
    "Embed query MUST NOT contain 'الفرع الرئيسي'"
  );
  assert(
    embedSrc.includes(encodeURIComponent("منتجع رواء الاستشفاء الرقمي الجماوات المدينة المنورة")),
    "Embed query MUST contain real business name + district + city"
  );
  assert(
    embedSrc.endsWith("&hl=ar&z=16&output=embed"),
    "Embed query must end with &hl=ar&z=16&output=embed"
  );

  const directionsUrl = resolveGoogleMapsUrl(location, "منتجع رواء الاستشفاء الرقمي");
  assert(
    !directionsUrl.includes(encodeURIComponent("الفرع الرئيسي")),
    "Directions link MUST NOT contain 'الفرع الرئيسي'"
  );
  assert(
    directionsUrl.includes(encodeURIComponent("منتجع رواء الاستشفاء الرقمي المدينة المنورة")),
    "Directions link MUST contain real business name + city"
  );
  console.log("✓ Test 5: Priority 2 businessName + district/city passed");
}

// Test 6: Stored googleMapsUrl preservation (when valid)
{
  const location = {
    businessName: "منتجع رواء الاستشفاء الرقمي",
    googleMapsUrl: "https://maps.app.goo.gl/LMtjeaD2SKHfdMYV8",
    lat: 24.46624,
    lng: 39.550085,
    city: "المدينة المنورة",
  };

  const directionsUrl = resolveGoogleMapsUrl(location);
  assert.strictEqual(
    directionsUrl,
    "https://maps.app.goo.gl/LMtjeaD2SKHfdMYV8",
    "Should preserve exact verified maps.app.goo.gl link for directions"
  );

  // But embed iframe still uses exact coordinates for iframe compatibility!
  const embedSrc = resolveMapEmbedSrc(location);
  assert.strictEqual(
    embedSrc,
    "https://maps.google.com/maps?q=24.46624,39.550085&hl=ar&z=16&output=embed",
    "Embed iframe must use exact coordinates even when googleMapsUrl is a shortlink"
  );
  console.log("✓ Test 6: Stored googleMapsUrl preservation passed");
}

// Test 7: Discarding broken generic search in googleMapsUrl
{
  const location = {
    businessName: "منتجع رواء الاستشفاء الرقمي",
    googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=الفرع%20الرئيسي",
    lat: 24.46624,
    lng: 39.550085,
    city: "المدينة المنورة",
  };

  const directionsUrl = resolveGoogleMapsUrl(location);
  assert.strictEqual(
    directionsUrl,
    "https://www.google.com/maps/search/?api=1&query=24.46624,39.550085",
    "Should discard broken generic الفرع الرئيسي query in googleMapsUrl and use exact coords"
  );
  console.log("✓ Test 7: Generic query discard passed");
}

// Test 8: Real rewa.care tenant data resolution
{
  const rewaTenant = {
    name: "منتجع رواء الاستشفاء الرقمي",
    city: "المدينة المنورة",
    district: "الجماوات",
    latitude: 24.46624,
    longitude: 39.550085,
    googleMapsUrl: "https://maps.app.goo.gl/LMtjeaD2SKHfdMYV8",
  };

  const embedSrc = resolveMapEmbedSrc(rewaTenant, "منتجع رواء الاستشفاء الرقمي");
  assert.strictEqual(
    embedSrc,
    "https://maps.google.com/maps?q=24.46624,39.550085&hl=ar&z=16&output=embed",
    "rewa embed iframe must pin exact registered coordinates (24.46624, 39.550085) with Arabic and z=16"
  );

  const directions = resolveGoogleMapsUrl(rewaTenant, "منتجع رواء الاستشفاء الرقمي");
  assert.strictEqual(
    directions,
    "https://maps.app.goo.gl/LMtjeaD2SKHfdMYV8",
    "rewa directions link must use exact verified maps.app.goo.gl link"
  );
  console.log("✓ Test 8: Real rewa.care tenant data resolution passed");
}

// Test 9: Real demo.mken.live (multi-branch salon) resolution
{
  const businessName = "صالون النخبة";
  const branches = [
    {
      id: "demo-rabie",
      name: "فرع حي الربيع (الرئيسي)",
      city: "الرياض",
      district: "حي الربيع",
      latitude: 24.7922,
      longitude: 46.6572,
    },
    {
      id: "demo-narjis",
      name: "فرع حي النرجس",
      city: "الرياض",
      district: "حي النرجس",
      latitude: 24.8431,
      longitude: 46.6821,
    },
    {
      id: "demo-takhassusi",
      name: "فرع التخصصي",
      city: "الرياض",
      district: "حي المعذر / التخصصي",
      latitude: 24.6872,
      longitude: 46.6711,
    },
  ];

  // Branch 1
  const b1 = branches[0];
  const b1Title = `${businessName} — ${b1.name}`;
  const b1Embed = resolveMapEmbedSrc(b1, businessName);
  assert.strictEqual(b1Title, "صالون النخبة — فرع حي الربيع (الرئيسي)");
  assert.strictEqual(b1Embed, "https://maps.google.com/maps?q=24.7922,46.6572&hl=ar&z=16&output=embed");

  // Branch 2
  const b2 = branches[1];
  const b2Title = `${businessName} — ${b2.name}`;
  const b2Embed = resolveMapEmbedSrc(b2, businessName);
  assert.strictEqual(b2Title, "صالون النخبة — فرع حي النرجس");
  assert.strictEqual(b2Embed, "https://maps.google.com/maps?q=24.8431,46.6821&hl=ar&z=16&output=embed");

  // Branch 3
  const b3 = branches[2];
  const b3Title = `${businessName} — ${b3.name}`;
  const b3Embed = resolveMapEmbedSrc(b3, businessName);
  assert.strictEqual(b3Title, "صالون النخبة — فرع التخصصي");
  assert.strictEqual(b3Embed, "https://maps.google.com/maps?q=24.6872,46.6711&hl=ar&z=16&output=embed");

  console.log("✓ Test 9: Real demo.mken.live multi-branch resolution passed");
}

console.log("\nALL TESTS PASSED SUCCESSFULLY! 🎉");
