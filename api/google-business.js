const { getValidAccessToken, ensureTenantClient, getSupabaseAdmin } = require('./_lib/google-auth-helper');
const { authorizeGbpAiRequest } = require('./_lib/gbp-ai-guard');
const { buildNapAuditReport, planNapSync } = require('./_lib/nap-audit');

const GBP_POST_MAX_CHARS = 1500;
const GBP_LOCATION_READ_MASK = 'title,phoneNumbers,websiteUri,storefrontAddress,regularHours,primaryCategory';

async function callGemini(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured on the server (GEMINI_API_KEY)');
  }
  
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: promptText
        }]
      }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Gemini API request failed: ' + errText);
  }

  const data = await response.json();
  try {
    return data.candidates[0].content.parts[0].text;
  } catch (e) {
    throw new Error('Failed to parse Gemini API response structure');
  }
}

function normalizeTenantSlug(tenant) {
  return (tenant || 'default').trim() || 'default';
}

async function handleGoogleResponseError(res, defaultMessage) {
  const errText = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(errText);
  } catch (e) {}

  if (parsed && parsed.error) {
    const apiErr = parsed.error;
    if (apiErr.status === 'RESOURCE_EXHAUSTED' || (apiErr.message && apiErr.message.includes('Quota exceeded'))) {
      const isLimitZero = errText.includes('"quota_limit_value": "0"') || errText.includes('"quota_limit_value":"0"');
      if (isLimitZero) {
        throw new Error(
          'تم تجاوز الحصة (Quota Exceeded): القيمة المسموحة لطلب الخدمة هي 0. ' +
          'مشروع Google Cloud (رقم 529822765960) يحتاج إلى تفعيل وتصريح الوصول لـ Google Business Profile API. ' +
          'يرجى تعبئة نموذج طلب الوصول (Google Business Profile API Access Request Form) للحصول على حصة فعالة.'
        );
      }
    }
    throw new Error(defaultMessage + ': ' + apiErr.message);
  }
  throw new Error(defaultMessage + ': ' + errText);
}

function corsGet(req, res) {
  const { getSafeCorsOrigin } = require('./_lib/cors');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', getSafeCorsOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function corsPost(req, res) {
  const { getSafeCorsOrigin } = require('./_lib/cors');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', getSafeCorsOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Admin-Pin'
  );
}

function trimGbpPostText(text) {
  if (!text || text.length <= GBP_POST_MAX_CHARS) return text || '';
  return text.slice(0, GBP_POST_MAX_CHARS - 1).trim() + '…';
}

function getAction(req) {
  var url = req.url || '';
  if (url.indexOf('/callback') !== -1 || req.query.action === 'callback') return 'callback';
  if (url.indexOf('/locations') !== -1 || req.query.action === 'locations') return 'locations';
  if (url.indexOf('/update-website') !== -1 || req.query.action === 'update-website') return 'update-website';
  if (url.indexOf('/sync-services') !== -1 || req.query.action === 'sync-services') return 'sync-services';
  if (url.indexOf('/auth-url') !== -1 || req.query.action === 'auth-url') return 'auth-url';
  if (url.indexOf('/generate-post') !== -1 || req.query.action === 'generate-post') return 'generate-post';
  if (url.indexOf('/generate-reply') !== -1 || req.query.action === 'generate-reply') return 'generate-reply';
  if (url.indexOf('/nap-audit') !== -1 || req.query.action === 'nap-audit') return 'nap-audit';
  if (url.indexOf('/sync-nap') !== -1 || req.query.action === 'sync-nap') return 'sync-nap';
  if (url.indexOf('/competitors') !== -1 || req.query.action === 'competitors') return 'competitors';
  if (req.query.code && req.query.state) return 'callback';
  return 'auth-url';
}

async function handleAuthUrl(req, res) {
  const tenant = normalizeTenantSlug(req.query.tenant);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: 'Google OAuth is not configured on the server. Please check environment variables (GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI).',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
    state: tenant,
  });

  return res.status(200).json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString() });
}

