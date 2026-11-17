/**
 * منصة مكِّن (Mken SaaS) — محرك اللوجستيات وإدارة أسطول التوصيل (3PL & Last-Mile Delivery Engine)
 * الخريطة الحرارية التنبؤية والتوزيع الاستباقي للأسطول
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;

  // الإعدادات الافتراضية لخوارزمية التواجد الاستباقي (Pre-Demand Positioning Formula)
  var DEFAULT_PARAMS = {
    alpha: 0.50, // معامل المتوسط التاريخي H(z, t)
    beta: 0.35,  // معامل الفعاليات والعروض النشطة E(z, t)
    gamma: 0.15, // معامل الكثافة الجغرافية والموسمية S(z)
    driverCapacity: 4.5 // متوسط طاقة التوصيل للسائق في الساعة
  };

  // بيانات افتراضية توضيحية لمناطق التغطية الكبرى (جدة / الرياض)
  var INITIAL_ZONES = [
    { id: 'zone-1', name: 'حي الصفا / المطار (جدة)', code: 'JED-SAF-01', avgHistory: 180, activePromos: 1.4, geoFactor: 1.2, vehicles: 22, activePlatform: 'Noon' },
    { id: 'zone-2', name: 'حي الصحافة / الملقا (الرياض)', code: 'RUH-MAL-02', avgHistory: 310, activePromos: 1.8, geoFactor: 1.5, vehicles: 38, activePlatform: 'Hungerstation' },
    { id: 'zone-3', name: 'حي العليا / السليمانية (الرياض)', code: 'RUH-OLYA-03', avgHistory: 240, activePromos: 1.2, geoFactor: 1.3, vehicles: 29, activePlatform: 'Keeta' },
    { id: 'zone-4', name: 'حي الشاطئ / الزهراء (جدة)', code: 'JED-SHT-04', avgHistory: 145, activePromos: 1.1, geoFactor: 1.1, vehicles: 16, activePlatform: 'Jahez' }
  ];

  /**
   * حساب حجم الطلبات المتوقع D(z, t)
   * D(z, t) = alpha * H(z, t) + beta * E(z, t) + gamma * S(z)
   */
  function calculatePredictedDemand(zone, params) {
    var p = params || DEFAULT_PARAMS;
    var H = zone.avgHistory || 0;
    var E = (zone.activePromos || 1.0) * 100;
    var S = (zone.geoFactor || 1.0) * 80;

    var predicted = (p.alpha * H) + (p.beta * E) + (p.gamma * S);
    var requiredVehicles = Math.ceil(predicted / p.driverCapacity);

    return {
      predictedVolume: Math.round(predicted),
      requiredVehicles: requiredVehicles,
      currentVehicles: zone.vehicles || 0,
      bufferDeficit: requiredVehicles - (zone.vehicles || 0)
    };
  }

  function renderFleetDashboard() {
    var container = document.getElementById('fleetHeatmapContainer');
    if (!container) return;

    var html = '<div class="fleet-heatmap-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 15px;">';

    INITIAL_ZONES.forEach(function (zone) {
      var calc = calculatePredictedDemand(zone, DEFAULT_PARAMS);
      var statusColor = calc.bufferDeficit > 0 ? '#eb5757' : '#27ae60';
      var statusBadge = calc.bufferDeficit > 0 ? '⚠️ عجز أسطول (' + calc.bufferDeficit + '+)' : '✅ تغطية متوازنة';

      html += '<div style="background: var(--admin-card-bg, #ffffff); border: 1px solid var(--admin-border, #e0e0e0); border-radius: 12px; padding: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">' +
        '<div style="display:flex; justify-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:12px;">' +
          '<h4 style="margin:0; font-size:1.05rem;">📍 ' + zone.name + '</h4>' +
          '<span style="background:' + statusColor + '15; color:' + statusColor + '; padding:4px 8px; border-radius:20px; font-size:0.75rem; font-weight:bold;">' + statusBadge + '</span>' +
        '</div>' +
        '<p style="margin:4px 0; font-size:0.85rem; color:#666;">الرمز الجغرافي: <strong>' + zone.code + '</strong> | المنصة: <strong>' + zone.activePlatform + '</strong></p>' +
        '<div style="margin-top:14px; background:#f8f9fa; padding:12px; border-radius:8px; display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.85rem;">' +
          '<div>الطلب المتوقع D(z,t): <br><strong style="font-size:1.1rem; color:#2d9cdb;">' + calc.predictedVolume + ' طلب/ساعة</strong></div>' +
          '<div>المركبات المطلوبة Vreq: <br><strong style="font-size:1.1rem; color:#27ae60;">' + calc.requiredVehicles + ' مركبة</strong></div>' +
        '</div>' +
        '<div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-size:0.85rem;">المركبات المتمركزة حالياً: <strong>' + zone.vehicles + '</strong></span>' +
          '<button type="button" class="btn btn--sm btn--primary dispatch-alert-btn" data-zone-id="' + zone.id + '" style="font-size:0.8rem; padding:5px 10px;">' +
            '📱 توجيه إشعار واتساب' +
          '</button>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    container.innerHTML = html;

    // Attach WhatsApp dispatch handlers
    var btns = container.querySelectorAll('.dispatch-alert-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var zoneId = this.getAttribute('data-zone-id');
        var zone = INITIAL_ZONES.find(function (z) { return z.id === zoneId; });
        if (!zone) return;

        if (window.MkenWhatsappAutomation && window.MkenWhatsappAutomation.sendDriverPositioningAlert) {
          btn.disabled = true;
          btn.textContent = '⏳ جاري الإرسال...';
          window.MkenWhatsappAutomation.sendDriverPositioningAlert(zone)
            .then(function () {
              if (window.MkenAdminToast) window.MkenAdminToast('تم إرسال إشعار التمركز الاستباقي لأسطول ' + zone.name + ' عبر WhatsApp بنجاح!', 'success');
            })
            .catch(function (err) {
              if (window.MkenAdminToast) window.MkenAdminToast('تعذر الإرسال: ' + err.message, 'error');
            })
            .finally(function () {
              btn.disabled = false;
              btn.textContent = '📱 توجيه إشعار واتساب';
            });
        } else {
          alert('تمت أتمتة توجيه الأسطول الاستباقي لـ ' + zone.name);
        }
      });
    });
  }

  function init3PLModule() {
    renderFleetDashboard();
  }

  window.Mken3PLFleet = {
    init: init3PLModule,
    refresh: renderFleetDashboard,
    calculateDemand: calculatePredictedDemand
  };
})();
