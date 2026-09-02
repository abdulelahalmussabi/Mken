/**
 * Smart review funnel — inbound 1–5 star replies after a post-visit WhatsApp survey.
 * Used by api/whatsapp-webhook.js. Missing table is non-fatal.
 */

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0')) return '966' + digits.slice(1);
  if (digits.length === 9) return '966' + digits;
  return digits;
}

function parseStarRating(text) {
  const trimmed = String(text || '').trim();
  const digit = trimmed.match(/^([1-5])(?:\s*(?:نجوم|نجمة|star|stars))?$/i);
  if (digit) return Number(digit[1]);
  if (/ممتاز|رائع|خمس/.test(trimmed)) return 5;
  if (/جيد جدا|أربع/.test(trimmed)) return 4;
  if (/متوسط|ثلاث/.test(trimmed)) return 3;
  if (/سيء|سيئ|نجمتين/.test(trimmed)) return 2;
  if (/فظيع|نجمة واحدة|أسوأ/.test(trimmed)) return 1;
  return null;
}

async function handleRatingReply(supabase, tenantSlug, phoneRaw, text) {
  if (!supabase || !tenantSlug) return null;
  const phone = normalizePhone(phoneRaw);
  const stars = parseStarRating(text);
  if (!phone || !stars) return null;

  const { data, error } = await supabase
    .from('mken_review_requests')
    .select('id, customer_name, google_review_url')
    .eq('tenant_slug', tenantSlug)
    .eq('phone', phone)
    .eq('status', 'SENT')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.id) return null;

  if (stars >= 4) {
    const url = data.google_review_url || '';
    await supabase
      .from('mken_review_requests')
      .update({
        stars,
        status: url ? 'RATED_GOOGLE' : 'RATED_INTERNAL',
        rated_at: new Date().toISOString()
      })
      .eq('id', data.id);
    const name = data.customer_name ? ' ' + data.customer_name : '';
    return url
      ? 'شكراً لك' + name + '. يسعدنا تقييمك على خرائط جوجل من هنا:\n' + url
      : 'شكراً لتقييمك ' + stars + ' نجوم. نقدّر ثقتك.';
  }

  await supabase
    .from('mken_review_requests')
    .update({
      stars,
      status: 'RATED_INTERNAL',
      rated_at: new Date().toISOString()
    })
    .eq('id', data.id);

  return 'نأسف إن التجربة ما كانت على المطلوب. اكتب ملاحظتك هنا وسنعالجها مع المدير فوراً — بدون نشر على الخرائط.';
}

module.exports = { handleRatingReply, parseStarRating };