async function handleCallback(req, res) {
  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;
  const host = req.headers.host || 'mken.live';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const baseRedirectUrl = protocol + '://' + host + '/admin.html';

  if (error) {
    return res.redirect(baseRedirectUrl + '?google_connect=error&error_desc=' + encodeURIComponent(error));
  }

  if (!code || !state) {
    return res.redirect(baseRedirectUrl + '?google_connect=error&error_desc=' + encodeURIComponent('Missing code or state parameter'));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth credentials not configured on the server');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new Error('Google token exchange failed: ' + (await tokenRes.text()));
  }

  const tokenData = await tokenRes.json();
  const expiryDate = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
  const tenantSlug = normalizeTenantSlug(state);
  const supabase = getSupabaseAdmin();
  await ensureTenantClient(supabase, tenantSlug);

  const updateData = {
    google_access_token: tokenData.access_token,
    google_token_expiry: expiryDate,
    updated_at: new Date().toISOString(),
  };
  if (tokenData.refresh_token) {
    updateData.google_refresh_token = tokenData.refresh_token;
  }

  const { error: updateError } = await supabase
    .from('mken_saas_clients')
    .update(updateData)
    .eq('tenant_slug', tenantSlug);

  if (updateError) throw updateError;
  return res.redirect(baseRedirectUrl + '?tenant=' + encodeURIComponent(tenantSlug) + '&google_connect=success');
}

async function handleLocations(req, res) {
  const tenant = normalizeTenantSlug(req.query.tenant);

  let accessToken;
  try {
    accessToken = await getValidAccessToken(tenant);
  } catch (authErr) {
    if (authErr.message.includes('not connected')) {
      return res.status(200).json({ connected: false, locations: [] });
    }
    throw authErr;
  }

  const supabase = getSupabaseAdmin();
  const { data: client } = await supabase
    .from('mken_saas_clients')
    .select('google_business_location_id')
    .eq('tenant_slug', tenant)
    .maybeSingle();

  const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: 'Bearer ' + accessToken },
  });

  if (!accountsRes.ok) {
    await handleGoogleResponseError(accountsRes, 'Failed to fetch Google accounts');
  }

  const accountsData = await accountsRes.json();
  let allLocations = [];

  for (const account of (accountsData.accounts || [])) {
    const locationsRes = await fetch(
      'https://mybusinessbusinessinformation.googleapis.com/v1/' + account.name + '/locations?readMask=name,title,websiteUri,metadata,latlng,storefrontAddress',
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );

    if (locationsRes.ok) {
      const locationsData = await locationsRes.json();
      allLocations = allLocations.concat((locationsData.locations || []).map(function (loc) {
        return {
          id: loc.name,
          title: loc.title,
          websiteUri: loc.websiteUri || '',
          newReviewUrl: (loc.metadata && loc.metadata.newReviewUrl) || '',
          mapsUri: (loc.metadata && loc.metadata.mapsUri) || '',
          placeId: (loc.metadata && loc.metadata.placeId) || '',
          lat: (loc.latlng && loc.latlng.latitude) || '',
          lng: (loc.latlng && loc.latlng.longitude) || '',
          city: (loc.storefrontAddress && loc.storefrontAddress.locality) || ''
        };
      }));
    }
  }

  return res.status(200).json({
    connected: true,
    selectedLocationId: client ? client.google_business_location_id : null,
    locations: allLocations,
  });
}

