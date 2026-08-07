'use strict';

/**
 * WhatsApp AI Sales Agent
 *
 * Turns inbound WhatsApp messages into intelligent, persuasive conversations
 * powered by Gemini. The agent knows the tenant's brand, services, prices and
 * booking links and acts as an enthusiastic marketing/sales assistant.
 *
 * Critical operations (cancel / view appointments) are still handled locally
 * in the webhook for speed and reliability; this module handles everything else.
 */

// ---------- Tenant context builder ----------

function resolveSiteDomain(config) {
  const baseDomain = (config.saas && config.saas.baseDomain) || config.domain || 'mken.live';
  return config.subdomain ? config.subdomain + '.' + baseDomain : baseDomain;
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

/**
 * Build a compact text knowledge base for the tenant so the AI knows what it
 * can and cannot offer. We never invent data — we only surface what the tenant
 * has configured.
 */
function buildTenantContext(config) {
  const lines = [];
  const brand = config.brand || {};
  const domain = resolveSiteDomain(config);

  lines.push('### معلومات المنشأة');
  if (brand.name) lines.push('- الاسم: ' + brand.name);
  if (brand.tagline) lines.push('- الوصف: ' + brand.tagline);
  if (config.phone) lines.push('- رقم التواصل: ' + config.phone);
  if (config.serviceArea) {
    const area = typeof config.serviceArea === 'object'
      ? (config.serviceArea.city || config.serviceArea.name || config.serviceArea.value || JSON.stringify(config.serviceArea))
      : String(config.serviceArea);
    if (area && area !== '{}') lines.push('- منطقة الخدمة: ' + area);
  }
  if (config.booking && config.booking.hours) {
    const hours = typeof config.booking.hours === 'object'
      ? JSON.stringify(config.booking.hours)
      : String(config.booking.hours);
    lines.push('- ساعات العمل: ' + hours);
  }

  lines.push('- رابط الحجز والدفع المباشر: https://' + domain + '/book.html');
  lines.push('- متجر المنتجات: https://' + domain + '/order.html');

  // Services / catalog
  const services = config.services || {};
  const serviceKeys = Object.keys(services);
  if (serviceKeys.length > 0) {
    lines.push('');
    lines.push('### كتالوج الخدمات والأسعار (استخدم هذه المعلومات فقط ولا تخترع أسعاراً)');
    let added = 0;
    for (const key of serviceKeys) {
      if (added >= 12) break; // keep context compact
      const s = services[key];
      if (!s || typeof s !== 'object') continue;
      const parts = [];
      if (s.title) parts.push(s.title);
      if (s.shortTitle && s.shortTitle !== s.title) parts.push('(' + s.shortTitle + ')');
      if (s.price != null) parts.push('— السعر: ' + s.price + (s.currency ? ' ' + s.currency : ''));
      if (s.description) parts.push('\n   ' + truncate(s.description, 160));
      if (parts.length > 0) {
        const icon = s.icon ? s.icon + ' ' : '• ';
        lines.push(icon + parts.join(' '));
        added++;
      }
    }
    if (serviceKeys.length > 12) {
      lines.push('• (ويوجد ' + (serviceKeys.length - 12) + ' خدمات إضافية في الكتالوج)');
    }
  }

  // Activities (top-level service categories)
  const activities = config.activities || {};
  const actKeys = Object.keys(activities).filter(k => activities[k] && activities[k].title);
  if (actKeys.length > 0) {
    lines.push('');
    lines.push('### الأقسام الرئيسية: ' + actKeys.slice(0, 8).map(k => activities[k].title).join('، '));
  }

  return lines.join('\n');
}

// ---------- System prompt ----------

function buildSystemPrompt(config, tenantContext, customerPhone, appointmentsInfo, conversationHistory, activityId) {
  const brandName = (config.brand && config.brand.name) || 'مكّن لايف';
  const domain = resolveSiteDomain(config);

  let prompt = 'أنت مستشار خدمة عملاء ومبيعات محترف تعمل لصالح "' + brandName + '".';
  prompt += ' تتواصل مع العملاء عبر واتساب لمساعدتهم وحل مشاكلهم وإقناعهم بخدماتنا.\n\n';

  // Core customer-service skills (from requirements)
  prompt += '## مهاراتك الأساسية (طبّقها دائماً)\n\n';

  prompt += '**١. الإصغاء النشط والفهم من المرة الأولى**\n';
  prompt += '- افهم سؤال العميل أو مشكلته من رسالته مباشرة دون طلب التكرار.\n';
  prompt += '- ركّز على ما يقصده العميل فعلاً، لا على الكلمات الحرفية.\n';
  prompt += '- إن كان كلامه غامضاً قليلاً، خمّن القصد الأرجح من السياق وأجب.\n\n';

  prompt += '**٢. التعاطف وامتصاص الغضب**\n';
  prompt += '- إن بدا العميل محبطاً أو غاضباً، ابدأ بالتعاطف: "أتفهم تماماً إحباطك، وهذا حقك".\n';
  prompt += '- اعترف بمشاعره قبل تقديم الحل، ولا تأخذ الأمور بشكل شخصي.\n';
  prompt += '- حوّل التجربة السلبية لإيجابية بحل واضح وخطوات محددة.\n\n';

  prompt += '**٣. التواصل الواضح والمباشر**\n';
  prompt += '- استخدم لغة بسيطة يفهمها أي عميل، وتجنّب المصطلحات التقنية المعقدة.\n';
  prompt += '- وضّح الخطوات المتخذة لحل المشكلة بترتيب منطقي.\n\n';

  prompt += '**٤. التفكير التحليلي وحل المشكلات**\n';
  prompt += '- شخّص جذر المشكلة قبل إعطاء حل سطحي.\n';
  prompt += '- اسأل سؤالاً استيضاحياً واحداً فقط عند الضرورة (مثل: "هل تقصد كذا؟").\n';
  prompt += '- لا تتكل على نص جاهز — خصّص ردك لكل عميل.\n\n';

  prompt += '**٥. الكفاءة وإدارة الوقت**\n';
  prompt += '- كن موجزاً وفعالاً. ردك من ٢ إلى ٥ جمل عادة.\n';
  prompt += '- لا تكرر معلومات سبق وأعطيتها للعميل في نفس المحادثة.\n\n';

  // Sales focus
  prompt += '## مهارات البيع والإقناع\n';
  prompt += '- ركّز على القيمة والفائدة للعميل، لا على الميزات التقنية.\n';
  prompt += '- اربط كل خدمة بحاجة العميل التي ذكرها.\n';
  prompt += '- استخدم دعوة لطيفة للإجراء عند المناسبة: "أساعدك في الحجز الآن؟".\n';
  prompt += '- رابط الحجز: https://' + domain + '/book.html (لا تكرره في كل رسالة، فقط عند الحاجة).\n\n';

  // Language rules
  prompt += '## اللغة (قواعد صارمة)\n';
  prompt += '- اكتب بالعربية الفصحى المبسطة فقط.\n';
  prompt += '- ممنوع خلط العربية بالإنجليزية في نفس الجملة.\n';
  prompt += '- لا تستخدم كلمات إنجليزية — استخدم مرادفاتها العربية (حجز، خدمة، سعر).\n';
  prompt += '- استثناء: الروابط والأرقام فقط.\n\n';

  // Format rules
  prompt += '## صيغة الرد\n';
  prompt += '- اكتب نصاً عادياً يُرسل مباشرة في واتساب.\n';
  prompt += '- ممنوع JSON، ممنوع Markdown (لا * ولا #)، ممنوع عناوين فرعية.\n';
  prompt += '- لا تكتب عناوين بالإنجليزية مثل "Core Answer" أو "Features".\n';
  prompt += '- اكتب جملاً متصلة وطبيعية.\n\n';

  // Strict rules
  prompt += '## قواعد أخيرة\n';
  prompt += '- لا تخترع أسعاراً أو خدمات غير موجودة في الكتالوج.\n';
  prompt += '- إن لم تعرف إجابة، اعتذر بأدب ووجّه العميل للحجز.\n';
  prompt += '- لا تذكر أنك ذكاء اصطناعي — أنت "مستشار خدمة العملاء" في ' + brandName + '.\n';
  prompt += '- ذكّر باسم ' + brandName + ' عند الترحيب، لا تستخدم أسماء أخرى.\n\n';

  prompt += '## معرفتك عن ' + brandName + '\n';
  prompt += tenantContext + '\n\n';

  // Activity-scoped context (Strict Data Isolation): when an activity is
  // detected, the agent must answer ONLY within that activity's domain and
  // never reference services/knowledge from other activities.
  if (activityId) {
    var activityContext = '';
    try {
      const router = require('./activity-router');
      activityContext = router.buildActivityContext(activityId, config);
    } catch (e) {}
    if (activityContext) {
      prompt += activityContext + '\n\n';
      prompt += 'مهم: هذه المحادثة ضمن نشاط محدد. أجب العميل فقط عن خدمات هذا النشاط، ';
      prompt += 'ولا تذكر أو تقترح خدمات من أنشطة أخرى.\n\n';
    }
  }

  if (appointmentsInfo) {
    prompt += '## مواعيد هذا العميل\n';
    prompt += appointmentsInfo + '\n\n';
  }

  // Conversation memory
  if (conversationHistory && conversationHistory.length > 0) {
    prompt += '## محادثة سابقة مع هذا العميل (الأحدث في الأسفل)\n';
    for (const turn of conversationHistory) {
      prompt += (turn.role === 'customer' ? 'العميل: ' : 'أنت: ') + turn.text + '\n';
    }
    prompt += '\nتابع المحادثة بشكل طبيعي واربط بردك بما سبق. لا تكرر ترحيباً إذا سبق ورحّبت.\n\n';
  }

  prompt += 'الآن رُد على آخر رسالة من العميل بالعربية، بأسلوب طبيعي ومقنع.';

  return prompt;
}

/**
 * Build Gemini "contents" array with multi-turn conversation history.
 * Falls back to a single user turn if no history.
 */
function buildContents(userMessage, conversationHistory) {
  const contents = [];

  if (conversationHistory && conversationHistory.length > 0) {
    for (const turn of conversationHistory) {
      contents.push({
        role: turn.role === 'customer' ? 'user' : 'model',
        parts: [{ text: turn.text }]
      });
    }
  }

  // Current message
  contents.push({ role: 'user', parts: [{ text: userMessage }] });
  return contents;
}

// ---------- Gemini call ----------

// Models are tried in order; the first that succeeds wins.
// Stronger/newer models come first because weaker ones (gemini-flash-latest
// points to a 1.5-era model that ignores Arabic-only instructions and emits
// English markdown). An env override (GEMINI_MODEL) always wins.
function getModelCandidates() {
  const override = (process.env.GEMINI_MODEL || '').trim();
  const list = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.0-flash-001',
    'gemini-1.5-flash-latest',
    'gemini-flash-latest'
  ];
  return override ? [override].concat(list) : list;
}

