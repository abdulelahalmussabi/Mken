/**
 * js/offline-store.js — محرك التخزين المحلي الآمن (IndexedDB Adapter)
 * منصة مكّن — الإصدار المقاوم لانقطاع الاتصال (E3.2)
 * متوافق مع: نظام حماية البيانات الشخصية (PDPL)
 */
(function () {
  'use strict';

  var DB_NAME = 'mken_offline_db';
  var DB_VERSION = 1;
  var STORE_NAME = 'offline_intents';
  var dbInstance = null;

  // ذاكرة احتياطية عند تعذر الوصول لـ IndexedDB (مثل التصفح الخفي الصارم)
  var memoryFallbackStore = new Map();

  function openDatabase() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise(function (resolve) {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        resolve(null);
        return;
      }

      try {
        var request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function (event) {
          var db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            var store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
            store.createIndex('by_tenant', 'tenantSlug', { unique: false });
            store.createIndex('by_status', 'status', { unique: false });
          }
        };

        request.onsuccess = function (event) {
          dbInstance = event.target.result;
          resolve(dbInstance);
        };

        request.onerror = function () {
          console.warn('[OfflineStore] Failed to open IndexedDB, falling back to memory store.');
          resolve(null);
        };
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * حفظ رغبة طلب أو حجز كمسودة محلية (Pending Intent)
   */
  async function savePendingIntent(type, payload, tenantSlug) {
    var slug = tenantSlug || 'default';
    var localId = 'DRAFT-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    var intent = {
      localId: localId,
      type: type || 'booking', // 'booking' أو 'order'
      tenantSlug: slug,
      payload: payload || {},
      status: 'pending_sync',
      createdAt: new Date().toISOString(),
      retryCount: 0
    };

    var db = await openDatabase();
    if (!db) {
      memoryFallbackStore.set(localId, intent);
      return intent;
    }

    return new Promise(function (resolve, reject) {
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req = store.add(intent);

        req.onsuccess = function () { resolve(intent); };
        req.onerror = function (e) { reject(e.target.error); };
      } catch (err) {
        memoryFallbackStore.set(localId, intent);
        resolve(intent);
      }
    });
  }

  /**
   * استرجاع كافة المسودات المعلقة لمستأجر معين
   */
  async function getPendingIntents(tenantSlug) {
    var slug = tenantSlug || 'default';
    var db = await openDatabase();

    if (!db) {
      var memList = [];
      memoryFallbackStore.forEach(function (v) {
        if (v.status === 'pending_sync' && v.tenantSlug === slug) memList.push(v);
      });
      return memList;
    }

    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.getAll();

        req.onsuccess = function () {
          var all = req.result || [];
          var filtered = all.filter(function (it) {
            return it.status === 'pending_sync' && (!slug || it.tenantSlug === slug);
          });
          resolve(filtered);
        };

        req.onerror = function () {
          resolve([]);
        };
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * حذف المسودة من الطابور المحلي بعد نجاح المزامنة مع السيرفر
   */
  async function removeIntent(localId) {
    if (!localId) return false;
    memoryFallbackStore.delete(localId);

    var db = await openDatabase();
    if (!db) return true;

    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req = store.delete(localId);

        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { resolve(false); };
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * تحديث مسودة موجودة (مثال: تغيير الموعد عند حدوث تعارض)
   */
  async function updateIntent(localId, updates) {
    if (!localId) return null;
    var db = await openDatabase();

    if (!db) {
      var item = memoryFallbackStore.get(localId);
      if (item) {
        Object.assign(item, updates);
        memoryFallbackStore.set(localId, item);
      }
      return item;
    }

    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var getReq = store.get(localId);

        getReq.onsuccess = function () {
          var data = getReq.result;
          if (!data) { resolve(null); return; }
          Object.assign(data, updates);
          var putReq = store.put(data);
          putReq.onsuccess = function () { resolve(data); };
          putReq.onerror = function () { resolve(null); };
        };
        getReq.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  }

  window.MkenOfflineStore = {
    savePendingIntent: savePendingIntent,
    getPendingIntents: getPendingIntents,
    removeIntent: removeIntent,
    updateIntent: updateIntent
  };
})();
