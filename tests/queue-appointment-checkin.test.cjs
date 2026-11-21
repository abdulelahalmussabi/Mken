/**
 * منصة مَكَن (mken.live) — فحص ترقية المرحلة الثانية لنظام الطابور
 * (Appointment Self Check-in, Kiosk Security, Zero-PII PDPL & Priority Hierarchy)
 *
 * التحقق من:
 * 1. مزامنة مواعيد الأنظمة الخارجية (HIS/EMR Sync) وتشفير الهوية HMAC-SHA256 (Zero-PII).
 * 2. نافذة تسجيل الوصول الذاتي (Too Early, On-Time, Too Late Fallback).
 * 3. منع التذاكر المكررة لمراجعي الويب وعزل الشبكة الموحدة (NAT IP Deduplication).
 * 4. إدارة ومصادقة أجهزة الكشك الذاتي واستثناء قيود المعدل مع نبضات القلب (Heartbeat).
 * 5. مصفوفة الأولوية الرباعية وخوارزمية منع التجويع (Starvation Prevention Interleaving).
 * 6. امتثال نظام حماية البيانات الشخصية السعودي (PDPL Anonymization Cron).
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const queueHandler = require('../mkn-theme/src/server/platform/queue.js');
const { executePdplAnonymization } = require('../mkn-theme/src/server/platform/cron-queue-pdpl.js');
const { tenantHeaders } = require('./queue-http.cjs');

const TEST_TENANT = 'hospital-enterprise';

function createMockReq(options = {}) {
  const query = Object.assign({}, options.query || {});
  if (options.tenant && !query.tenant) {
    query.tenant = options.tenant;
  }
  const opts = Object.assign({}, options, { query: query });
  const headers = tenantHeaders(opts);
  if (!headers.host && options.tenant) {
    headers.host = options.tenant.toLowerCase() + '.mken.live';
  }
  if (!headers.origin) {
    headers.origin = 'https://' + headers.host;
  }
  if (options.staff) {
    headers['x-is-super-admin'] = '1';
    headers['x-admin-authenticated'] = '1';
    headers['x-queue-staff-token'] = 'staff-secret';
  }
  return {
    method: opts.method || 'GET',
    url: opts.url || '/api/v1/queue',
    query: query,
    body: opts.body || {},
    headers: Object.assign(headers, options.headers || {}),
    on(event, handler) {}
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

async function runQueueAction(action, { method = 'POST', body = {}, query = {}, staff = 'admin', headers = {} } = {}) {
  const reqBody = Object.assign({ action: action }, body);
  const req = createMockReq({
    tenant: TEST_TENANT,
    method: method,
    query: Object.assign({ action: action }, query),
    body: reqBody,
    staff: staff,
    headers: headers
  });
  const res = createMockRes();
  await queueHandler(req, res);
  return { status: res.statusCode, body: res.body };
}

async function setupTestData() {
  // 1. Initialize tenant configuration with a zone and queues
  await runQueueAction('upsert-zone', {
    body: {
      code: 'REC-ENT',
      name: 'استقبال العيادات التخصصية',
      floor_or_building: 'الدور الأرضي - المبنى B'
    }
  });

  const zonesRes = await runQueueAction('list-zones', { method: 'GET' });
  const entZone = (zonesRes.body.zones || []).find(z => z.code === 'REC-ENT');
  assert(entZone, 'Zone REC-ENT should exist');

  // 2. Add services/queues linked to zone
  await runQueueAction('create-queue', {
    body: {
      id: 'clinic-cardio',
      name: 'عيادة القلب والأوعية',
      prefix: 'CRD',
      zone_id: entZone.id,
      is_active: true
    }
  });

  await runQueueAction('create-queue', {
    body: {
      id: 'clinic-internal',
      name: 'عيادة الباطنية العامة',
      prefix: 'INT',
      zone_id: entZone.id,
      is_active: true
    }
  });

  // 3. Add counter
  await runQueueAction('add-counter', {
    body: {
      id: 'cnt-cardio-1',
      name: 'كاونتر 1 - د. فيصل',
      assignedQueueIds: ['clinic-cardio', 'clinic-internal'],
      service_ids: ['clinic-cardio', 'clinic-internal'],
      zone_id: entZone.id,
      is_active: true
    }
  });

  return { zone: entZone };
}

async function runTests() {
  console.log('🚀 Starting Phase 2 QMS Enterprise Test Suite...');
  const { zone } = await setupTestData();

  // =========================================================================
  // TEST 1: HIS/EMR Webhook Sync with HMAC-SHA256 & Zero-PII Verification
  // =========================================================================
  console.log('\n--- TEST 1: HIS Webhook Sync & Zero-PII Validation ---');
  const rawId1 = '1087654321';
  const rawId2 = '2098765432';
  const now = new Date();

  // Appointment A: On-time (in 15 minutes)
  const apptTimeA = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  // Appointment B: Too early (in 180 minutes)
  const apptTimeB = new Date(now.getTime() + 180 * 60 * 1000).toISOString();
  // Appointment C: Too late (45 minutes ago)
  const apptTimeC = new Date(now.getTime() - 45 * 60 * 1000).toISOString();

  const syncRes = await runQueueAction('his-appointment-sync', {
    body: {
      appointments: [
        {
          appointment_id: 'HIS-APT-1001',
          national_id: rawId1,
          patient_name: 'أحمد المحمدي',
          scheduled_time: apptTimeA,
          queue_id: 'clinic-cardio',
          zone_id: zone.id
        },
        {
          appointment_id: 'HIS-APT-1002',
          national_id: rawId2,
          patient_name: 'سارة السعيد',
          scheduled_time: apptTimeB,
          queue_id: 'clinic-cardio',
          zone_id: zone.id
        },
        {
          appointment_id: 'HIS-APT-1003',
          national_id: '1012345678',
          patient_name: 'خالد المطيري',
          scheduled_time: apptTimeC,
          queue_id: 'clinic-cardio',
          zone_id: zone.id
        }
      ]
    }
  });

  assert.strictEqual(syncRes.status, 200, 'HIS sync should return 200');
  assert.strictEqual(syncRes.body.ok, true, 'HIS sync ok should be true');
  assert.strictEqual(syncRes.body.count, 3, 'Should have synced 3 appointments');

  // Verify Zero-PII: Check in-memory store that raw national IDs are NEVER stored
  const memoryAppts = queueHandler._memory.appointments[TEST_TENANT] || [];
  const storedApptA = Array.isArray(memoryAppts)
    ? memoryAppts.find(a => a.id === 'HIS-APT-1001' || a.code === 'HIS-APT-1001')
    : memoryAppts['HIS-APT-1001'];
  assert(storedApptA, 'Stored appointment A must exist');
  assert.strictEqual(storedApptA.national_id, undefined, 'Plain national_id MUST NOT be stored');
  assert.strictEqual(storedApptA.identity_last4, '4321', 'identity_last4 must be the last 4 digits');
  assert(storedApptA.national_id_hash, 'national_id_hash must be present');
  assert.strictEqual(storedApptA.national_id_hash.length, 64, 'HMAC-SHA256 hash must be 64 hex characters');
  console.log('✅ Test 1 Passed: Zero-PII HMAC-SHA256 verified; plaintext national ID never stored.');

  // =========================================================================
  // TEST 2: Appointment Check-in Window Logic (Early, On-time, Late, Dedup)
  // =========================================================================
  console.log('\n--- TEST 2: Check-in Window Validation ---');

  // 2a. Too Early: Attempt check-in for appointment B (3 hours ahead)
  const earlyCheckin = await runQueueAction('appointment-checkin', {
    staff: false,
    body: {
      nationalId: rawId2
    }
  });
  assert.strictEqual(earlyCheckin.status, 400, 'Early checkin must be rejected');
  assert(['TOO_EARLY', 'CHECKIN_TOO_EARLY'].includes(earlyCheckin.body.code), 'Code must indicate early checkin');
  console.log('✅ 2a. Early check-in correctly rejected with', earlyCheckin.body.code);

  // 2b. On-time: Check-in for appointment A (15 mins ahead)
  const onTimeCheckin = await runQueueAction('appointment-checkin', {
    staff: false,
    body: {
      nationalId: rawId1
    }
  });
  assert.strictEqual(onTimeCheckin.status, 200, 'On-time checkin must succeed');
  assert.strictEqual(onTimeCheckin.body.ok, true);
  const ticketA = onTimeCheckin.body.ticket;
  assert(ticketA, 'Ticket must be returned');
  assert.strictEqual(ticketA.priority_level, 'scheduled_appointment', 'Priority must be scheduled_appointment');
  assert.strictEqual(ticketA.appointment_id, 'HIS-APT-1001');
  assert.strictEqual(ticketA.identity_last4, '4321');
  assert.strictEqual(ticketA.national_id, undefined, 'Plain national_id must not leak in response');
  console.log('✅ 2b. On-time check-in successfully issued priority ticket:', ticketA.ticket_number);

  // 2c. Check-in Deduplication: Immediate second check-in returns existing ticket
  const dedupCheckin = await runQueueAction('appointment-checkin', {
    staff: false,
    body: {
      nationalId: rawId1
    }
  });
  assert.strictEqual(dedupCheckin.status, 200);
  assert.strictEqual(dedupCheckin.body.isExisting, true, 'isExisting must be true');
  assert.strictEqual(dedupCheckin.body.ticket.id, ticketA.id, 'Must return the same ticket');
  console.log('✅ 2c. Duplicate check-in returned existing active ticket.');

  // 2d. Too Late: Check-in for appointment C (45 mins past scheduled time)
  const lateCheckin = await runQueueAction('appointment-checkin', {
    staff: false,
    body: {
      nationalId: '1012345678'
    }
  });
  assert.strictEqual(lateCheckin.status, 200, 'Late check-in accepted with fallback');
  assert.strictEqual(lateCheckin.body.warning, true, 'Warning flag must be true');
  assert.strictEqual(lateCheckin.body.ticket.priority_level, 'standard', 'Late appointment must fallback to standard FIFO');
  console.log('✅ 2d. Late check-in gracefully converted to standard priority with warning notice.');

  // =========================================================================
  // TEST 3: Kiosk Management & Heartbeat Authentication
  // =========================================================================
  console.log('\n--- TEST 3: Kiosk Management & Security ---');

  // 3a. Admin creates a kiosk
  const createKioskRes = await runQueueAction('upsert-kiosk', {
    body: {
      kiosk_code: 'KIOSK-REC01-A',
      name: 'كشك الاستقبال الرئيسي A',
      zone_id: zone.id
    }
  });
  assert.strictEqual(createKioskRes.status, 200);
  assert(createKioskRes.body.token, 'Plain token must be returned on kiosk creation');
  const plainKioskToken = createKioskRes.body.token;
  const kioskId = createKioskRes.body.kiosk.id;

  // Verify token hash is stored, not the plain token
  const storedKiosks = queueHandler._memory.kiosks[TEST_TENANT] || [];
  const storedK = storedKiosks.find(k => k.id === kioskId);
  assert(storedK, 'Kiosk record must exist in memory');
  assert.strictEqual(storedK.token, undefined, 'Plain token must not be in storage');
  assert(storedK.token_hash, 'token_hash must be stored');

  // 3b. Rotate kiosk token
  const rotateRes = await runQueueAction('rotate-kiosk-token', {
    body: { kioskId: kioskId }
  });
  assert.strictEqual(rotateRes.status, 200);
  assert(rotateRes.body.token, 'New plain token returned on rotation');
  const activeKioskToken = rotateRes.body.token;
  assert.notStrictEqual(activeKioskToken, plainKioskToken, 'Rotated token must be different');

  // 3c. List kiosks (confirms token_hash is masked)
  const listKiosksRes = await runQueueAction('list-kiosks', { method: 'GET' });
  assert.strictEqual(listKiosksRes.status, 200);
  const foundKiosk = listKiosksRes.body.kiosks.find(k => k.id === kioskId);
  assert(foundKiosk, 'Kiosk must be listed');
  assert.strictEqual(foundKiosk.token_hash, undefined, 'token_hash must not be exposed to staff list');
  console.log('✅ Test 3 Passed: Kiosk created, token rotated, and secrets masked.');

  // =========================================================================
  // TEST 4: NAT IP Deduplication (Web) vs Kiosk Bypass
  // =========================================================================
  console.log('\n--- TEST 4: NAT IP Web Deduplication vs Kiosk Multi-Ticket ---');

  // 4a. Web user with deviceId 'mobile-dev-001' joining queue twice
  const webJoin1 = await runQueueAction('join-queue', {
    staff: false,
    headers: {
      'x-device-id': 'mobile-dev-001',
      'x-forwarded-for': '203.0.113.50'
    },
    body: {
      queueId: 'clinic-internal',
      customer_name: 'سعيد القحطاني'
    }
  });
  assert.strictEqual(webJoin1.status, 200);
  assert.strictEqual(webJoin1.body.isExisting, undefined);

  // Second join with same deviceId for same queue
  const webJoin2 = await runQueueAction('join-queue', {
    staff: false,
    headers: {
      'x-device-id': 'mobile-dev-001',
      'x-forwarded-for': '203.0.113.50'
    },
    body: {
      queueId: 'clinic-internal',
      customer_name: 'سعيد القحطاني 2'
    }
  });
  assert.strictEqual(webJoin2.status, 200);
  assert.strictEqual(webJoin2.body.isExisting, true, 'Web client with same device_id must be deduplicated');
  const tWeb1 = webJoin1.body.ticket || webJoin1.body.tickets?.[0];
  const tWeb2 = webJoin2.body.ticket || webJoin2.body.tickets?.[0];
  assert(tWeb1 && tWeb2, 'Tickets must exist');
  assert.strictEqual(tWeb2.id, tWeb1.id, 'Must return same active ticket');
  console.log('✅ 4a. Web user deduplication verified for mobile device.');

  // 4b. Kiosk issuing multiple tickets sequentially from same IP
  const kioskJoin1 = await runQueueAction('join-queue', {
    staff: false,
    headers: {
      'x-kiosk-token': activeKioskToken,
      'x-forwarded-for': '203.0.113.50'
    },
    body: {
      queueId: 'clinic-internal',
      customer_name: 'مريض الكشك الأول'
    }
  });
  assert.strictEqual(kioskJoin1.status, 200);
  assert.strictEqual(kioskJoin1.body.isExisting, undefined);

  const kioskJoin2 = await runQueueAction('join-queue', {
    staff: false,
    headers: {
      'x-kiosk-token': activeKioskToken,
      'x-forwarded-for': '203.0.113.50'
    },
    body: {
      queueId: 'clinic-internal',
      customer_name: 'مريض الكشك الثاني'
    }
  });
  assert.strictEqual(kioskJoin2.status, 200);
  assert.strictEqual(kioskJoin2.body.isExisting, undefined, 'Kiosk must NOT be deduplicated; separate tickets issued');
  const tKiosk1 = kioskJoin1.body.ticket || kioskJoin1.body.tickets?.[0];
  const tKiosk2 = kioskJoin2.body.ticket || kioskJoin2.body.tickets?.[0];
  assert(tKiosk1 && tKiosk2, 'Kiosk tickets must exist');
  assert.notStrictEqual(tKiosk1.id, tKiosk2.id);

  // Verify Kiosk Heartbeat was updated
  const reloadedKiosk = (queueHandler._memory.kiosks[TEST_TENANT] || []).find(k => k.id === kioskId);
  assert(reloadedKiosk.last_heartbeat_at, 'Kiosk heartbeat must be updated on API activity');
  console.log('✅ 4b. Kiosk successfully bypassed web deduplication & updated heartbeat.');

  // =========================================================================
  // TEST 5: 4-Tier Priority Ordering & Starvation Prevention Interleaving
  // =========================================================================
  console.log('\n--- TEST 5: 4-Tier Priority & Starvation Interleaving (3:1 Ratio) ---');

  // Let's create an isolated queue for priority testing
  await runQueueAction('create-queue', {
    body: {
      id: 'clinic-priority-test',
      name: 'عيادة فحص الأولويات',
      prefix: 'PRIO',
      zone_id: zone.id,
      is_active: true
    }
  });

  const baseTime = Date.now() - 60000;
  const ticketsList = queueHandler._memory.tickets[TEST_TENANT] = [];

  // 1. Walk-in A (FIFO standard, issued at baseTime)
  ticketsList.push({
    id: 't-walkin-1',
    ticket_number: 'PRIO-001',
    tenant_slug: TEST_TENANT,
    queue_id: 'clinic-priority-test',
    status: 'waiting',
    priority_level: 'standard',
    issued_at: new Date(baseTime).toISOString(),
    created_at: new Date(baseTime).toISOString()
  });

  // 2. Appointment 1 (issued at baseTime + 10s)
  ticketsList.push({
    id: 't-appt-1',
    ticket_number: 'PRIO-002',
    tenant_slug: TEST_TENANT,
    queue_id: 'clinic-priority-test',
    status: 'waiting',
    priority_level: 'scheduled_appointment',
    scheduled_time: new Date(baseTime + 30000).toISOString(),
    issued_at: new Date(baseTime + 10000).toISOString(),
    created_at: new Date(baseTime + 10000).toISOString()
  });

  // 3. Appointment 2
  ticketsList.push({
    id: 't-appt-2',
    ticket_number: 'PRIO-003',
    tenant_slug: TEST_TENANT,
    queue_id: 'clinic-priority-test',
    status: 'waiting',
    priority_level: 'scheduled_appointment',
    scheduled_time: new Date(baseTime + 40000).toISOString(),
    issued_at: new Date(baseTime + 11000).toISOString(),
    created_at: new Date(baseTime + 11000).toISOString()
  });

  // 4. Appointment 3
  ticketsList.push({
    id: 't-appt-3',
    ticket_number: 'PRIO-004',
    tenant_slug: TEST_TENANT,
    queue_id: 'clinic-priority-test',
    status: 'waiting',
    priority_level: 'scheduled_appointment',
    scheduled_time: new Date(baseTime + 50000).toISOString(),
    issued_at: new Date(baseTime + 12000).toISOString(),
    created_at: new Date(baseTime + 12000).toISOString()
  });

  // 5. Appointment 4
  ticketsList.push({
    id: 't-appt-4',
    ticket_number: 'PRIO-005',
    tenant_slug: TEST_TENANT,
    queue_id: 'clinic-priority-test',
    status: 'waiting',
    priority_level: 'scheduled_appointment',
    scheduled_time: new Date(baseTime + 60000).toISOString(),
    issued_at: new Date(baseTime + 13000).toISOString(),
    created_at: new Date(baseTime + 13000).toISOString()
  });

  // 6. Immediate Next (VIP / emergency escalation, issued last)
  ticketsList.push({
    id: 't-vip-1',
    ticket_number: 'PRIO-VIP',
    tenant_slug: TEST_TENANT,
    queue_id: 'clinic-priority-test',
    status: 'waiting',
    priority_level: 'immediate_next',
    issued_at: new Date(baseTime + 20000).toISOString(),
    created_at: new Date(baseTime + 20000).toISOString()
  });

  // Set policy: appointment_interleave_ratio: 3
  queueHandler._memory.hallPolicies[TEST_TENANT] = {
    appointment_interleave_ratio: 3
  };

  // Create dedicated counter
  const prioCounterRes = await runQueueAction('add-counter', {
    body: {
      id: 'cnt-prio-test',
      name: 'كاونتر فحص الأولويات',
      assignedQueueIds: ['clinic-priority-test'],
      service_ids: ['clinic-priority-test'],
      zone_id: zone.id,
      is_active: true
    }
  });
  const prioCounterId = prioCounterRes.body.counter?.id || 'cnt-prio-test';

  // Call tickets sequentially and observe dispatch order
  const callSequence = [];
  for (let i = 0; i < 6; i++) {
    const callRes = await runQueueAction('call-next', {
      body: { counterId: prioCounterId }
    });
    console.log(`Call ${i + 1} status: ${callRes.status}, ticket: ${callRes.body?.ticket?.id}`);
    assert.strictEqual(callRes.status, 200, `Call ${i + 1} should succeed`);
    callSequence.push(callRes.body.ticket.id);
    // Mark called ticket as completed to allow next call
    callRes.body.ticket.status = 'completed';
  }

  console.log('Call Sequence observed:', callSequence);

  // Expected sequence:
  // 1. Immediate Next ('t-vip-1') must be FIRST regardless of arrival time.
  assert.strictEqual(callSequence[0], 't-vip-1', 'Immediate next VIP must be called first');

  // 2, 3, 4. Three consecutive appointments ('t-appt-1', 't-appt-2', 't-appt-3')
  assert.strictEqual(callSequence[1], 't-appt-1');
  assert.strictEqual(callSequence[2], 't-appt-2');
  assert.strictEqual(callSequence[3], 't-appt-3');

  // 5. Starvation Prevention: After 3 appointments, Walk-in ('t-walkin-1') MUST be called next,
  // even though Appointment 4 ('t-appt-4') is waiting!
  assert.strictEqual(callSequence[4], 't-walkin-1', 'Starvation prevention must interleave walk-in after 3 appointments');

  // 6. Remaining Appointment ('t-appt-4') is called next
  assert.strictEqual(callSequence[5], 't-appt-4', 'Remaining appointment called after interleaved walk-in');

  console.log('✅ Test 5 Passed: 4-tier hierarchy and 3:1 starvation prevention strictly enforced.');

  // =========================================================================
  // TEST 6: PDPL Anonymization Cron
  // =========================================================================
  console.log('\n--- TEST 6: Saudi PDPL Retention Cron Anonymization ---');

  // Insert a completed ticket with PII fields
  const piiTicket = {
    id: 't-pdpl-pii-test',
    ticket_number: 'PDPL-99',
    tenant_slug: TEST_TENANT,
    status: 'completed',
    customer_name: 'محمد عبدالله الشمري',
    phone_number: '0501234567',
    identity_last4: '9988',
    device_id: 'dev-sensitive-mac-uuid',
    national_id_hash: crypto.createHash('sha256').update('1099887766').digest('hex'),
    issued_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
  };
  queueHandler._memory.tickets[TEST_TENANT].push(piiTicket);

  // Execute PDPL Cron with 30-day retention
  const pdplReport = await executePdplAnonymization(TEST_TENANT, 30);
  assert(pdplReport, 'PDPL report must be returned');
  assert(pdplReport.records_anonymized >= 1, 'At least 1 record must be anonymized');

  // Verify fields on piiTicket are purged
  assert.strictEqual(piiTicket.customer_name, '***', 'customer_name must be scrubbed');
  assert.strictEqual(piiTicket.phone_number, '***', 'phone_number must be scrubbed');
  assert.strictEqual(piiTicket.identity_last4, null, 'identity_last4 must be nulled');
  assert.strictEqual(piiTicket.device_id, null, 'device_id must be nulled');
  assert.strictEqual(piiTicket.national_id_hash, null, 'national_id_hash must be nulled');

  // Verify Audit Log was recorded
  const auditLogs = queueHandler._memory.auditLogs[TEST_TENANT] || [];
  const pdplAudit = auditLogs.find(a => a.action === 'pdpl_anonymization');
  assert(pdplAudit, 'Audit log entry for pdpl_anonymization must exist');
  console.log('✅ Test 6 Passed: PDPL Anonymization cron wiped sensitive identity attributes and recorded audit log.');

  console.log('\n🎉 ALL PHASE 2 TESTS PASSED SUCCESSFULLY! (6/6)');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
