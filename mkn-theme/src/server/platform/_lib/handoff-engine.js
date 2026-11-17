'use strict';

/**
 * Handoff Engine — manages the transition of a WhatsApp conversation from
 * the AI bot to a human staff member.
 *
 * State machine:
 *   bot → handoff → human → closed
 *
 * The webhook calls:
 *  - getOrCreateSession()   on every inbound to load/check the session state
 *  - isHandoffRequested()   to detect explicit "I want a human" messages
 *  - attemptHandoff()       to find an available agent and transfer
 */

const ONLINE_WINDOW_MINUTES = 5;

// ---------- Session helpers ----------

/**
 * Get the active conversation session for a customer, or create a new 'bot'
 * session if none exists.
 *
 * @param {object} supabase  - Supabase client (service-role)
 * @param {string} tenantSlug
 * @param {string} phone
 * @param {string|null} activityId
 * @returns {Promise<object|null>} session row, or null on error
 */
async function getOrCreateSession(supabase, tenantSlug, phone, activityId) {
  try {
    // Try to find an existing active session
    const { data: existing } = await supabase
      .from('mken_conversation_sessions')
      .select('*')
      .eq('tenant_slug', tenantSlug)
      .eq('phone', phone)
      .in('status', ['bot', 'handoff', 'human'])
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Update activity_id if we now know it and the session didn't have one
      if (activityId && !existing.activity_id) {
        await supabase
          .from('mken_conversation_sessions')
          .update({ activity_id: activityId, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        existing.activity_id = activityId;
      }
      return existing;
    }

    // Create a new bot session
    const newSession = {
      id: 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      tenant_slug: tenantSlug,
      phone: phone,
      activity_id: activityId || null,
      status: 'bot',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: created, error } = await supabase
      .from('mken_conversation_sessions')
      .insert(newSession)
      .select()
      .single();

    if (error) {
      // Might be a race condition (unique index). Try to fetch again.
      const { data: retry } = await supabase
        .from('mken_conversation_sessions')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .eq('phone', phone)
        .in('status', ['bot', 'handoff', 'human'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return retry || null;
    }

    return created || null;
  } catch (e) {
    console.error('handoff getOrCreateSession error:', e.message);
    return null;
  }
}

// ---------- Handoff detection ----------

// Keywords/phrases that explicitly request a human agent.
const HANDOFF_KEYWORDS = [
  'موظف', 'بشري', 'انسان', 'إنسان', 'شخص', 'مختص', 'مسؤول', 'متخصص',
  'محادثة بشرية', 'كلام بشري', 'موظف حقيقي', 'أريد موظف', 'ابغى موظف',
  'حولني', 'حولني لموظف', 'تحويل', 'مدير', 'مسؤول', 'مشرف',
  'agent', 'human', 'representative', 'manager', 'support person',
  'لا اريد البوت', 'لا أريد البوت', 'كفاي بوت', 'بطل بوت',
  'تكلم معي موظف', 'كلمموظف'
];

/**
 * Check whether the customer's message explicitly requests a human agent.
 * @param {string} message
 * @returns {boolean}
 */
function isHandoffRequested(message) {
  if (!message) return false;
  var msg = String(message).toLowerCase().trim();
  return HANDOFF_KEYWORDS.some(function (kw) {
    return msg.indexOf(kw) !== -1;
  });
}

// ---------- Handoff execution ----------

/**
 * Attempt to find an available staff member for the session's activity and
 * transfer the conversation to them.
 *
 * @param {object} supabase
 * @param {object} session  - the conversation session row
 * @returns {Promise<{success:boolean, staff?:object, reason?:string}>}
 */
async function attemptHandoff(supabase, session) {
  if (!session || !session.activity_id) {
    return { success: false, reason: 'no_activity' };
  }

  try {
    // 1. Get staff_ids linked to this activity
    const { data: links } = await supabase
      .from('mken_staff_activities')
      .select('staff_id')
      .eq('tenant_slug', session.tenant_slug)
      .eq('activity_id', session.activity_id);

    if (!links || links.length === 0) {
      return { success: false, reason: 'no_staff_linked' };
    }

    var staffIds = links.map(function (l) { return l.staff_id; });

    // 2. Fetch active + online staff
    const { data: staffRows } = await supabase
      .from('mken_staff')
      .select('id, name, phone, role, availability, last_seen_at, current_chat_load')
      .in('id', staffIds)
      .eq('tenant_slug', session.tenant_slug)
      .eq('status', 'active');

    if (!staffRows || staffRows.length === 0) {
      return { success: false, reason: 'no_active_staff' };
    }

    // 3. Filter to those currently online (heartbeat within window)
    var now = Date.now();
    var windowMs = ONLINE_WINDOW_MINUTES * 60 * 1000;
    var online = staffRows.filter(function (s) {
      if (s.availability !== 'online') return false;
      if (!s.last_seen_at) return false;
      return (now - new Date(s.last_seen_at).getTime()) <= windowMs;
    }).sort(function (a, b) {
      return (a.current_chat_load || 0) - (b.current_chat_load || 0);
    });

    if (online.length === 0) {
      return { success: false, reason: 'no_online_staff' };
    }

    var agent = online[0];

    // 4. Update session: assign staff, set status to 'human'
    await supabase
      .from('mken_conversation_sessions')
      .update({
        status: 'human',
        assigned_staff_id: agent.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);

    // 5. Increment the agent's chat load
    await supabase
      .from('mken_staff')
      .update({ current_chat_load: (agent.current_chat_load || 0) + 1 })
      .eq('id', agent.id);

    return { success: true, staff: agent };

  } catch (e) {
    console.error('handoff attemptHandoff error:', e.message);
    return { success: false, reason: 'error: ' + e.message };
  }
}

/**
 * Close a conversation session (when the customer says goodbye, or after
 * inactivity). Resets the session so the next message starts fresh with bot.
 *
 * @param {object} supabase
 * @param {string} sessionId
 */
async function closeSession(supabase, sessionId) {
  try {
    // Get session to decrement staff load if assigned
    const { data: session } = await supabase
      .from('mken_conversation_sessions')
      .select('assigned_staff_id, status')
      .eq('id', sessionId)
      .maybeSingle();

    if (session && session.assigned_staff_id && session.status === 'human') {
      // Decrement the agent's chat load
      const { data: staff } = await supabase
        .from('mken_staff')
        .select('current_chat_load')
        .eq('id', session.assigned_staff_id)
        .maybeSingle();
      if (staff) {
        await supabase
          .from('mken_staff')
          .update({ current_chat_load: Math.max(0, (staff.current_chat_load || 1) - 1) })
          .eq('id', session.assigned_staff_id);
      }
    }

    await supabase
      .from('mken_conversation_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId);
  } catch (e) {
    console.error('handoff closeSession error:', e.message);
  }
}

// ---------- Customer-facing messages ----------

function buildHandoffSuccessMessage(staffName, brandName) {
  return 'تمام! حوّلتك للأستاذ ' + staffName + ' من فريقنا 👨‍💼\n'
    + 'هو متخصص وبيقدر يساعدك بشكل مباشر. لحظة وبيتواصل معك 🙏';
}

function buildHandoffFailMessage(reason) {
  if (reason === 'no_staff_linked' || reason === 'no_active_staff') {
    return 'عذراً، لا يوجد موظف متاح لهذا النشاط حالياً 🙏\n'
      + 'لكن أنا سعد مساعدك الذكي ومستعد أساعدك قدر الإمكان 😊\n'
      + 'أو تواصل معنا لاحقاً وسنرد عليك بأقرب وقت.';
  }
  if (reason === 'no_online_staff') {
    return 'كل موظفينا متخصصين مشغولين حالياً 🙏\n'
      + 'أبشر، أنا سعد هنا ومستعد أساعدك في أي استفسار 😊\n'
      + 'أو أرسل رسالتك وسيرد عليك أحد الزملاء فور توفره.';
  }
  return 'عذراً، تعذّر تحويلك لموظف حالياً 🙏\n'
    + 'أنا سعد مساعدك الذكي، كيف أقدر أساعدك؟ 😊';
}

module.exports = {
  getOrCreateSession: getOrCreateSession,
  isHandoffRequested: isHandoffRequested,
  attemptHandoff: attemptHandoff,
  closeSession: closeSession,
  buildHandoffSuccessMessage: buildHandoffSuccessMessage,
  buildHandoffFailMessage: buildHandoffFailMessage,
  HANDOFF_KEYWORDS: HANDOFF_KEYWORDS
};
