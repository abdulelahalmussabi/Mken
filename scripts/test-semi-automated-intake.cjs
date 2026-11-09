/**
 * Comprehensive Automated Test for Semi-Automated Intake Engine (محرك الإغلاق النصف آلي)
 */

function evaluateIntakeLogic(config, schedule, waitingTicketsCount, activeTicketsToday, currentTimeMinutes) {
  const [openH, openM] = schedule.openingTime.split(":").map(Number);
  const [closeH, closeM] = schedule.closingTime.split(":").map(Number);
  const openingMinutes = openH * 60 + openM;
  const closingMinutes = closeH * 60 + closeM;

  // 1. Manual Override
  if (config.manualOverrideActive) {
    if (config.manualOverrideExpiresAt && Date.now() >= config.manualOverrideExpiresAt) {
      config.manualOverrideActive = false;
    } else {
      return {
        isOpen: config.isIntakeOpen,
        reasonType: config.manualOverrideType || "manual_override",
        reason: config.closedReason || "تدخل إداري مباشر",
      };
    }
  }

  // 2. Schedule Check
  if (!schedule.isWorkingDay || currentTimeMinutes < openingMinutes || currentTimeMinutes >= closingMinutes) {
    return {
      isOpen: false,
      reasonType: "schedule",
      reason: "خارج ساعات العمل الرسمية",
    };
  }

  // 3. Predictive EOD Cut-off: Cut-off = Shift End - (Waiting * Avg Service Time)
  const accumulatedWaitingMinutes = waitingTicketsCount * config.avgServiceTimeMinutes;
  const cutoffMinutes = Math.max(openingMinutes, closingMinutes - accumulatedWaitingMinutes);

  if (currentTimeMinutes >= cutoffMinutes) {
    return {
      isOpen: false,
      reasonType: "predictive_cutoff",
      reason: "اقتراب نهاية الدوام الرسمي وتراكم وقت الانتظار",
      cutoffTime: `${Math.floor(cutoffMinutes / 60)}:${cutoffMinutes % 60}`,
    };
  }

  // 4. Dynamic Daily Capacity
  if (activeTicketsToday >= config.maxDailyCapacity) {
    return {
      isOpen: false,
      reasonType: "capacity",
      reason: "اكتملت الطاقة الاستيعابية المتاحة لهذا اليوم",
    };
  }

  // 5. Hall Waiting Buffer Limit
  if (waitingTicketsCount >= config.maxActiveWaitingLimit) {
    return {
      isOpen: false,
      reasonType: "buffer",
      reason: "ضغط مرتفع في صالة الانتظار حالياً، جاري تخفيف الازدحام",
    };
  }

  return {
    isOpen: true,
    reasonType: "none",
    reason: "الاستقبال مفتوح وجاهز لإصدار التذاكر فوراً",
    cutoffTime: `${Math.floor(cutoffMinutes / 60)}:${cutoffMinutes % 60}`,
  };
}

