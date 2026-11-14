'use strict';

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');
const fieldGeoEngine = require('../_lib/field-geo-engine');

// ذاكرة تخزين مؤقتة للمحاكاة والاختبارات السريعة
const inMemoryStore = {
  technicians: new Map(),
  tasks: new Map(),
  locationHistory: []
};

module.exports = async function handler(req, res) {
  if (handleCors && res.setHeader) {
    const handled = await handleCors(req, res);
    if (handled) return;
  }

  const url = new URL(req.url, 'http://localhost');
  const action =
    req.query.action ||
    url.searchParams.get('action') ||
    (req.body && req.body.action) ||
    'track-live';

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();
  const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  try {
    // =========================================================================
    // 1. استعلام التتبع المباشر للعميل برمز التوكن المشفر (Track Live - Customer View)
    // =========================================================================
    if (action === 'track-live') {
      const token = req.query.token || url.searchParams.get('token') || (req.body && req.body.token);
      if (!token) {
        return res.status(400).json({ success: false, error: 'رمز التتبع مفقود' });
      }

      // التحقق الصارم من التوقيع الرقمي وصلاحية التوكن (Anti-IDOR)
      const tokenCheck = fieldGeoEngine.verifyTrackingToken(token);
      if (!tokenCheck.valid) {
        return res.status(403).json({ success: false, error: tokenCheck.error });
      }

      const { taskId, tenantSlug } = tokenCheck;
      let task = null;
      let tech = null;

      if (supabase) {
        const { data: taskData } = await supabase
          .from('mken_field_tasks')
          .select('*')
          .eq('id', taskId)
          .maybeSingle();
        task = taskData;

        if (task && task.technician_id) {
          const { data: techData } = await supabase
            .from('mken_field_technicians')
            .select('id, name, status, current_lat, current_lng, last_heartbeat')
            .eq('id', task.technician_id)
            .maybeSingle();
          tech = techData;
        }
      } else {
        task = inMemoryStore.tasks.get(taskId) || null;
        if (task && task.technician_id) {
          tech = inMemoryStore.technicians.get(task.technician_id) || null;
        }
      }

      if (!task) {
        return res.status(404).json({ success: false, error: 'لم يتم العثور على المهمة الميدانية' });
      }

      // إذا كانت المهمة قد اكتملت، يتم إنهاء التتبع الحي وإظهار بطاقة الإنجاز
      if (task.status === 'completed') {
        return res.status(200).json({
          success: true,
          status: 'completed',
          message: 'تم إنجاز الخدمة بنجاح. نشكرك لاختيارك منصتنا!',
          completedAt: task.completed_at,
          isLive: false
        });
      }

      // إخفاء بيانات الفني الحساسة (PII Masking وفق نظام PDPL)
      // عرض الاسم الأول فقط وحجب رقم الهاتف الخاص
      const techFirstName = tech ? String(tech.name || '').split(' ')[0] : 'الفني المختص';

      let distanceMeters = null;
      let etaMinutes = null;

      if (tech && tech.current_lat && tech.current_lng && task.customer_lat && task.customer_lng) {
        distanceMeters = fieldGeoEngine.calculateHaversineDistance(
          tech.current_lat,
          tech.current_lng,
          task.customer_lat,
          task.customer_lng
        );
        etaMinutes = fieldGeoEngine.calculateEtaMinutes(distanceMeters);
      }

      return res.status(200).json({
        success: true,
        status: task.status,
        technicianName: techFirstName,
        technicianLat: tech ? Number(tech.current_lat) : null,
        technicianLng: tech ? Number(tech.current_lng) : null,
        customerAddress: task.customer_address || 'موقع العميل المحدد',
        customerLat: Number(task.customer_lat),
        customerLng: Number(task.customer_lng),
        distanceMeters: distanceMeters,
        etaMinutes: etaMinutes,
        isLive: task.status === 'en_route',
        tenantSlug: tenantSlug
      });
    }

    // =========================================================================
    // 2. تحديث الإحداثيات الجغرافية للفني مع التحقق الصارم من الخصوصية (Update Location)
    // =========================================================================
    if (action === 'update-location') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

      const { technicianId, lat, lng, speed = 0, heading = 0, taskId, tenantSlug = 'default' } = req.body || {};
      if (!technicianId || lat == null || lng == null) {
        return res.status(400).json({ success: false, error: 'معرف الفني والإحداثيات مطلوبة' });
      }

      let tech = null;
      if (supabase) {
        const { data } = await supabase
          .from('mken_field_technicians')
          .select('*')
          .eq('id', technicianId)
          .maybeSingle();
        tech = data;
      } else {
        tech = inMemoryStore.technicians.get(technicianId) || null;
      }

      // حظر الرصد خارج أوقات العمل الرسمية (PDPL Off-Duty Privacy Guard)
      if (tech && (tech.status === 'off_duty' || tech.status === 'break')) {
        return res.status(403).json({
          success: false,
          error: 'محظور نظاماً: يُمنع تعقب أو تسجيل الموقع الجغرافي للفني خارج أوقات العمل الرسمية وفق نظام حماية البيانات الشخصية'
        });
      }

      const nowIso = new Date().toISOString();

      if (supabase) {
        await supabase
          .from('mken_field_technicians')
          .update({
            current_lat: lat,
            current_lng: lng,
            last_heartbeat: nowIso,
            updated_at: nowIso
          })
          .eq('id', technicianId);

        if (taskId) {
          await supabase.from('mken_field_location_history').insert({
            tenant_slug: tenantSlug,
            task_id: taskId,
            technician_id: technicianId,
            lat: lat,
            lng: lng,
            speed: speed,
            heading: heading,
            recorded_at: nowIso
          });
        }
      } else {
        if (!tech) {
          tech = { id: technicianId, tenant_slug: tenantSlug, name: 'فني معتمد', status: 'on_job' };
        }
        tech.current_lat = lat;
        tech.current_lng = lng;
        tech.last_heartbeat = nowIso;
        inMemoryStore.technicians.set(technicianId, tech);

        if (taskId) {
          inMemoryStore.locationHistory.push({
            taskId,
            technicianId,
            lat,
            lng,
            recorded_at: nowIso
          });
        }
      }

      return res.status(200).json({ success: true, updated: true, timestamp: nowIso });
    }

    // =========================================================================
    // 3. انطلاق الفني في الطريق للمهمة (Start Journey - En Route)
    // =========================================================================
    if (action === 'start-journey') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

      const { taskId, technicianId, tenantSlug = 'default' } = req.body || {};
      if (!taskId || !technicianId) {
        return res.status(400).json({ success: false, error: 'معرف المهمة والفني مطلوبان' });
      }

      // توليد رمز إثبات الخدمة السري وتوكن التتبع المشفر
      const otp = fieldGeoEngine.generateCompletionOtp();
      const trackingToken = fieldGeoEngine.generateTrackingToken(taskId, tenantSlug, null, 120);
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 120 * 60 * 1000).toISOString();

      if (supabase) {
        await supabase
          .from('mken_field_tasks')
          .update({
            status: 'en_route',
            technician_id: technicianId,
            completion_otp: otp,
            tracking_token: trackingToken,
            tracking_expires_at: expiresAt,
            en_route_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', taskId);

        await supabase
          .from('mken_field_technicians')
          .update({
            status: 'on_job',
            current_task_id: taskId,
            updated_at: nowIso
          })
          .eq('id', technicianId);
      } else {
        let task = inMemoryStore.tasks.get(taskId) || { id: taskId, customer_lat: 24.7136, customer_lng: 46.6753 };
        task.status = 'en_route';
        task.technician_id = technicianId;
        task.completion_otp = otp;
        task.tracking_token = trackingToken;
        task.tracking_expires_at = expiresAt;
        task.en_route_at = nowIso;
        inMemoryStore.tasks.set(taskId, task);

        let tech = inMemoryStore.technicians.get(technicianId) || { id: technicianId, name: 'فني معتمد' };
        tech.status = 'on_job';
        tech.current_task_id = taskId;
        inMemoryStore.technicians.set(technicianId, tech);
      }

      const trackingUrl = `https://mken.live/track.html?token=${trackingToken}`;

      return res.status(200).json({
        success: true,
        status: 'en_route',
        taskId: taskId,
        trackingUrl: trackingUrl,
        trackingToken: trackingToken,
        completionOtp: otp, // يُرسل عبر الواتساب للعميل
        expiresAt: expiresAt
      });
    }

    // =========================================================================
    // 4. تسجيل الوصول مع التحقق الصارم من السياج الجغرافي (Register Arrival - Geofenced)
    // =========================================================================
    if (action === 'register-arrival') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

      const { taskId, technicianId, lat, lng } = req.body || {};
      if (!taskId || lat == null || lng == null) {
        return res.status(400).json({ success: false, error: 'معرف المهمة والإحداثيات الحالية مطلوبة' });
      }

      let task = null;
      if (supabase) {
        const { data } = await supabase
          .from('mken_field_tasks')
          .select('*')
          .eq('id', taskId)
          .maybeSingle();
        task = data;
      } else {
        task = inMemoryStore.tasks.get(taskId);
      }

      if (!task) {
        return res.status(404).json({ success: false, error: 'المهمة الميدانية غير موجودة' });
      }

      // فحص السياج الجغرافي (Geofence Check: حد أقصى 150 متراً من العميل)
      const geofence = fieldGeoEngine.verifyGeofenceArrival(
        { lat: lat, lng: lng },
        { lat: task.customer_lat, lng: task.customer_lng },
        150
      );

      if (!geofence.withinGeofence) {
        return res.status(400).json({
          success: false,
          error: `عذراً: لا يمكن تسجيل الوصول. أنت تبعد مسافة ${geofence.distanceMeters} متراً عن موقع العميل (الحد الأقصى المسموح به هو 150 متراً).`,
          distanceMeters: geofence.distanceMeters,
          thresholdMeters: 150
        });
      }

      const nowIso = new Date().toISOString();
      if (supabase) {
        await supabase
          .from('mken_field_tasks')
          .update({
            status: 'arrived',
            arrived_at: nowIso,
            distance_at_arrival_meters: geofence.distanceMeters,
            updated_at: nowIso
          })
          .eq('id', taskId);
      } else {
        task.status = 'arrived';
        task.arrived_at = nowIso;
        task.distance_at_arrival_meters = geofence.distanceMeters;
        inMemoryStore.tasks.set(taskId, task);
      }

      return res.status(200).json({
        success: true,
        status: 'arrived',
        arrivedAt: nowIso,
        distanceMeters: geofence.distanceMeters,
        message: 'تم التحقق من الحضور الفعلي في الموقع بنجاح'
      });
    }

    // =========================================================================
    // 5. إتمام المهمة والتحقق من رمز إثبات الخدمة (Complete Task - Proof of Service OTP)
    // =========================================================================
    if (action === 'complete-task') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

      const { taskId, technicianId, otp, signature, notes } = req.body || {};
      if (!taskId) {
        return res.status(400).json({ success: false, error: 'معرف المهمة مطلوب' });
      }

      let task = null;
      if (supabase) {
        const { data } = await supabase
          .from('mken_field_tasks')
          .select('*')
          .eq('id', taskId)
          .maybeSingle();
        task = data;
      } else {
        task = inMemoryStore.tasks.get(taskId);
      }

      if (!task) {
        return res.status(404).json({ success: false, error: 'المهمة غير موجودة' });
      }

      // التحقق من رمز إثبات الخدمة OTP (أو التوقيع الرقمي كبديل معتمد في وضع عدم الاتصال)
      const isOtpValid = fieldGeoEngine.verifyCompletionOtp(task.completion_otp, otp);
      const isSignatureValid = Boolean(signature && String(signature).length > 20);

      if (!isOtpValid && !isSignatureValid) {
        return res.status(400).json({
          success: false,
          error: 'رمز إثبات الخدمة (OTP) غير صحيح. يرجى طلب الرمز المستلم على جوال العميل أو أخذ توقيع العميل الرقمي.'
        });
      }

      const nowIso = new Date().toISOString();

      if (supabase) {
        // تحديث المهمة وإبطال رابط التتبع فوراً
        await supabase
          .from('mken_field_tasks')
          .update({
            status: 'completed',
            completed_at: nowIso,
            otp_verified_at: isOtpValid ? nowIso : null,
            customer_signature: signature || null,
            tracking_expires_at: nowIso, // إبطال فوري للرابط
            notes: notes || task.notes,
            updated_at: nowIso
          })
          .eq('id', taskId);

        // تحرير الفني ليكون متاحاً للمهام التالية
        if (task.technician_id) {
          await supabase
            .from('mken_field_technicians')
            .update({
              status: 'available',
              current_task_id: null,
              updated_at: nowIso
            })
            .eq('id', task.technician_id);
        }
      } else {
        task.status = 'completed';
        task.completed_at = nowIso;
        task.otp_verified_at = isOtpValid ? nowIso : null;
        task.customer_signature = signature || null;
        task.tracking_expires_at = nowIso;
        inMemoryStore.tasks.set(taskId, task);

        if (task.technician_id) {
          const tech = inMemoryStore.technicians.get(task.technician_id);
          if (tech) {
            tech.status = 'available';
            tech.current_task_id = null;
          }
        }
      }

      return res.status(200).json({
        success: true,
        status: 'completed',
        completedAt: nowIso,
        verificationMethod: isOtpValid ? 'otp' : 'signature',
        message: 'تم إثبات إنجاز الخدمة بنجاح وإغلاق التتبع الميداني'
      });
    }

    // =========================================================================
    // 6. إسناد المهمة لفني متاح (Assign Technician)
    // =========================================================================
    if (action === 'assign-technician') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

      const { taskId, technicianId, tenantSlug = 'default', customerName, customerPhone, customerLat, customerLng, customerAddress } = req.body || {};
      if (!taskId || !technicianId) {
        return res.status(400).json({ success: false, error: 'معرف المهمة والفني مطلوبان' });
      }

      const nowIso = new Date().toISOString();
      const initialOtp = fieldGeoEngine.generateCompletionOtp();

      if (supabase) {
        await supabase
          .from('mken_field_tasks')
          .upsert({
            id: taskId,
            tenant_slug: tenantSlug,
            technician_id: technicianId,
            customer_name: customerName || 'عميل المتجر',
            customer_phone: customerPhone || '0500000000',
            customer_lat: customerLat || 24.7136,
            customer_lng: customerLng || 46.6753,
            customer_address: customerAddress || 'الرياض',
            status: 'assigned',
            completion_otp: initialOtp,
            assigned_at: nowIso,
            updated_at: nowIso
          }, { onConflict: 'id' });

        await supabase
          .from('mken_field_technicians')
          .update({
            status: 'on_job',
            current_task_id: taskId,
            updated_at: nowIso
          })
          .eq('id', technicianId);
      } else {
        const task = {
          id: taskId,
          tenant_slug: tenantSlug,
          technician_id: technicianId,
          customer_name: customerName || 'عميل المتجر',
          customer_phone: customerPhone || '0500000000',
          customer_lat: Number(customerLat || 24.7136),
          customer_lng: Number(customerLng || 46.6753),
          customer_address: customerAddress || 'الرياض',
          status: 'assigned',
          completion_otp: initialOtp,
          assigned_at: nowIso
        };
        inMemoryStore.tasks.set(taskId, task);

        let tech = inMemoryStore.technicians.get(technicianId) || { id: technicianId, name: 'فني معتمد' };
        tech.status = 'on_job';
        tech.current_task_id = taskId;
        inMemoryStore.technicians.set(technicianId, tech);
      }

      return res.status(200).json({
        success: true,
        status: 'assigned',
        taskId: taskId,
        technicianId: technicianId,
        message: 'تم إسناد المهمة للفني بنجاح'
      });
    }

    return res.status(400).json({ error: 'إجراء غير مدعوم في الإسناد الميداني' });
  } catch (err) {
    console.error('[Dispatch API Error]:', err);
    return res.status(500).json({ success: false, error: 'خطأ في معالجة خدمة الإسناد الميداني: ' + err.message });
  }
};