async function handleUpdateWebsite(req, res) {
  const { locationId, websiteUrl, action } = req.body || {};
  const tenant = normalizeTenantSlug(req.body && req.body.tenant);

  const supabase = getSupabaseAdmin();
  await ensureTenantClient(supabase, tenant);

  if (action === 'disconnect') {
    const { error: updateError } = await supabase
      .from('mken_saas_clients')
      .update({
        google_access_token: null,
        google_refresh_token: null,
        google_token_expiry: null,
        google_business_location_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_slug', tenant);

    if (updateError) throw updateError;
    return res.status(200).json({ success: true, message: 'Disconnected Google account successfully' });
  }

  if (!locationId || !websiteUrl) {
    return res.status(400).json({ error: 'locationId and websiteUrl are required for update action' });
  }

  const accessToken = await getValidAccessToken(tenant);
  const googleApiUrl = 'https://mybusinessbusinessinformation.googleapis.com/v1/' + locationId + '?updateMask=websiteUri';
  const updateRes = await fetch(googleApiUrl, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ websiteUri: websiteUrl }),
  });

  if (!updateRes.ok) {
    await handleGoogleResponseError(updateRes, 'Google API update failed');
  }

  const { error: dbError } = await supabase
    .from('mken_saas_clients')
    .update({
      google_business_location_id: locationId,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_slug', tenant);

  if (dbError) throw dbError;
  return res.status(200).json({ success: true, message: 'Website URL updated successfully on Google Business Profile' });
}

async function handleSyncServices(req, res) {
  const { locationId, services } = req.body || {};
  const tenant = normalizeTenantSlug(req.body && req.body.tenant);

  if (!locationId) {
    return res.status(400).json({ error: 'locationId is required' });
  }
  if (!services || !Array.isArray(services)) {
    return res.status(400).json({ error: 'services array is required' });
  }

  const accessToken = await getValidAccessToken(tenant);

  // 1. Get the primary category of the location
  const categoryRes = await fetch('https://mybusinessbusinessinformation.googleapis.com/v1/' + locationId + '?readMask=primaryCategory', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });

  if (!categoryRes.ok) {
    await handleGoogleResponseError(categoryRes, 'Failed to fetch Google location primary category');
  }

  const categoryData = await categoryRes.json();
  const categoryId = (categoryData.primaryCategory && categoryData.primaryCategory.name) || '';

  if (!categoryId) {
    throw new Error('Google location does not have a primary category set');
  }

  // 2. Format services as freeFormServiceItems
  const serviceItems = services.map(function (svc) {
    const title = typeof svc === 'string' ? svc : (svc.title || '');
    const desc = typeof svc === 'string' ? '' : (svc.description || '');

    const freeFormItem = {
      category: categoryId,
      label: {
        displayName: title,
        languageCode: 'ar'
      }
    };

    if (desc) {
      freeFormItem.label.description = desc;
    }

    return {
      freeFormServiceItem: freeFormItem
    };
  });

  // 3. Patch the location's serviceItems
  const googleApiUrl = 'https://mybusinessbusinessinformation.googleapis.com/v1/' + locationId + '?updateMask=serviceItems';
  const updateRes = await fetch(googleApiUrl, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ serviceItems: serviceItems }),
  });

  if (!updateRes.ok) {
    await handleGoogleResponseError(updateRes, 'Google API update failed');
  }

  return res.status(200).json({ success: true, message: 'Services synchronized successfully on Google Business Profile' });
}

async function handleCompetitors(req, res) {
  const auth = await authorizeGbpAiRequest(req, res, 'competitors');
  if (!auth) return;

  const { lat, lng, category, city } = req.body || {};
  const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (mapsApiKey) {
    try {
      const query = encodeURIComponent((category || 'خدمات') + ' ' + (city || ''));
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${lat || '21.485811'},${lng || '39.192505'}&radius=5000&key=${mapsApiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Places API returned ' + response.status);
      
      const data = await response.json();
      const results = (data.results || []).slice(0, 5).map(function (item) {
        return {
          name: item.name,
          rating: item.rating || 0,
          userRatingsTotal: item.user_ratings_total || 0,
          address: item.formatted_address || '',
          placeId: item.place_id
        };
      });
      return res.status(200).json({ success: true, competitors: results, source: 'google_places' });
    } catch (e) {
      console.warn('Google Places API failed, falling back to Gemini simulation', e);
    }
  }

  const prompt = `أريد منك جلب أو محاكاة 4 منافسين حقيقيين ومشهورين في نفس مجال ونشاط المنشأة في هذه المدينة.
النشاط: "${category || 'صالون حلاقة ورعاية'}"
المدينة: "${city || 'جدة'}"

شروط الإرجاع:
1. أرجع النتيجة على شكل مصفوفة JSON صالحة ومباشرة فقط دون أي نصوص تمهيدية أو شرح أو علامات ترميز (ممنوع كتابة \`\`\`json أو أي شيء، فقط أرجع مصفوفة JSON تبدأ بـ [ وتنتهي بـ ]).
2. يجب أن يحتوي كل عنصر في المصفوفة على الحقول التالية:
   - "name": اسم المنافس باللغة العربية.
   - "rating": تقييم تقريبي بين 3.8 و 4.9 (عدد عشري).
   - "userRatingsTotal": عدد التقييمات التقريبي بين 50 و 1500 (عدد صحيح).
   - "address": عنوان تقريبي في المدينة المذكورة.
3. تأكد من أن الأسماء لمنافسين حقيقيين أو واقعيين جداً في تلك المدينة.`;

  try {
    const aiText = await callGemini(prompt);
    let cleanJson = aiText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }
    const competitors = JSON.parse(cleanJson);
    return res.status(200).json({ success: true, competitors: competitors, source: 'gemini_simulation' });
  } catch (err) {
    console.error('Gemini Competitor Simulation failed:', err);
    const safetyCompetitors = [
      { name: 'صالون الأناقة والجمال الراقي', rating: 4.6, userRatingsTotal: 340, address: 'شارع التحلية، جدة' },
      { name: 'صالون الحلاقة الذهبي للرجال', rating: 4.4, userRatingsTotal: 180, address: 'شارع الأمير سلطان، جدة' },
      { name: 'مركز عناية الرجل المتكامل', rating: 4.7, userRatingsTotal: 520, address: 'حي النعيم، جدة' }
    ];
    return res.status(200).json({ success: true, competitors: safetyCompetitors, source: 'static_fallback' });
  }
}

