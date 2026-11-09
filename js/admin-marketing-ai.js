/**
 * Mken Platform - AI Marketing & Creatives Engine
 * Integrates Gemini AI Copywriting & Instant Vector SVG Banner Generation
 */
(function () {
  'use strict';

  var store = window.MkenServicesStore;
  if (!store) return;

  function toast(msg, type) {
    if (window.MkenAdminToast) window.MkenAdminToast(msg, type);
    else alert(msg);
  }

  // Elements
  var genSector = document.getElementById('aiCampSector');
  var genGoal = document.getElementById('aiCampGoal');
  var genDialect = document.getElementById('aiCampDialect');
  var genDetails = document.getElementById('aiCampDetails');
  var genBtn = document.getElementById('aiCampGenerateBtn');
  var resultsBox = document.getElementById('aiCampResultsBox');

  var previewWa = document.getElementById('aiCampPreviewWa');
  var previewSocial = document.getElementById('aiCampPreviewSocial');
  var previewBanner = document.getElementById('aiCampPreviewBanner');
  var applyToWaBtn = document.getElementById('aiCampApplyToWaBtn');
  var copySocialBtn = document.getElementById('aiCampCopySocialBtn');
  var copyWaBtn = document.getElementById('aiCampCopyWaBtn');
  var downloadBannerBtn = document.getElementById('aiCampDownloadBannerBtn');

  var currentGeneratedSvg = '';

  function init() {
    if (!genBtn) return;

    // Populate sector dropdown if empty
    if (genSector && genSector.options.length <= 1) {
      populateSectors();
    }

    genBtn.addEventListener('click', generateCampaign);

    if (applyToWaBtn) {
      applyToWaBtn.addEventListener('click', function () {
        var waInput = document.getElementById('waCampMessage');
        if (waInput && previewWa) {
          waInput.value = previewWa.value;
          toast('✅ تم نسخ نص الرسالة إلى حقل الإرسال الجماعي بنجاح!', 'success');
          waInput.scrollIntoView({ behavior: 'smooth' });
          waInput.focus();
        }
      });
    }

    if (copyWaBtn) {
      copyWaBtn.addEventListener('click', function () {
        if (!previewWa) return;
        navigator.clipboard.writeText(previewWa.value).then(function () {
          toast('📋 تم نسخ نص الواتساب إلى الحافظة!');
        }).catch(function () {
          previewWa.select();
          document.execCommand('copy');
          toast('📋 تم نسخ نص الواتساب!');
        });
      });
    }

    if (copySocialBtn) {
      copySocialBtn.addEventListener('click', function () {
        if (!previewSocial) return;
        navigator.clipboard.writeText(previewSocial.value).then(function () {
          toast('📋 تم نسخ منشور السوشيال ميديا وهاشتاقاته!');
        }).catch(function () {
          previewSocial.select();
          document.execCommand('copy');
          toast('📋 تم نسخ المنشور!');
        });
      });
    }

    if (downloadBannerBtn) {
      downloadBannerBtn.addEventListener('click', downloadSvgBanner);
    }
  }

  function populateSectors() {
    var sectors = [
      { id: 'barber-salon', name: '💈 صالونات الحلاقة والتجميل' },
      { id: 'spa-wellness', name: '🧖 سبا ومساج واستجمام' },
      { id: 'car-care', name: '🚗 مغاسل وتلميع سيارات' },
      { id: 'healthcare', name: '🏥 عيادات ومراكز طبية' },
      { id: 'maintenance', name: '🔧 تشغيل وصيانة وتكييف' },
      { id: 'cleaning', name: '🧹 نظافة وتعقيم واجهات' },
      { id: 'it-support', name: '🖥️ حاسب وشبكات وتقنية' },
      { id: 'renovation', name: '🎨 تشطيب وديكور ومقاولات' },
      { id: 'restaurant', name: '🍽️ مطاعم ومقاهي ومأكولات' },
      { id: 'fitness', name: '🏋️ نوادي ورياضة ولياقة' },
      { id: 'commerce', name: '🛒 متاجر تجزئة وتسوق' },
      { id: 'consulting', name: '⚖️ استشارات مهنية وقانونية' },
      { id: 'photography', name: '📸 استوديوهات وتصوير' },
      { id: 'events', name: '🎉 تنظيم مناسبات واحتفالات' },
      { id: 'hotels', name: '🏨 فنادق وضيافة وشقق' },
      { id: 'travel', name: '✈️ سياحة وسفر وباقات' },
      { id: 'veterinary', name: '🐾 عيادات ورعاية بيطرية' },
      { id: 'tutoring', name: '📚 دروس خصوصية وتدريب' }
    ];

    genSector.innerHTML = '';
    sectors.forEach(function (sec) {
      var opt = document.createElement('option');
      opt.value = sec.id;
      opt.textContent = sec.name;
      genSector.appendChild(opt);
    });

    // Match current tenant's active activity if possible
    var config = store.loadConfig ? store.loadConfig() : {};
    if (config.activityId) {
      genSector.value = config.activityId;
    }
  }

  function generateCampaign() {
    var tenantSlug = store.getCurrentTenantSlug() || 'default';
    var config = store.loadConfig ? store.loadConfig() : {};
    var brandName = (config.brand && config.brand.name) || 'مكِّن';
    var brandColors = {
      primary: (config.brand && config.brand.primaryColor) || '#0f766e',
      accent: (config.brand && config.brand.accentColor) || '#f59e0b'
    };

    var payload = {
      tenantSlug: tenantSlug,
      activityId: genSector ? genSector.value : 'barber-salon',
      campaignType: genGoal ? genGoal.value : 'discount_offer',
      dialect: genDialect ? genDialect.value : 'najdi',
      offerDetails: genDetails ? genDetails.value.trim() : '',
      brandColors: brandColors
    };

    genBtn.disabled = true;
    var originalBtnText = genBtn.textContent;
    genBtn.textContent = '✨ جاري التوليد والابتكار بالذكاء الاصطناعي...';

    fetch('/api/v1/ai-marketing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('فشل استدعاء محرك الذكاء الاصطناعي (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        if (!data.success) {
          throw new Error(data.error || 'حدث خطأ أثناء معالجة الحملة');
        }

        if (resultsBox) resultsBox.hidden = false;
        if (previewWa) previewWa.value = data.whatsappCopy || '';
        if (previewSocial) previewSocial.value = data.socialCaption || '';

        if (data.bannerSvg) {
          currentGeneratedSvg = data.bannerSvg;
          if (previewBanner) {
            previewBanner.innerHTML = data.bannerSvg;
          }
        }

        // Save generated campaign into Supabase if connected
        if (window.MkenSupabaseDb && typeof window.MkenSupabaseDb.saveMarketingCampaign === 'function' && window.MkenSupabaseDb.isConfigured()) {
          window.MkenSupabaseDb.saveMarketingCampaign(tenantSlug, {
            campaign_title: data.campaignTitle || 'حملة تسويقية ذكية',
            copy_variations: {
              whatsapp: data.whatsappCopy,
              social: data.socialCaption,
              cta: data.callToAction
            },
            asset_urls: {
              svg_banner: data.bannerSvg ? 'embedded_svg' : null
            },
            approval_status: 'APPROVED'
          }).catch(function (e) {
            console.warn('Auto-save campaign to Supabase warn:', e.message);
          });
        }

        toast('🎉 تم توليد محتوى الحملة والبنر الإعلاني بنجاح!', 'success');
        if (resultsBox) {
          resultsBox.scrollIntoView({ behavior: 'smooth' });
        }
      })
      .catch(function (err) {
        console.error('[Marketing AI UI Error]:', err);
        toast('خطأ: ' + err.message, 'error');
      })
      .finally(function () {
        genBtn.disabled = false;
        genBtn.textContent = originalBtnText;
      });
  }

  function downloadSvgBanner() {
    if (!currentGeneratedSvg) {
      toast('لا يوجد بنر تم توليده للتحميل', 'warning');
      return;
    }

    var blob = new Blob([currentGeneratedSvg], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'mken-ad-banner-' + Date.now() + '.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('📥 بدأ تحميل البنر بصيغة SVG عالية الدقة!');
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