async function callGemini(systemPrompt, contents) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: contents,
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  };

  const models = getModelCandidates();
  let lastErr = null;

  for (const model of models) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/'
      + encodeURIComponent(model) + ':generateContent?key=' + apiKey;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      lastErr = e;
      continue;
    }

    // 404 = model not available for this key; try the next one.
    if (response.status === 404) {
      lastErr = new Error('model ' + model + ' not found (404)');
      continue;
    }

    if (!response.ok) {
      const errText = await response.text();
      lastErr = new Error('Gemini API failed (' + response.status + '): ' + errText.slice(0, 200));
      // 400/401/403 = auth or request-shape problem; another model won't help.
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        break;
      }
      continue;
    }

    const data = await response.json();
    try {
      const text = data.candidates[0].content.parts[0].text;
      console.log('AI agent: success with model', model);
      return extractReply(text);
    } catch (e) {
      lastErr = new Error('Could not parse Gemini response from ' + model);
      continue;
    }
  }

  throw lastErr || new Error('All Gemini models failed');
}

/**
 * Extract the reply text from Gemini's response.
 * Prefers strict {"reply":"..."} JSON; falls back to the raw text if parsing
 * fails so the customer still gets an answer.
 */
function extractReply(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Strip code fences if present
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed.reply === 'string') {
      return parsed.reply.trim();
    }
  } catch (e) {
    // Not valid JSON — try to find a "reply" key with regex
    const m = candidate.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m && m[1]) {
      try {
        return JSON.parse('"' + m[1] + '"').trim();
      } catch (e2) {
        return m[1];
      }
    }
  }

  // Fallback: return the text as-is (minus any stray code fences)
  return candidate;
}