async function handleNapAudit(req, res) {
  const auth = await authorizeGbpAiRequest(req, res, 'nap-audit');
  if (!auth) return;

  const { locationId, site } = req.body || {};
  const tenant = auth.tenantSlug;

  if (!locationId) {
    return res.status(400).json({ error: 'locationId is required' });
  }

  const accessToken = await getValidAccessToken(tenant);
  const gbpLocation = await fetchGbpLocation(locationId, accessToken);
  const report = buildNapAuditReport(site || {}, gbpLocation);

  return res.status(200).json({ success: true, report: report });
}

async function fetchGbpLocation(locationId, accessToken) {
  const locationRes = await fetch(
    'https://mybusinessbusinessinformation.googleapis.com/v1/' + locationId + '?readMask=' + GBP_LOCATION_READ_MASK,
    { headers: { Authorization: 'Bearer ' + accessToken } }
  );
  if (!locationRes.ok) {
    await handleGoogleResponseError(locationRes, 'Failed to fetch Google location');
  }
  return locationRes.json();
}

async function handleSyncNap(req, res) {
  const auth = await authorizeGbpAiRequest(req, res, 'sync-nap');
  if (!auth) return;

  const { locationId, site } = req.body || {};
  const tenant = auth.tenantSlug;

  if (!locationId) {
    return res.status(400).json({ error: 'locationId is required' });
  }
  if (!site || typeof site !== 'object') {
    return res.status(400).json({ error: 'site snapshot is required' });
  }

  const accessToken = await getValidAccessToken(tenant);
  const gbpLocation = await fetchGbpLocation(locationId, accessToken);
  const plan = planNapSync(site, gbpLocation);

  if (!plan.updateMask) {
    return res.status(200).json({
      success: true,
      updated: [],
      skipped: plan.skipped,
      report: plan.report,
      message: 'لا توجد حقول قابلة للمزامنة التلقائية — البيانات متطابقة أو ناقصة في mken.',
    });
  }

  const updateRes = await fetch(
    'https://mybusinessbusinessinformation.googleapis.com/v1/' + locationId + '?updateMask=' + plan.updateMask,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(plan.patchBody),
    }
  );

  if (!updateRes.ok) {
    await handleGoogleResponseError(updateRes, 'Google API NAP sync failed');
  }

  const supabase = getSupabaseAdmin();
  await ensureTenantClient(supabase, tenant);
  const { error: dbError } = await supabase
    .from('mken_saas_clients')
    .update({
      google_business_location_id: locationId,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_slug', tenant);
  if (dbError) throw dbError;

  const afterLocation = await fetchGbpLocation(locationId, accessToken);
  const afterReport = buildNapAuditReport(site, afterLocation);

  return res.status(200).json({
    success: true,
    updated: plan.updated,
    skipped: plan.skipped,
    report: afterReport,
    message: 'تمت مزامنة ' + plan.updated.length + ' حقل/حقول إلى جوجل بيزنس بنجاح.',
  });
}

module.exports = async function handler(req, res) {
  const action = getAction(req);

  if (action === 'callback') {
    try {
      return await handleCallback(req, res);
    } catch (err) {
      console.error('OAuth Callback Error:', err);
      const state = req.query.state || '';
      const host = req.headers.host || 'mken.live';
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      return res.redirect(protocol + '://' + host + '/admin.html?tenant=' + encodeURIComponent(state) + '&google_connect=error&error_desc=' + encodeURIComponent(err.message));
    }
  }

  if (action === 'update-website') {
    corsPost(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      const auth = await authorizeGbpAiRequest(req, res, 'update-website');
      if (!auth) return;
      return await handleUpdateWebsite(req, res);
    } catch (err) {
      console.error('Update Google Business Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'sync-services') {
    corsPost(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      const auth = await authorizeGbpAiRequest(req, res, 'sync-services');
      if (!auth) return;
      return await handleSyncServices(req, res);
    } catch (err) {
      console.error('Sync Google Business Services Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'generate-post') {
    corsPost(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      const auth = await authorizeGbpAiRequest(req, res, 'generate-post');
      if (!auth) return;

      const { prompt, businessName, serviceName } = req.body || {};
      if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'prompt is required' });
      if (String(prompt).length > 2000) {
        return res.status(400).json({ error: 'prompt is too long (max 2000 characters)' });
      }
      
      const systemPrompt = `أنت خبير سيو محلي (Local SEO) متمرس. اكتب منشور تسويقي جذاب وملائم لخرائط جوجل (Google Business Profile) باللغة العربية.
اسم المنشأة: "${businessName || 'مشروعنا'}"
الخدمة أو العرض المستهدف: "${serviceName || ''}"
تفاصيل إضافية من التاجر: "${prompt}"

شروط الكتابة:
1. اكتب بنبرة مهنية وترحيبية تلائم الجمهور السعودي والعربي، واستخدم الرموز التعبيرية (Emojis) بشكل معقول.
2. ركز على حث العميل على اتخاذ إجراء (Call to Action) مثل الحجز أو الاتصال.
3. استخدم كلمات مفتاحية طبيعية ومحسنة لمحركات البحث المحلية.
4. لا تذكر أي روابط أو أرقام هواتف إلا إذا حددها المستخدم.
5. اجعل المنشور قصيراً ومباشراً ومناسباً لمتصفحي خرائط جوجل.
6. لا تتجاوز ${GBP_POST_MAX_CHARS} حرفاً في النص النهائي.`;

      const generatedText = trimGbpPostText(await callGemini(systemPrompt));
      return res.status(200).json({ success: true, text: generatedText });
    } catch (err) {
      console.error('Generate Post Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'generate-reply') {
    corsPost(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      const auth = await authorizeGbpAiRequest(req, res, 'generate-reply');
      if (!auth) return;

      const { reviewText, rating, businessName } = req.body || {};
      if (!reviewText && !rating) return res.status(400).json({ error: 'reviewText or rating is required' });
      if (reviewText && String(reviewText).length > 2000) {
        return res.status(400).json({ error: 'reviewText is too long (max 2000 characters)' });
      }
      
      const systemPrompt = `أنت ممثل خدمة عملاء محترف لشركة "${businessName || 'نشاطنا التجاري'}". اكتب رداً لبقاً واحترافياً باللغة العربية للرد على تقييم عميل على خرائط جوجل.
تقييم العميل: ${rating ? rating + ' نجوم' : 'غير محدد'}
نص المراجعة: "${reviewText || 'لا يوجد نص مراجعة، فقط تقييم بالنجوم'}"

شروط الرد:
1. إذا كان التقييم إيجابياً (4-5 نجوم)، اشكر العميل بعبارات لطيفة ودافئة وعبر عن سعادتك بخدمته.
2. إذا كان التقييم سلبياً (1-3 نجوم)، كن متعاطفاً للغاية، اعتذر عن التقصير بأدب ووقار، واقترح عليه التواصل لحل المشكلة (دون ذكر رقم محدد إلا بشكل عام مثل "يسعدنا تواصلكم معنا عبر أرقامنا الرسمية").
3. اكتب باللغة العربية الفصحى أو بلهجة بيضاء مهذبة ومناسبة.
4. حافظ على الإيجاز والاحترافية.`;

      const generatedText = await callGemini(systemPrompt);
      return res.status(200).json({ success: true, text: generatedText });
    } catch (err) {
      console.error('Generate Reply Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'nap-audit') {
    corsPost(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      return await handleNapAudit(req, res);
    } catch (err) {
      console.error('NAP Audit Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'sync-nap') {
    corsPost(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      return await handleSyncNap(req, res);
    } catch (err) {
      console.error('NAP Sync Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'competitors') {
    corsPost(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    try {
      return await handleCompetitors(req, res);
    } catch (err) {
      console.error('Competitors Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  corsGet(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    if (action === 'locations') {
      const auth = await authorizeGbpAiRequest(req, res, 'locations');
      if (!auth) return;
      return await handleLocations(req, res);
    }
    const auth = await authorizeGbpAiRequest(req, res, 'auth-url');
    if (!auth) return;
    return await handleAuthUrl(req, res);
  } catch (err) {
    console.error('Google Business Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
