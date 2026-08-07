'use strict';

/**
 * Staff Availability API
 *
 * Returns staff members available for a specific activity in a tenant.
 * Used by the conversation handoff engine to find a human agent to transfer
 * the customer to.
 *
 * GET /api/staff-availability?tenant=<slug>&activity=<activity_id>
 *
 * A staff member is "available" when:
 *  - status = 'active'
 *  - availability = 'online'
 *  - last_seen_at within the last 5 minutes (live heartbeat)
 *  - linked to the requested activity via mken_staff_activities
 *
 * Results are sorted by current_chat_load ascending (least busy first).
 */

const sbEnv = require('./_lib/supabase-env');

// Staff is considered online if they heartbeated within this window.
const ONLINE_WINDOW_MINUTES = 5;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tenantSlug = (req.query.tenant || req.query.slug || '').trim();
  const activityId = (req.query.activity || '').trim();

  if (!tenantSlug) {
    return res.status(400).json({ error: 'tenant (slug) is required' });
  }
  if (!activityId) {
    return res.status(400).json({ error: 'activity is required' });
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase credentials missing' });
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // 1. Get staff_ids linked to this activity for this tenant
    const { data: links, error: linkErr } = await supabase
      .from('mken_staff_activities')
      .select('staff_id')
      .eq('tenant_slug', tenantSlug)
      .eq('activity_id', activityId);

    if (linkErr) throw linkErr;
    if (!links || links.length === 0) {
      return res.status(200).json({
        tenant: tenantSlug,
        activity: activityId,
        available: [],
        total: 0,
        message: 'No staff linked to this activity'
      });
    }

    const staffIds = links.map(l => l.staff_id);

    // 2. Fetch those staff records
    const { data: staffRows, error: staffErr } = await supabase
      .from('mken_staff')
      .select('id, name, phone, role, status, availability, last_seen_at, current_chat_load')
      .in('id', staffIds)
      .eq('tenant_slug', tenantSlug)
      .eq('status', 'active');

    if (staffErr) throw staffErr;
    if (!staffRows || staffRows.length === 0) {
      return res.status(200).json({
        tenant: tenantSlug,
        activity: activityId,
        available: [],
        total: 0,
        message: 'No active staff linked to this activity'
      });
    }

    // 3. Filter to those currently online (heartbeat within window)
    const now = Date.now();
    const windowMs = ONLINE_WINDOW_MINUTES * 60 * 1000;
    const online = staffRows
      .filter(s => {
        if (s.availability !== 'online') return false;
        if (!s.last_seen_at) return false;
        const lastSeen = new Date(s.last_seen_at).getTime();
        return (now - lastSeen) <= windowMs;
      })
      .map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        role: s.role,
        currentLoad: s.current_chat_load || 0
      }))
      .sort((a, b) => a.currentLoad - b.currentLoad); // least busy first

    return res.status(200).json({
      tenant: tenantSlug,
      activity: activityId,
      available: online,
      total: online.length,
      onlineWindowMinutes: ONLINE_WINDOW_MINUTES
    });
  } catch (err) {
    console.error('staff-availability error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch staff availability', details: err.message });
  }
};
