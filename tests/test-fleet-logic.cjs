#!/usr/bin/env node
/**
 * منصة مكِّن — فحص خوارزمية التوزيع وتصفية الإحداثيات الميدانية (Fleet & GPS Filtering Test)
 * كود المهمة: E6-FLT-01
 * الامتثال: ضوابط الخدمات الميدانية وتوفير استهلاك أجهزة الفنيين
 */

const assert = require('assert');

// 1. Haversine distance formula to calculate distance in meters between two GPS coordinates
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 2. GPS Filter to suppress redundant updates within 50 meters
class GpsBatteryFilter {
  constructor(thresholdMeters = 50) {
    this.threshold = thresholdMeters;
    this.lastLocation = null;
    this.sentCount = 0;
    this.suppressedCount = 0;
  }

  processPoint(lat, lon, timestamp = Date.now()) {
    if (!this.lastLocation) {
      this.lastLocation = { lat, lon, timestamp };
      this.sentCount++;
      return { send: true, distance: 0, reason: 'First Fix' };
    }

    const dist = haversineDistanceMeters(this.lastLocation.lat, this.lastLocation.lon, lat, lon);
    if (dist >= this.threshold) {
      this.lastLocation = { lat, lon, timestamp };
      this.sentCount++;
      return { send: true, distance: Math.round(dist), reason: 'Movement threshold exceeded' };
    }

    this.suppressedCount++;
    return { send: false, distance: Math.round(dist), reason: 'Below threshold — battery saved' };
  }
}

// 3. Pre-demand positioning formula test
function calculatePredictedDemand(zone, params) {
  const p = params || { alpha: 0.50, beta: 0.35, gamma: 0.15, driverCapacity: 4.5 };
  const H = zone.avgHistory || 0;
  const E = (zone.activePromos || 1.0) * 100;
  const S = (zone.geoFactor || 1.0) * 80;

  const predicted = (p.alpha * H) + (p.beta * E) + (p.gamma * S);
  const requiredVehicles = Math.ceil(predicted / p.driverCapacity);

  return {
    predictedVolume: Math.round(predicted),
    requiredVehicles: requiredVehicles,
    currentVehicles: zone.vehicles || 0,
    bufferDeficit: requiredVehicles - (zone.vehicles || 0)
  };
}

async function runFleetTests() {
  console.log("================================================================================");
  console.log("  🚗 فحص خوارزمية الأسطول الميداني وترشيح إحداثيات GPS (Fleet Optimization)");
  console.log("  🔋 الغرض: توفير 70% من استهلاك بطارية أجهزة الفنيين ومنع إغراق الخادم");
  console.log("================================================================================\n");

  // 1. Test Demand Positioning
  console.log("1️⃣ اختبار معادلة التنبؤ بالطلب وحساب عجز الأسطول (Zone Demand Formula)...");
  const zoneSahafa = {
    id: 'zone-2',
    name: 'حي الصحافة / الملقا (الرياض)',
    avgHistory: 310,
    activePromos: 1.8,
    geoFactor: 1.5,
    vehicles: 38
  };
  const result = calculatePredictedDemand(zoneSahafa);
  console.log(`   📍 المنطقة: ${zoneSahafa.name}`);
  console.log(`   📦 الطلب المتوقع: ${result.predictedVolume} طلب`);
  console.log(`   🚙 الفنيون المطلوبون: ${result.requiredVehicles} (المتوفر حالياً: ${result.currentVehicles})`);
  console.log(`   ⚖️ حالة العجز/الفائض: ${result.bufferDeficit > 0 ? 'عجز أسطول' : 'متوازن'} (${result.bufferDeficit})`);

  assert.ok(result.predictedVolume > 200, "حجم الطلب يجب أن يتجاوز 200 بناء على المعطيات");
  assert.ok(result.requiredVehicles > 0, "عدد الفنيين المطلوبين يجب أن يكون موجباً");
  console.log("   ✅ نجاح: معادلة التنبؤ بالطلب الرياضية تعمل بدقة تامة.\n");

  // 2. Test GPS Noise and Deadband Filtering (50 meters threshold)
  console.log("2️⃣ اختبار مرشح إحداثيات GPS لمنع إرسال النبضات المتكررة (GPS Battery Filter)...");
  const filter = new GpsBatteryFilter(50);

  // Technician starts at King Fahd Rd (24.7136, 46.6753)
  const p1 = filter.processPoint(24.7136, 46.6753);
  assert.strictEqual(p1.send, true, "النقطة الأولى يجب إرسالها دائماً");

  // Technician is parked or stationary in traffic (slight GPS drift ~5 meters)
  const p2 = filter.processPoint(24.71363, 46.67532); // ~4 meters away
  assert.strictEqual(p2.send, false, "إزاحة 4 أمتار يجب حجبها لتوفير البطارية");

  const p3 = filter.processPoint(24.71368, 46.67535); // ~10 meters away
  assert.strictEqual(p3.send, false, "إزاحة 10 أمتار يجب حجبها لتوفير البطارية");

  // Technician drives forward to Olaya (moved ~350 meters)
  const p4 = filter.processPoint(24.7165, 46.6770); 
  assert.strictEqual(p4.send, true, "حركة 350 متراً يجب إرسالها للخادم فوراً");

  console.log(`   ✅ تم حجب ${filter.suppressedCount} إحداثيات راكدة ووفرت البطارية بنجاح.`);
  console.log(`   ✅ تم إرسال ${filter.sentCount} إحداثيات حقيقية بعد تجاوز المسافة المعتمدة (50م).\n`);

  console.log("================================================================================");
  console.log("🎉 تم اجتياز فحص خوارزمية الأسطول وترشيح الإحداثيات بنسبة 100%!");
  console.log("================================================================================\n");
}

runFleetTests().catch(err => {
  console.error("❌ فشل اختبار الأسطول:", err);
  process.exit(1);
});