/**
 * Sanitize the AI reply into clean WhatsApp-friendly Arabic text.
 * Weak models sometimes emit markdown, English section headers, or bullet
 * lists even when told not to. We strip those so the customer never sees
 * raw formatting artifacts.
 */
function sanitizeReply(text) {
  if (!text) return '';
  let out = text.trim();

  // Extract content from markdown code fences first (keep what's inside)
  out = out.replace(/```(?:json)?\s*([\s\S]*?)```/g, function (m, inner) {
    // If the inner content is JSON with a reply field, extract it
    try {
      const parsed = JSON.parse(inner.trim());
      if (parsed && typeof parsed.reply === 'string') return parsed.reply;
    } catch (e) {}
    return inner;
  });
  out = out.replace(/```/g, '');

  // Remove markdown headers (# Title) — keep the text after the #
  out = out.replace(/^#{1,6}\s*/gm, '');

  // Remove markdown bullet/number markers at line starts
  out = out.replace(/^\s*[*\-•]\s+/gm, '');
  out = out.replace(/^\s*\d+[.)]\s+/gm, '');

  // Remove stray bold/italic markers
  out = out.replace(/\*\*(.*?)\*\*/g, '$1');
  out = out.replace(/__(.*?)__/g, '$1');
  out = out.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '$1');

  // Drop lines that are English-only or English-dominant "section headers".
  // Keep a line only if it contains Arabic characters OR is a URL/blank.
  out = out.split('\n').filter(function (line) {
    const t = line.trim();
    if (!t) return true; // keep blank lines (will be collapsed later)
    // Keep lines containing Arabic characters
    if (/[\u0600-\u06FF]/.test(t)) return true;
    // Keep URLs
    if (/^https?:\/\//.test(t)) return true;
    // Drop everything else (pure English / symbols / headers)
    return false;
  }).join('\n');

  // Collapse 3+ newlines into 2
  out = out.replace(/\n{3,}/g, '\n\n');

  // Trim each line and the whole thing
  out = out.split('\n').map(function (l) { return l.trim(); }).join('\n').trim();

  return out;
}

// ---------- Public API ----------

/**
 * Generate an AI sales reply for an inbound message.
 *
 * @param {string} userMessage  - the customer's message text
 * @param {object} config       - tenant config_data
 * @param {string} tenantSlug
 * @param {string} customerPhone
 * @param {string|null} appointmentsInfo - pre-fetched appointment summary (optional)
 * @param {Array|null} conversationHistory - [{role:'customer'|'agent', text:'...'}, ...]
 * @param {string|null} activityId - detected business activity for context isolation
 * @returns {Promise<string>} the reply text, or '' if generation failed
 */
async function generateAIReply(userMessage, config, tenantSlug, customerPhone, appointmentsInfo, conversationHistory, activityId) {
  const tenantContext = buildTenantContext(config);
  const systemPrompt = buildSystemPrompt(config, tenantContext, customerPhone, appointmentsInfo || null, conversationHistory || [], activityId || null);
  const contents = buildContents(userMessage, conversationHistory || []);

  try {
    const reply = await callGemini(systemPrompt, contents);
    return sanitizeReply(reply);
  } catch (err) {
    console.error('AI agent error:', err.message);
    return ''; // webhook will fall back to a safe message
  }
}

module.exports = {
  buildTenantContext: buildTenantContext,
  buildSystemPrompt: buildSystemPrompt,
  generateAIReply: generateAIReply,
  resolveSiteDomain: resolveSiteDomain,
};
