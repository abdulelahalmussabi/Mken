'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./supabase-env');
const slots = require('./slots');

function getServiceRoleDb() {
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Expected Flow:
 * Client: I want to book tomorrow at 4 -> list_slots -> create_booking -> payment_link
 */

async function list_slots({ date, tenantSlug }) {
  const availableSlots = await slots.listOpenSlots({ tenantSlug, date });
  if (!availableSlots || availableSlots.length === 0) {
    return 'لا توجد أوقات متاحة في هذا اليوم.';
  }
  return availableSlots;
}

async function create_booking({ tenantSlug, name, phone, date, time, serviceId, serviceName, servicePrice }) {
  const db = getServiceRoleDb();
  if (!db) throw new Error('Database connection failed');

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date || '');
  const timeOk = /^\d{2}:\d{2}$/.test((time || '').slice(0, 5));
  if (!dateOk || !timeOk) {
    throw new Error('التاريخ أو الوقت غير صالح.');
  }
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  if (phoneDigits.length < 8) {
    throw new Error('رقم الجوال غير صالح.');
  }

  const normalizedTime = String(time).slice(0, 5);
  const isFree = await slots.isSlotFree({ tenantSlug, date, time: normalizedTime });
  if (!isFree) {
    throw new Error('هذا الوقت محجوز مسبقاً، يرجى اختيار وقت آخر.');
  }

  const aptId = 'apt_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
  const amount = servicePrice ? parseFloat(String(servicePrice).replace(/[^\d.]/g, '')) : null;
  const noteParts = [
    'عبر واتساب',
    serviceName ? ('الخدمة: ' + serviceName) : '',
  ].filter(Boolean);

  const insertData = {
    id: aptId,
    tenant_slug: tenantSlug,
    activity_id: 'storefront',
    customer_name: (name || 'عميل واتساب').slice(0, 80),
    phone: phoneDigits,
    date: date,
    time: normalizedTime,
    service_id: (serviceId || 'general').slice(0, 80),
    status: 'pending',
    payment_status: 'unpaid',
    payment_amount: amount && amount > 0 ? amount : null,
    notes: noteParts.join(' | '),
    stay_booking: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await db.from('mken_appointments').insert(insertData);
  if (error) {
    console.error('Error creating booking via whatsapp tool:', error);
    throw new Error('حدث خطأ أثناء إنشاء الحجز.');
  }

  return { appointmentId: aptId, status: 'pending', payment_status: 'unpaid', payment_amount: insertData.payment_amount };
}

function payment_link({ appointmentId, tenantSlug, siteDomain }) {
  return `https://${siteDomain}/book?apt_id=${appointmentId}`;
}

module.exports = {
  list_slots,
  create_booking,
  payment_link
};