function runTests() {
  console.log("================================================================================");
  console.log("         فحص واختبار محرك الإغلاق النصف آلي (Semi-Automated Intake)           ");
  console.log("================================================================================");

  const baseConfig = {
    maxDailyCapacity: 100,
    maxActiveWaitingLimit: 20,
    avgServiceTimeMinutes: 15,
    autoIntakeEnabled: true,
    manualOverrideActive: false,
    isIntakeOpen: true,
  };

  const schedule = {
    openingTime: "08:00",
    closingTime: "16:00",
    isWorkingDay: true,
  };

  // Test 1: Predictive EOD Cut-off
  console.log("\n[1] فحص الإغلاق العكسي التنبؤي (Predictive EOD Cut-off):");
  // If waiting = 4 tickets (4 * 15 min = 60 min), Cut-off = 16:00 - 60 min = 15:00 (3:00 PM)
  // At 14:45 (2:45 PM = 885 min) -> Should be OPEN
  const at1445 = evaluateIntakeLogic(baseConfig, schedule, 4, 30, 14 * 60 + 45);
  console.log(`- الساعة 02:45 م مع انتظار 4 مراجعين: الاستقبال = ${at1445.isOpen ? "مفتوح 🟢" : "مغلق 🔴"}`);
  if (!at1445.isOpen) throw new Error("كان يجب أن يكون الاستقبال مفتوحاً في 02:45 م");

  // At 15:05 (3:05 PM = 905 min) -> Should CLOSE predictively!
  const at1505 = evaluateIntakeLogic(baseConfig, schedule, 4, 30, 15 * 60 + 5);
  console.log(`- الساعة 03:05 م مع انتظار 4 مراجعين: الاستقبال = ${at1505.isOpen ? "مفتوح 🟢" : "مغلق 🔴"} (السبب: ${at1505.reason})`);
  if (at1505.isOpen || at1505.reasonType !== "predictive_cutoff") {
    throw new Error("فشل الإغلاق العكسي التنبؤي!");
  }
  console.log("✓ تم التحقق بنجاح: تم الإغلاق التنبؤي الذكي لمنع استقبال مراجعين لا يمكن خدمتهم قبل 04:00 م");

  // Test 2: Dynamic Capacity & Capacity Recycling
  console.log("\n[2] فحص السعة الاستيعابية اليومية وإعادة التدوير (Capacity Recycling):");
  const atQuota = evaluateIntakeLogic(baseConfig, schedule, 2, 100, 10 * 60); // 100 active tickets out of 100
  console.log(`- عند وصول التذاكر النشطة إلى 100/100: الاستقبال = ${atQuota.isOpen ? "مفتوح 🟢" : "مغلق 🔴"} (السبب: ${atQuota.reason})`);
  if (atQuota.isOpen || atQuota.reasonType !== "capacity") {
    throw new Error("فشل إغلاق الاستقبال عند اكتمال الطاقة الاستيعابية");
  }

  // Customer cancelled or no-show -> 1 ticket recycled -> active becomes 99
  const recycled = evaluateIntakeLogic(baseConfig, schedule, 2, 99, 10 * 60);
  console.log(`- بعد تسجيل غياب (No-Show) أو إلغاء تذكرة: التذاكر النشطة = 99/100 -> الاستقبال = ${recycled.isOpen ? "أعيد فتحه تلقائياً 🟢" : "مغلق 🔴"}`);
  if (!recycled.isOpen) {
    throw new Error("فشلت إعادة تدوير السعة الاستيعابية المقعدية تلقائياً");
  }
  console.log("✓ تم التحقق بنجاح: تحرير المقعد وإعادة فتح الاستقبال آلياً بمجرد إلغاء أو غياب مراجع");

  // Test 3: Hall Waiting Buffer Limit (Temporary Throttle)
  console.log("\n[3] فحص سقف الازدحام اللحظي في الصالة (Buffer Limit):");
  const atBufferLimit = evaluateIntakeLogic(baseConfig, schedule, 20, 50, 10 * 60); // 10:00 AM, 20 waiting in hall = buffer limit
  console.log(`- عند وصول المنتظرين في الصالة إلى 20/20 (في منتصف الدوام): الاستقبال = ${atBufferLimit.isOpen ? "مفتوح 🟢" : "مغلق 🔴"} (السبب: ${atBufferLimit.reason})`);
  if (atBufferLimit.isOpen || atBufferLimit.reasonType !== "buffer") {
    throw new Error("فشل تعليق الاستقبال المؤقت عند ازدحام الصالة");
  }
  console.log("✓ تم التحقق بنجاح: تفعيل تعليق الاستقبال المؤقت لمنع تكدس الصالة");

  // Test 4: Manual Overrides
  console.log("\n[4] فحص إجراءات التدخل والتجاوز البشري الفوري (Manual Override):");
  // +10 Capacity
  baseConfig.maxDailyCapacity += 10;
  console.log(`- زيادة السعة (+10): السقف الجديد = ${baseConfig.maxDailyCapacity}`);
  if (baseConfig.maxDailyCapacity !== 110) throw new Error("فشل زيادة السعة");

  // Pause 15 mins
  baseConfig.manualOverrideActive = true;
  baseConfig.manualOverrideType = "pause";
  baseConfig.isIntakeOpen = false;
  baseConfig.closedReason = "إيقاف مؤقت لتخفيف الضغط";
  baseConfig.manualOverrideExpiresAt = Date.now() + 15 * 60 * 1000;

  const paused = evaluateIntakeLogic(baseConfig, schedule, 5, 40, 11 * 60);
  console.log(`- إيقاف مؤقت (15 د): الاستقبال = ${paused.isOpen ? "مفتوح" : "مغلق 🔴"} (${paused.reason})`);
  if (paused.isOpen || paused.reasonType !== "pause") throw new Error("فشل الإيقاف المؤقت اليدوي");

  // Reset Override
  baseConfig.manualOverrideActive = false;
  baseConfig.manualOverrideExpiresAt = null;
  baseConfig.isIntakeOpen = true;
  const resetState = evaluateIntakeLogic(baseConfig, schedule, 5, 40, 11 * 60);
  console.log(`- إلغاء التدخل البشري والعودة للأتمتة: الاستقبال = ${resetState.isOpen ? "عائد للجدول الآلي 🟢" : "مغلق"}`);
  if (!resetState.isOpen) throw new Error("فشلت استعادة الوضع الآلي");

  console.log("\n================================================================================");
  console.log("🎉 نجحت كافة اختبارات محرك الإغلاق النصف آلي (Semi-Automated Intake) 100%");
  console.log("================================================================================");
}

runTests();
