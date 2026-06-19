/**
 * سكريبت اختبار ربط خدمات جوجل ونطاق التغطية وتوافر الغرف للفنادق (CommonJS)
 * 
 * طريقة التشغيل:
 * node scripts/test-custom-integrations.cjs
 */

const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:8080';

// محاكاة متغيرات البيئة قبل تشغيل الاختبارات الخاصة بالخلفية
process.env.GOOGLE_CLIENT_ID = 'mock-google-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'mock-google-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:8080/api/google-business/callback';
process.env.SUPABASE_URL = 'https://wkcaakexzxqebwjyhtan.supabase.co';
process.env.SUPABASE_KEY = 'mock-anon-key';

async function runTests() {
  console.log('🧪 بدء اختبار ربط خدمات جوجل، نطاقات التغطية، وتوافر الغرف للفنادق...\n');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error('❌ فشل تشغيل متصفح Playwright. يرجى التأكد من تثبيت الحزم.');
    process.exit(1);
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ----------------------------------------------------
    // الاختبار 1: التحقق من إعدادات وتكامل Google Business Profile API
    // ----------------------------------------------------
    console.log('1️⃣ اختبار ربط حساب جوجل بيزنس (Google Business OAuth)...');

    // إعداد موك لـ getValidAccessToken قبل تحميل google-business.js لتفادي مشاكل الـ destructuring
    const googleAuthHelper = require('../api/_lib/google-auth-helper.js');
    googleAuthHelper.getValidAccessToken = async function (tenant) {
      return 'mock-access-token';
    };
    
    // محاكاة استدعاء الـ API الخاص بـ Vercel مباشرة
    const googleAuthHandler = require('../api/google-business.js');
    
    const mockReq = {
      method: 'GET',
      url: '/api/google-business/auth-url?tenant=almahrusa',
      query: { tenant: 'almahrusa', action: 'auth-url' },
      headers: { host: 'localhost:8080' }
    };
    
    let responseData = null;
    let responseStatus = 200;
    
    const mockRes = {
      status(c) { responseStatus = c; return this; },
      json(data) { responseData = data; return this; },
      setHeader() {}
    };

    await googleAuthHandler(mockReq, mockRes);

    if (responseStatus === 200 && responseData && responseData.url) {
      console.log('   ✅ نجاح: تم توليد رابط تسجيل الدخول لجوجل بنجاح.');
      console.log(`   ℹ️ الرابط المولد: ${responseData.url.slice(0, 70)}...`);
      
      const oauthUrl = new URL(responseData.url);
      if (oauthUrl.searchParams.get('client_id') === process.env.GOOGLE_CLIENT_ID &&
          oauthUrl.searchParams.get('scope') === 'https://www.googleapis.com/auth/business.manage' &&
          oauthUrl.searchParams.get('access_type') === 'offline') {
        console.log('   ✅ نجاح: الرابط يحتوي على معرّف العميل، نطاق الصلاحيات الصحيح، وطلب الوصول أوفلاين (Refresh Token).');
      } else {
        throw new Error('رابط تسجيل الدخول لجوجل يحتوي على إعدادات غير صحيحة.');
      }
    } else {
      throw new Error(`فشل توليد رابط OAuth لجوجل. كود الاستجابة: ${responseStatus}`);
    }

    // ----------------------------------------------------
    // الاختبار 2: فحص ونمذجة نطاق الخدمة/التغطية (Service Area Integration)
    // ----------------------------------------------------
    console.log('\n2️⃣ اختبار إعدادات نطاق التغطية والمنطقة (Service Area)...');
    
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForLoadState('networkidle');

    const serviceAreaTest = await page.evaluate(() => {
      if (!window.MkenServicesStore) return { error: 'MkenServicesStore not loaded' };
      
      // 1. اختبار النمذجة (Normalization)
      const rawConfig = {
        enabled: true,
        city: '  الرياض ',
        radiusKm: 120, // يجب تقييده بـ 80 كم كحد أقصى في الكود
        center: { lat: '24.7136', lng: '46.6753' }
      };
      
      const normalized = window.MkenServicesStore.normalizeServiceArea(rawConfig);
      
      return {
        normalizedCity: normalized.city,
        normalizedRadius: normalized.radiusKm,
        latType: typeof normalized.center.lat,
        lngType: typeof normalized.center.lng,
        latVal: normalized.center.lat,
        lngVal: normalized.center.lng
      };
    });

    if (serviceAreaTest.error) {
      throw new Error(serviceAreaTest.error);
    }

    if (serviceAreaTest.normalizedCity === 'الرياض' &&
        serviceAreaTest.normalizedRadius === 80 && // تم تقييد الحد الأقصى بنجاح لـ 80
        serviceAreaTest.latVal === 24.7136 &&
        serviceAreaTest.lngVal === 46.6753) {
      console.log('   ✅ نجاح: تم فلترة وتصحيح مدخلات نطاق الخدمة بنجاح (تنظيف الفراغات، تقييد الحد الأقصى للمسافة لـ 80كم، وتحويل الإحداثيات لأرقام).');
    } else {
      throw new Error('فشلت عملية نمذجة وتصحيح مدخلات نطاق الخدمة: ' + JSON.stringify(serviceAreaTest));
    }

    // ----------------------------------------------------
    // الاختبار 3: اختبار توافر الغرف وتضارب حجوزات الفنادق (Hotel Booking Availability)
    // ----------------------------------------------------
    console.log('\n3️⃣ اختبار توافر غرف الفنادق وإدارة المخزون والتضارب (Hotel Stay Inventory)...');
    
    await page.goto(`${BASE_URL}/book.html?activity=hotels`);
    await page.waitForLoadState('networkidle');

    const hotelInventoryTest = await page.evaluate(() => {
      if (!window.MkenBookingStore) return { error: 'MkenBookingStore not loaded' };
      
      const store = window.MkenBookingStore;
      
      // إعداد خدمة (غرفة ديلوكس) بسعة 2 غرف فقط
      const mockService = {
        id: 'deluxe-room',
        activityId: 'hotels',
        roomCount: '2', // السعة القصوى
        stayUnit: 'night'
      };
      
      const mockActivityBooking = {
        type: 'stay',
        maxPerSlot: 2
      };
      
      // إعداد حجوزات مؤكدة مسبقاً
      const mockAppointments = [
        {
          id: 'apt_1',
          serviceId: 'deluxe-room',
          date: '2026-06-20', // حجز من 20 إلى 22 (ليلتين)
          nights: 2,
          status: 'confirmed'
        },
        {
          id: 'apt_2',
          serviceId: 'deluxe-room',
          date: '2026-06-21', // حجز من 21 إلى 22 (ليلة واحدة)
          nights: 1,
          status: 'confirmed'
        }
      ];

      // فحص الحالات المختلفة:
      
      // ليلة 20 يونيو: يوجد حجز واحد مؤكد (apt_1). الغرفة الثانية متاحة.
      const isDay20Available = store.isStayRangeAvailable(
        'deluxe-room', '2026-06-20', 1, mockService, mockActivityBooking, mockAppointments
      );
      
      // ليلة 21 يونيو: يوجد حجزين مؤكدين (apt_1 و apt_2). السعة (2) ممتلئة بالكامل.
      const isDay21Available = store.isStayRangeAvailable(
        'deluxe-room', '2026-06-21', 1, mockService, mockActivityBooking, mockAppointments
      );
      
      // ليلة 22 يونيو (تاريخ المغادرة): الحجوزات السابقة تنتهي اليوم. يجب أن تكون الغرف متاحة تماماً للنزلاء الجدد.
      const isDay22Available = store.isStayRangeAvailable(
        'deluxe-room', '2026-06-22', 1, mockService, mockActivityBooking, mockAppointments
      );

      // حجز متعدد الليالي: حجز من 20 إلى 22 (ليلتين). ليلة 21 ممتلئة، لذا يجب أن يفشل الحجز بالكامل.
      const isRange20to22Available = store.isStayRangeAvailable(
        'deluxe-room', '2026-06-20', 2, mockService, mockActivityBooking, mockAppointments
      );

      return {
        isDay20Available,
        isDay21Available,
        isDay22Available,
        isRange20to22Available
      };
    });

    if (hotelInventoryTest.error) {
      throw new Error(hotelInventoryTest.error);
    }

    // التحقق من صحة الحسابات الفندقية
    if (hotelInventoryTest.isDay20Available === true &&
        hotelInventoryTest.isDay21Available === false &&
        hotelInventoryTest.isDay22Available === true &&
        hotelInventoryTest.isRange20to22Available === false) {
      console.log('   ✅ نجاح: نظام الحسابات الفندقية يعمل بدقة متناهية:');
      console.log('       - ليلة 20-06: متاحة (حجز واحد من أصل غرفتين).');
      console.log('       - ليلة 21-06: غير متاحة (الغرفتان ممتلئتان بالكامل).');
      console.log('       - ليلة 22-06: متاحة (تم احتساب المغادرة بنجاح وإتاحة الغرفة للنزيل الجديد).');
      console.log('       - فترة الحجز (20-22 يونيو): تم رفضها بنجاح لتضاربها مع ليلة 21 يونيو المزدحمة.');
    } else {
      throw new Error('فشل اختبار إدارة المخزون الفندقي وحساب التضارب: ' + JSON.stringify(hotelInventoryTest));
    }

    // ----------------------------------------------------
    // الاختبار 4: فحص ومزامنة الخدمات مع جوجل (Google Business Profile Services Sync)
    // ----------------------------------------------------
    console.log('\n4️⃣ اختبار مزامنة الخدمات مع جوجل بيزنس (Google Business Services Sync)...');

    // 1. إعداد موك لـ getValidAccessToken (تم إعداده في البداية)

    // 2. إعداد موك لـ fetch
    const originalFetch = global.fetch;
    let categoryFetched = false;
    let servicesPatched = false;
    let patchedBody = null;

    global.fetch = async function (url, options) {
      const urlStr = String(url);
      if (urlStr.includes('readMask=primaryCategory')) {
        categoryFetched = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            primaryCategory: {
              name: 'gcid:hair_salon',
              displayName: 'Hair Salon'
            }
          }),
          text: async () => JSON.stringify({ primaryCategory: { name: 'gcid:hair_salon' } })
        };
      }
      if (urlStr.includes('updateMask=serviceItems') && options.method === 'PATCH') {
        servicesPatched = true;
        patchedBody = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
          text: async () => JSON.stringify({ success: true })
        };
      }
      // Fallback for other fetches if any
      return originalFetch ? originalFetch(url, options) : { ok: false, text: async () => 'Not mocked' };
    };

    try {
      const syncHandler = require('../api/google-business.js');
      const mockSyncReq = {
        method: 'POST',
        url: '/api/google-business/sync-services',
        query: { action: 'sync-services' },
        body: {
          locationId: 'locations/mock-location-123',
          tenant: 'almahrusa',
          services: [
            { title: 'تركيب مكيفات سبليت', description: 'تركيب مكيفات سبليت احترافي' },
            { title: 'غسيل مكيفات' }
          ]
        },
        headers: { host: 'localhost:8080' }
      };

      let syncStatus = 200;
      let syncData = null;
      const mockSyncRes = {
        status(c) { syncStatus = c; return this; },
        json(data) { syncData = data; return this; },
        setHeader() {}
      };

      await syncHandler(mockSyncReq, mockSyncRes);

      if (syncStatus === 200 && syncData && syncData.success) {
        console.log('   ✅ نجاح: تم استدعاء الـ API الخلفي واستقبل البيانات بنجاح.');
      } else {
        throw new Error(`فشل استدعاء API مزامنة الخدمات. الكود: ${syncStatus}, الاستجابة: ${JSON.stringify(syncData)}`);
      }

      if (categoryFetched && servicesPatched) {
        console.log('   ✅ نجاح: تم استدعاء خدمات جوجل لجلب التصنيف وجلب تعديل الخدمات.');
      } else {
        throw new Error(`لم يتم استدعاء جوجل بالطريقة المتوقعة: categoryFetched=${categoryFetched}, servicesPatched=${servicesPatched}`);
      }

      if (patchedBody && Array.isArray(patchedBody.serviceItems)) {
        const items = patchedBody.serviceItems;
        if (items.length === 2 &&
            items[0].freeFormServiceItem.category === 'gcid:hair_salon' &&
            items[0].freeFormServiceItem.label.displayName === 'تركيب مكيفات سبليت' &&
            items[0].freeFormServiceItem.label.description === 'تركيب مكيفات سبليت احترافي' &&
            items[1].freeFormServiceItem.category === 'gcid:hair_salon' &&
            items[1].freeFormServiceItem.label.displayName === 'غسيل مكيفات' &&
            !items[1].freeFormServiceItem.label.description) {
          console.log('   ✅ نجاح: مصفوفة الخدمات المرسلة مطابقة للتنسيق المطلوب من جوجل بيزنس (FreeFormServiceItem).');
        } else {
          throw new Error('تنسيق مصفوفة الخدمات المرسلة لجوجل غير صحيحة: ' + JSON.stringify(patchedBody));
        }
      } else {
        throw new Error('لم يتم استقبال تعديل مصفوفة الخدمات المرسلة بشكل صحيح.');
      }
    } finally {
      // استعادة fetch الأصلي
      global.fetch = originalFetch;
    }

    console.log('\n🎉 جميع الفحوصات والتحققات الخاصة بربط خدمات جوجل ونطاقات التغطية ونظام حجز الفنادق ومزامنة الخدمات تمت بنجاح وبدون أي أخطاء! 🚀\n');
    await browser.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء الفحص والتحقق:');
    console.error(error.stack || error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

runTests();
