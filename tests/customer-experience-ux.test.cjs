/**
 * tests/customer-experience-ux.test.cjs
 * اختبارات تجربة العميل (UX Architecture & Customer Experience):
 * 1. PWA غير المزعجة: فترة التهدئة (14 يوماً) ومؤشر التفاعل الحقيقي.
 * 2. مركز الجلسة الموحدة (Unified Session Hub): الدخول الصامت SSO وتعبئة بيانات النماذج تلقائياً.
 * 3. القوائم المتكيفة ديناميكياً (Adaptive Dynamic Menus): حجب الفواتير والخدمات غير المشترك بها.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// =========================================================================
// Mocks for Browser Environment (LocalStorage, SessionStorage, DOM)
// =========================================================================
function createMockStorage() {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    _dump: () => ({ ...store })
  };
}

function setupMockDom() {
  const mockLocalStorage = createMockStorage();
  const mockSessionStorage = createMockStorage();

  const elements = {};

  const mockDocument = {
    readyState: 'complete',
    body: {
      appendChild: () => {}
    },
    createElement: (tag) => {
      return {
        tagName: tag.toUpperCase(),
        style: {},
        classList: {
          contains: () => false,
          add: () => {},
          remove: () => {},
          toggle: () => {}
        },
        setAttribute: function (k, v) { this[k] = v; },
        getAttribute: function (k) { return this[k]; },
        removeAttribute: function (k) { delete this[k]; },
        addEventListener: () => {}
      };
    },
    getElementById: (id) => elements[id] || null,
    querySelector: (selector) => {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return elements[id] || null;
      }
      if (selector.includes('[data-tab="')) {
        const match = selector.match(/data-tab="([^"]+)"/);
        if (match && elements['tab_' + match[1]]) {
          return elements['tab_' + match[1]];
        }
      }
      if (selector.includes('[data-panel="')) {
        const match = selector.match(/data-panel="([^"]+)"/);
        if (match && elements['panel_' + match[1]]) {
          return elements['panel_' + match[1]];
        }
      }
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector.includes('.admin-tab')) {
        return Object.keys(elements)
          .filter(k => k.startsWith('tab_'))
          .map(k => elements[k]);
      }
      if (selector.includes('.admin-tab-panel')) {
        return Object.keys(elements)
          .filter(k => k.startsWith('panel_'))
          .map(k => elements[k]);
      }
      return [];
    },
    addEventListener: () => {}
  };

  const mockWindow = {
    document: mockDocument,
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    addEventListener: () => {},
    location: { search: '', pathname: '/admin.html' },
    MkenServicesStore: {
      getSaaSPlan: (tier) => {
        const plans = {
          basic: { hasWhatsApp: false, hasCommerce: false, hasInvoices: false },
          growth: { hasWhatsApp: true, hasCommerce: true, hasInvoices: false },
          unlimited: { hasWhatsApp: true, hasCommerce: true, hasInvoices: true }
        };
        return plans[tier] || plans.basic;
      },
      getCurrentTenantSlug: () => 'my-tenant',
      loadConfig: () => ({ subscription: { tier: 'basic' } }),
      isAdminLoggedIn: () => false
    }
  };

  global.localStorage = mockLocalStorage;
  global.sessionStorage = mockSessionStorage;
  global.window = mockWindow;
  global.document = mockDocument;
  global.Event = class { constructor(type) { this.type = type; } };

  return { mockLocalStorage, mockSessionStorage, mockDocument, elements, mockWindow };
}

// Ensure mock DOM is active before loading any modules
setupMockDom();

// =========================================================================
// Suite 1: تجربة PWA الهادئة وفترة التهدئة 14 يوماً
// =========================================================================
test('PWA UX: احترام فترة التهدئة 14 يوماً (Snooze Cooldown) بعد نقر "لاحقاً"', () => {
  const { mockLocalStorage } = setupMockDom();
  delete require.cache[require.resolve('../js/pwa.js')];
  const Pwa = require('../js/pwa.js');

  assert.equal(Pwa.isInstallSnoozed(), false, 'قبل النقر، لا توجد فترة تهدئة');

  // المستخدم يختار "لاحقاً" (سكون لمدة 14 يوماً)
  Pwa.snoozeInstallPrompt(14);

  assert.equal(Pwa.isInstallSnoozed(), true, 'بعد النقر، يتم تفعيل التهدئة لمدة 14 يوماً');

  const snoozedUntil = parseInt(mockLocalStorage.getItem('mken_pwa_install_snoozed_until'), 10);
  const now = Date.now();
  const diffDays = (snoozedUntil - now) / (1000 * 60 * 60 * 24);

  assert.ok(diffDays >= 13.9 && diffDays <= 14.1, 'التاريخ المخزن يطابق 14 يوماً بالضبط');

  // بعد انقضاء الـ 14 يوماً (محاكاة انقضاء الوقت)
  mockLocalStorage.setItem('mken_pwa_install_snoozed_until', (now - 1000).toString());
  assert.equal(Pwa.isInstallSnoozed(), false, 'بعد انقضاء المدة، ينتهي السكون ويتاح التثبيت دون إزعاج');
});

test('PWA UX: عدم إزعاج الزائر في الزيارة الأولى واشتراط تفاعل حقيقي (Views Heuristic)', () => {
  const { mockLocalStorage } = setupMockDom();
  delete require.cache[require.resolve('../js/pwa.js')];
  const Pwa = require('../js/pwa.js');

  mockLocalStorage.clear();

  // زيارة أولى
  Pwa.trackPageView();
  assert.equal(Pwa.getPageViewCount(), 1, 'الزيارة الأولى مسجلة');

  let bannerCreated = false;
  global.document.createElement = (tag) => {
    bannerCreated = true;
    return { id: 'pwaInstallBanner', style: {}, classList: { add: () => {} } };
  };

  // في الزيارة الأولى، Auto Prompt يجب ألا يظهر
  Pwa.maybeShowBanner(false);
  assert.equal(bannerCreated, false, 'تم منع النافذة المنبثقة التلقائية في الزيارة الأولى لتقليل الإزعاج');

  // زيارة ثانية (مؤشر اهتمام وتفاعل حقيقي)
  Pwa.trackPageView();
  assert.equal(Pwa.getPageViewCount(), 2, 'الزيارة الثانية مسجلة');
});

// =========================================================================
// Suite 2: مركز الجلسة الموحدة (Unified Session Hub & Silent SSO)
// =========================================================================
test('Unified Session Hub: حفظ واسترجاع ملف العميل ومزامنته صامتاً بين الخدمات', () => {
  const { mockLocalStorage } = setupMockDom();
  delete require.cache[require.resolve('../js/unified-session.js')];
  const MkenSession = require('../js/unified-session.js');

  mockLocalStorage.clear();

  // حفظ ملف العميل عند حجز دور في الطابور أو طلب خدمة
  const ok = MkenSession.updateCustomerProfile({
    name: 'عبدالله محمد',
    phone: '0501234567',
    email: 'abdullah@example.com'
  });
  assert.ok(ok, 'تم حفظ الجلسة بنجاح');

  const profile = MkenSession.getCustomerProfile();
  assert.equal(profile.name, 'عبدالله محمد');
  assert.equal(profile.phone, '0501234567');
  assert.equal(profile.email, 'abdullah@example.com');
  assert.ok(profile.lastSeenAt > 0);
});

test('Unified Session Hub: التعبئة التلقائية لنماذج الحجز والطابور (Zero-Friction Fill)', () => {
  const { elements } = setupMockDom();
  delete require.cache[require.resolve('../js/unified-session.js')];
  const MkenSession = require('../js/unified-session.js');

  // إعداد حقول الإدخال في صفحة الطابور
  elements['customerNameInput'] = { value: '', dispatchEvent: () => {} };
  elements['customerPhoneInput'] = { value: '', dispatchEvent: () => {} };

  MkenSession.updateCustomerProfile({
    name: 'سارة خالد',
    phone: '0559876543'
  });

  // استدعاء التعبئة الذكية
  MkenSession.prefillCustomerInputs();

  assert.equal(elements['customerNameInput'].value, 'سارة خالد', 'تم ملء حقل الاسم تلقائياً بدون كتابة');
  assert.equal(elements['customerPhoneInput'].value, '0559876543', 'تم ملء رقم الجوال تلقائياً');
});

test('Unified Session Hub: استمرارية مصادقة موظفي التاجر وعزل الصلاحيات حسب المستأجر', () => {
  setupMockDom();
  delete require.cache[require.resolve('../js/unified-session.js')];
  const MkenSession = require('../js/unified-session.js');

  // تسجيل موظف لمتجر معين
  MkenSession.setStaffAuth('najd-store', {
    pin: '9876',
    token: 'jwt-token-najd-123',
    role: 'cashier',
    email: 'cashier@najd.sa'
  });

  const auth = MkenSession.getStaffAuth('najd-store');
  assert.equal(auth.pin, '9876');
  assert.equal(auth.token, 'jwt-token-najd-123');
  assert.equal(auth.role, 'cashier');

  // توليد ترويسات المصادقة التلقائية لطلبات API
  const headers = MkenSession.getAuthHeaders('najd-store');
  assert.equal(headers['Authorization'], 'Bearer jwt-token-najd-123');
  assert.equal(headers['x-admin-pin'], '9876');
  assert.equal(headers['x-tenant-slug'], 'najd-store');

  // تسجيل الخروج
  MkenSession.clearStaffAuth('najd-store');
  assert.equal(MkenSession.getStaffAuth('najd-store'), null, 'تم مسح بيانات المصادقة بنجاح');
});

// =========================================================================
// Suite 3: القوائم المتكيفة ديناميكياً (Adaptive Dynamic Menus)
// =========================================================================
test('Adaptive Menus: التاجر غير المشترك بنظام الفواتير تُحجب عنه تبويبات الفواتير وهيئة الزكاة', () => {
  const { elements } = setupMockDom();
  delete require.cache[require.resolve('../js/admin.js')];
  const Admin = require('../js/admin.js');

  // محاكاة أزرار القائمة في لوحة التحكم
  const tabs = ['reports', 'invoices', 'zatca', 'queue', 'orders', 'inventory', '3pl-fleet', 'whatsapp-logs', 'appointments'];
  tabs.forEach(t => {
    elements['tab_' + t] = {
      tagName: 'BUTTON',
      style: { display: '' },
      setAttribute: function (k, v) { this[k] = v; },
      getAttribute: function (k) { return this[k]; },
      removeAttribute: function (k) { delete this[k]; }
    };
    elements['panel_' + t] = { hidden: false };
  });

  // تاجر في الباقة الأساسية (غير مشترك بالفواتير أو الطوابير أو الواتساب)
  const config = {
    subscription: { tier: 'basic' },
    customFeatures: {
      hasInvoices: false,
      hasQueue: false,
      hasWhatsApp: false,
      hasCommerce: false,
      hasBooking: true
    }
  };

  const result = Admin.applyDynamicFeatureTabs(config);

  assert.equal(result.entitlements.hasInvoices, false, 'hasInvoices must be false');
  assert.equal(result.entitlements.hasQueue, false, 'hasQueue must be false');
  assert.equal(result.entitlements.hasWhatsApp, false, 'hasWhatsApp must be false');
  assert.equal(result.entitlements.hasCommerce, false, 'hasCommerce must be false');

  // التحقق من إخفاء تبويبات الفواتير والزكاة والطوابير تماماً
  assert.equal(elements['tab_invoices'].style.display, 'none', 'تبويب الفواتير مخفي');
  assert.equal(elements['tab_invoices']['data-feature-hidden'], 'true');

  assert.equal(elements['tab_zatca'].style.display, 'none', 'تبويب هيئة الزكاة ZATCA مخفي للتاجر غير المفعل للفواتير');
  assert.equal(elements['tab_zatca']['data-feature-hidden'], 'true');

  assert.equal(elements['tab_queue'].style.display, 'none', 'تبويب الطوابير مخفي لعدم الاشتراك');
  assert.equal(elements['tab_orders'].style.display, 'none', 'تبويب الطلبات مخفي لعدم تفعيل التجارة');

  // المواعيد مفعلة للتاجر
  assert.equal(elements['tab_appointments'].style.display, '', 'تبويب المواعيد ظاهر');
  assert.equal(elements['tab_appointments']['data-feature-hidden'], undefined);
});

test('Adaptive Menus: تفعيل التبويبات بالكامل للمشترك في الباقة الاحترافية أو من فعل الميزات يدوياً', () => {
  const { elements } = setupMockDom();
  delete require.cache[require.resolve('../js/admin.js')];
  const Admin = require('../js/admin.js');

  const tabs = ['reports', 'invoices', 'zatca', 'queue', 'orders', 'inventory', '3pl-fleet', 'whatsapp-logs', 'appointments'];
  tabs.forEach(t => {
    elements['tab_' + t] = {
      tagName: 'BUTTON',
      style: { display: '' },
      setAttribute: function (k, v) { this[k] = v; },
      getAttribute: function (k) { return this[k]; },
      removeAttribute: function (k) { delete this[k]; }
    };
  });

  // تاجر مخصص مفعل لجميع الخدمات
  const config = {
    subscription: { tier: 'custom' },
    customFeatures: {
      hasInvoices: true,
      hasQueue: true,
      hasWhatsApp: true,
      hasCommerce: true,
      hasBooking: true,
      has3plFleet: true,
      hasInventory: true
    }
  };

  const result = Admin.applyDynamicFeatureTabs(config);

  assert.equal(result.entitlements.hasInvoices, true);
  assert.equal(result.entitlements.hasQueue, true);
  assert.equal(result.entitlements.hasWhatsApp, true);

  // جميع التبويبات يجب أن تكون ظاهرة
  assert.equal(elements['tab_invoices'].style.display, '', 'تبويب الفواتير ظاهر');
  assert.equal(elements['tab_zatca'].style.display, '', 'تبويب الزكاة ظاهر');
  assert.equal(elements['tab_queue'].style.display, '', 'تبويب الطوابير ظاهر');
  assert.equal(elements['tab_orders'].style.display, '', 'تبويب الطلبات ظاهر');
  assert.equal(elements['tab_whatsapp-logs'].style.display, '', 'تبويب رسائل الواتساب ظاهر');
});

// إغلاق نظيف للعملية بعد إتمام جميع الاختبارات
test.after(() => {
  setTimeout(() => {
    process.exit(0);
  }, 50);
});
