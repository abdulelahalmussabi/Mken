'use strict';

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./supabase-env');

function getServiceRoleDb() {
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function parseTime(time) {
  const parts = (time || '').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

async function listOpenSlots({ tenantSlug, date, serviceId, slotDurationMinutes = 30, hoursStart = '09:00', hoursEnd = '21:00' }) {
  const db = getServiceRoleDb();
  if (!db) return [];

  // Read config from tenant if available
  const { data: tenant } = await db
    .from('mken_saas_clients')
    .select('config_data')
    .eq('tenant_slug', tenantSlug)
    .maybeSingle();

  let finalStart = hoursStart;
  let finalEnd = hoursEnd;
  let finalDuration = slotDurationMinutes;

  if (tenant && tenant.config_data && tenant.config_data.booking) {
    const booking = tenant.config_data.booking;
    if (booking.workingHours && booking.workingHours.start) finalStart = booking.workingHours.start;
    if (booking.workingHours && booking.workingHours.end) finalEnd = booking.workingHours.end;
    if (typeof booking.slotDurationMinutes === 'number') {
      finalDuration = booking.slotDurationMinutes;
    }
  }

  // Fetch all pending/confirmed appointments for this date
  const { data, error } = await db
    .from('mken_appointments')
    .select('time')
    .eq('tenant_slug', tenantSlug)
    .eq('date', date)
    .in('status', ['pending', 'confirmed']);

  if (error) return [];

  const bookedTimes = new Set((data || []).map(row => row.time ? row.time.slice(0, 5) : ''));

  const startMin = parseTime(finalStart);
  const endMin = parseTime(finalEnd);
  
  const slots = [];
  for (let m = startMin; m + finalDuration <= endMin; m += finalDuration) {
    const timeStr = formatTime(m);
    if (!bookedTimes.has(timeStr)) {
      slots.push(timeStr);
    }
  }

  return slots;
}

async function isSlotFree({ tenantSlug, date, time, excludeId }) {
  const db = getServiceRoleDb();
  if (!db) return false;

  const normalizedTime = time.slice(0, 5);

  let query = db
    .from('mken_appointments')
    .select('id')
    .eq('tenant_slug', tenantSlug)
    .eq('date', date)
    .like('time', `${normalizedTime}%`)
    .in('status', ['pending', 'confirmed']);
    
  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;
  if (error) return false;

  return data.length === 0;
}

module.exports = {
  listOpenSlots,
  isSlotFree
};
