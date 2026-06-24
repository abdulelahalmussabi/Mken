function normalizePhoneDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.indexOf('966') === 0) return digits;
  if (digits.indexOf('0') === 0) return '966' + digits.slice(1);
  if (digits.length === 9) return '966' + digits;
  return digits;
}

function formatPhoneDisplay(digits) {
  const d = normalizePhoneDigits(digits);
  if (!d) return '';
  if (d.indexOf('966') === 0 && d.length >= 12) {
    const local = d.slice(3);
    return '+966 ' + local.slice(0, 2) + ' ' + local.slice(2, 5) + ' ' + local.slice(5);
  }
  return '+' + d;
}

function normalizeUrl(url) {
  if (!url) return '';
  let u = String(url).trim().toLowerCase();
  u = u.replace(/^https?:\/\//, '').replace(/^www\./, '');
  if (u.endsWith('/')) u = u.slice(0, -1);
  return u;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه');
}

function formatGbpAddress(storefrontAddress) {
  if (!storefrontAddress) return '';
  const parts = [];
  if (Array.isArray(storefrontAddress.addressLines) && storefrontAddress.addressLines.length) {
    parts.push(storefrontAddress.addressLines.join('، '));
  }
  if (storefrontAddress.locality) parts.push(storefrontAddress.locality);
  if (storefrontAddress.administrativeArea) parts.push(storefrontAddress.administrativeArea);
  if (storefrontAddress.postalCode) parts.push(storefrontAddress.postalCode);
  return parts.join(' — ');
}

const DAY_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function formatTimeOfDay(timeObj) {
  if (!timeObj) return '';
  const h = String(timeObj.hours != null ? timeObj.hours : 0).padStart(2, '0');
  const m = String(timeObj.minutes != null ? timeObj.minutes : 0).padStart(2, '0');
  return h + ':' + m;
}

function formatGbpHours(regularHours) {
  if (!regularHours || !Array.isArray(regularHours.periods) || !regularHours.periods.length) {
    return '';
  }
  const summaries = regularHours.periods.slice(0, 3).map(function (period) {
    const day = DAY_NAMES[period.openDay] || ('يوم ' + period.openDay);
    const open = formatTimeOfDay(period.openTime);
    const close = formatTimeOfDay(period.closeTime);
    return day + ' ' + open + '–' + close;
  });
  let text = summaries.join(' | ');
  if (regularHours.periods.length > 3) {
    text += ' …(+' + (regularHours.periods.length - 3) + ' فترات)';
  }
  return text;
}

function formatSiteHours(site) {
  const start = site.hoursStart || '';
  const end = site.hoursEnd || '';
  if (!start && !end) return '';
  if (start && end) return start + ' – ' + end + ' (حسب إعدادات الحجز)';
  return start || end;
}

function compareField(id, label, siteRaw, gbpRaw, compareFn, hint) {
  const siteValue = siteRaw != null ? String(siteRaw).trim() : '';
  const gbpValue = gbpRaw != null ? String(gbpRaw).trim() : '';

  let status;
  if (!siteValue && !gbpValue) {
    status = 'missing_both';
  } else if (!siteValue) {
    status = 'missing_site';
  } else if (!gbpValue) {
    status = 'missing_gbp';
  } else if (compareFn(siteValue, gbpValue)) {
    status = 'match';
  } else {
    status = 'mismatch';
  }

  return {
    id: id,
    label: label,
    siteValue: siteValue || '—',
    gbpValue: gbpValue || '—',
    status: status,
    hint: hint || '',
  };
}

function buildNapAuditReport(site, gbpLocation) {
  const gbp = gbpLocation || {};
  const siteName = site.name || '';
  const sitePhone = formatPhoneDisplay(site.phone || '');
  const siteWebsite = site.website || '';
  const siteCity = site.city || '';
  const siteHours = formatSiteHours(site);

  const gbpName = gbp.title || '';
  const gbpPhone = formatPhoneDisplay(
    (gbp.phoneNumbers && (gbp.phoneNumbers.primaryPhone || gbp.phoneNumbers.primary_phone)) || ''
  );
  const gbpWebsite = gbp.websiteUri || '';
  const gbpAddress = formatGbpAddress(gbp.storefrontAddress);
  const gbpCity = (gbp.storefrontAddress && gbp.storefrontAddress.locality) || gbpAddress;
  const gbpHours = formatGbpHours(gbp.regularHours);
  const gbpCategory =
    (gbp.primaryCategory && (gbp.primaryCategory.displayName || gbp.primaryCategory.name)) || '';

  const items = [
    compareField(
      'name',
      'اسم المنشأة (Name)',
      siteName,
      gbpName,
      function (a, b) { return normalizeText(a) === normalizeText(b); },
      'تأكد أن اسم العلامة في مكّن يطابق الاسم الرسمي على جوجل.'
    ),
    compareField(
      'phone',
      'الهاتف (Phone)',
      sitePhone,
      gbpPhone,
      function (a, b) { return normalizePhoneDigits(a) === normalizePhoneDigits(b); },
      'حدّث رقم الجوال في تبويب «العلامة والتواصل» أو على جوجل بيزنس.'
    ),
    compareField(
      'website',
      'الموقع الإلكتروني (Website)',
      siteWebsite,
      gbpWebsite,
      function (a, b) { return normalizeUrl(a) === normalizeUrl(b); },
      'استخدم زر «تحديث رابط الموقع» لمزامنة رابط mken تلقائياً.'
    ),
    compareField(
      'city',
      'المدينة / العنوان (Address)',
      siteCity,
      gbpCity,
      function (a, b) {
        const na = normalizeText(a);
        const nb = normalizeText(b);
        return na === nb || (na && nb.indexOf(na) !== -1) || (nb && na.indexOf(nb) !== -1);
      },
      'راجع المدينة في «خرائط جوجل ونطاق الخدمة» ومطابقة العنوان على GBP.'
    ),
    compareField(
      'hours',
      'ساعات العمل (Hours)',
      siteHours,
      gbpHours,
      function (a, b) {
        if (!a || !b) return false;
        const extract = function (s) { return String(s).replace(/\D/g, '').slice(0, 8); };
        return extract(a) === extract(b);
      },
      'ساعات mken مبسّطة (حجز) — قارن يدوياً مع جدول GBP إن اختلفت.'
    ),
  ];

  if (gbpCategory) {
    items.push({
      id: 'category',
      label: 'التصنيف الأساسي (Category)',
      siteValue: '—',
      gbpValue: gbpCategory,
      status: 'info',
      hint: 'للمراجعة فقط — لا يُقارن مع mken.',
    });
  }

  const scored = items.filter(function (item) {
    return item.status !== 'info' && item.status !== 'missing_both';
  });
  const matched = scored.filter(function (item) { return item.status === 'match'; }).length;
  const mismatches = scored.filter(function (item) { return item.status === 'mismatch'; }).length;
  const missing = scored.filter(function (item) {
    return item.status === 'missing_site' || item.status === 'missing_gbp';
  }).length;

  return {
    items: items,
    summary: {
      total: scored.length,
      matched: matched,
      mismatches: mismatches,
      missing: missing,
      scorePercent: scored.length ? Math.round((matched / scored.length) * 100) : 0,
      overall:
        mismatches === 0 && missing === 0 && matched === scored.length
          ? 'excellent'
          : mismatches === 0
            ? 'good'
            : mismatches <= 1
              ? 'fair'
              : 'poor',
    },
    gbpAddressFull: gbpAddress,
  };
}

function formatPhoneForGbp(phone) {
  const d = normalizePhoneDigits(phone);
  return d ? '+' + d : '';
}

function planNapSync(site, gbpLocation) {
  const report = buildNapAuditReport(site, gbpLocation);
  const patchBody = {};
  const updated = [];
  const skipped = [];
  const fieldLabels = {
    website: 'الموقع الإلكتروني',
    phone: 'الهاتف',
    name: 'اسم المنشأة',
    city: 'المدينة / العنوان',
    hours: 'ساعات العمل',
  };

  function itemById(id) {
    return report.items.find(function (i) { return i.id === id; });
  }

  function trySync(id, applyFn) {
    const item = itemById(id);
    if (!item) return;
    if (item.status === 'match') {
      skipped.push({ field: id, label: fieldLabels[id], reason: 'already_match' });
      return;
    }
    if (item.status === 'missing_site') {
      skipped.push({ field: id, label: fieldLabels[id], reason: 'missing_on_site' });
      return;
    }
    applyFn(item);
  }

  trySync('website', function () {
    if (!site.website) return;
    patchBody.websiteUri = String(site.website).trim();
    updated.push({ field: 'website', label: fieldLabels.website, value: patchBody.websiteUri });
  });

  trySync('phone', function () {
    const formatted = formatPhoneForGbp(site.phone);
    if (!formatted) return;
    patchBody.phoneNumbers = { primaryPhone: formatted };
    updated.push({ field: 'phone', label: fieldLabels.phone, value: formatPhoneDisplay(site.phone) });
  });

  trySync('name', function () {
    if (!site.name) return;
    patchBody.title = String(site.name).trim();
    updated.push({ field: 'name', label: fieldLabels.name, value: patchBody.title });
  });

  ['city', 'hours'].forEach(function (id) {
    const item = itemById(id);
    if (item && item.status !== 'match' && item.status !== 'missing_both') {
      skipped.push({ field: id, label: fieldLabels[id], reason: 'manual_only' });
    }
  });

  const updateMask = Object.keys(patchBody).join(',');
  return { report: report, patchBody: patchBody, updateMask: updateMask, updated: updated, skipped: skipped };
}

module.exports = {
  normalizePhoneDigits,
  normalizeUrl,
  normalizeText,
  formatGbpAddress,
  formatGbpHours,
  formatSiteHours,
  formatPhoneForGbp,
  formatPhoneDisplay,
  buildNapAuditReport,
  planNapSync,
};
