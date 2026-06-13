/**
 * أتمتة رسائل الواتساب والتذكيرات — منصة رونق
 */
(function () {
  'use strict';

  function cleanPhone(phone) {
    var store = window.MkenServicesStore;
    var digits = (phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (store && store.normalizePhone) {
      digits = store.normalizePhone(phone);
    }
    return digits;
  }

  function getWhatsAppConfig(config) {
    var store = window.MkenServicesStore;
    var cfg = config || (store && store.loadConfig()) || {};
    return cfg.whatsappApi || { enabled: false, provider: 'none' };
  }

  function sendWhatsAppMessage(to, body, eventType, appointment, config) {
    var waConfig = getWhatsAppConfig(config);
    if (!waConfig.enabled || waConfig.provider === 'none') {
      return Promise.reject(new Error('WhatsApp API disabled or not configured'));
    }

    var phone = cleanPhone(to);
    if (!phone) {
      return Promise.reject(new Error('Invalid phone number'));
    }

    var provider = waConfig.provider;
    var promise;
    switch (provider) {
      case 'ultramsg':
        promise = sendUltramsg(phone, body, waConfig.instanceId, waConfig.token);
        break;
      case 'twilio':
        promise = sendTwilio(phone, body, waConfig.accountSid, waConfig.token, waConfig.fromNumber);
        break;
      case 'custom':
        promise = sendCustom(phone, body, waConfig.url, waConfig.token, eventType, appointment);
        break;
      case 'whatsapp_business':
        promise = sendWhatsAppBusiness(phone, body, waConfig.phoneNumberId, waConfig.token, waConfig.templateName, waConfig.languageCode);
        break;
      default:
        promise = Promise.reject(new Error('Unknown WhatsApp provider: ' + waConfig.provider));
    }

    return promise.then(function (result) {
      logWhatsappMessageLocalAndRemote({
        phone: phone,
        body: body,
        provider: provider,
        status: 'success',
        eventType: eventType,
        appointmentId: appointment ? appointment.id : null
      }, config);
      return result;
    }).catch(function (err) {
      logWhatsappMessageLocalAndRemote({
        phone: phone,
        body: body,
        provider: provider,
        status: 'failed',
        errorMessage: err.message || String(err),
        eventType: eventType,
        appointmentId: appointment ? appointment.id : null
      }, config);
      throw err;
    });
  }

  function sendUltramsg(phone, body, instanceId, token) {
    if (!instanceId || !token) {
      return Promise.reject(new Error('Missing Ultramsg instanceId or token'));
    }
    var url = 'https://api.ultramsg.com/' + instanceId + '/messages/chat';
    var params = new URLSearchParams();
    params.append('token', token);
    params.append('to', phone);
    params.append('body', body);

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(function (res) {
      if (!res.ok) throw new Error('Ultramsg API error: HTTP Status ' + res.status);
      return res.json();
    });
  }

  function sendTwilio(phone, body, accountSid, token, fromNumber) {
    if (!accountSid || !token || !fromNumber) {
      return Promise.reject(new Error('Missing Twilio credentials'));
    }
    var url = 'https://api.twilio.com/2010-04-01/Accounts/' + accountSid + '/Messages.json';
    var formattedTo = '+' + phone;
    var params = new URLSearchParams();
    params.append('Body', body);
    params.append('From', 'whatsapp:' + fromNumber.replace(/^\+?/, '+'));
    params.append('To', 'whatsapp:' + formattedTo);

    var headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(accountSid + ':' + token)
    };

    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: params.toString()
    }).then(function (res) {
      if (!res.ok) throw new Error('Twilio API error: HTTP Status ' + res.status);
      return res.json();
    });
  }

  function sendWhatsAppBusiness(phone, body, phoneNumberId, token, templateName, languageCode) {
    if (!phoneNumberId || !token) {
      return Promise.reject(new Error('Missing WhatsApp Business credentials'));
    }
    var targetUrl = 'https://graph.facebook.com/v18.0/' + phoneNumberId + '/messages';
    var headers = {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    };

    var payload;
    if (templateName) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode || "ar"
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: body
                }
              ]
            }
          ]
        }
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: {
          body: body
        }
      };
    }

    var proxyUrl = '/api/webhook-proxy';
    return fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: targetUrl,
        headers: headers,
        body: payload
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().then(function (errData) {
          var errorMsg = (errData && errData.error && errData.error.message) || 'HTTP Status ' + res.status;
          throw new Error('WhatsApp Business API error: ' + errorMsg);
        }).catch(function () {
          throw new Error('WhatsApp Business API error: HTTP Status ' + res.status);
        });
      }
      return res.json();
    });
  }

  function sendCustom(phone, body, webhookUrl, token, eventType, appointment) {
    if (!webhookUrl) {
      return Promise.reject(new Error('Missing custom webhook URL'));
    }
    var headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    var payload = {
      to: phone,
      body: body,
      event: eventType,
      appointment: appointment
    };

    var proxyUrl = '/api/webhook-proxy';
    return fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        headers: headers,
        body: payload
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Custom Webhook error: HTTP Status ' + res.status);
      return res.text();
    });
  }

  function logWhatsappMessageLocalAndRemote(logObj, config) {
    var db = window.MkenSupabaseDb;
    var tenantSlug = store ? store.getCurrentTenantSlug() : 'default';

    if (db && db.isConfigured()) {
      db.logWhatsappMessage(logObj, tenantSlug).catch(function (err) {
        console.error('Failed to save log to Supabase:', err);
      });
    } else {
      try {
        var raw = localStorage.getItem('mken_whatsapp_logs');
        var logs = raw ? JSON.parse(raw) : [];
        logObj.id = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
        logObj.createdAt = new Date().toISOString();
        logObj.retryCount = 0;
        logs.unshift(logObj);
        localStorage.setItem('mken_whatsapp_logs', JSON.stringify(logs.slice(0, 100)));
      } catch (e) {
        console.error('Failed to log message locally:', e);
      }
    }
  }

  function sendConfirmationMessage(appointment, config) {
    var store = window.MkenServicesStore;
    var bookingStore = window.MkenBookingStore;
    if (!store || !bookingStore) return Promise.reject(new Error('Stores not loaded'));

    var brandName = store.getBrand(config).name;
    var service = store.getServiceById(appointment.serviceId);
    var serviceTitle = service ? service.title : appointment.serviceId;
    var act = store.getResolvedActivity(appointment.activityId, config);
    var activityTitle = act ? act.title : '';

    var message = bookingStore.buildWhatsAppMessage(
      brandName,
      appointment,
      serviceTitle,
      activityTitle
    );

    message = message.replace('طلب حجز موعد', 'تم تأكيد موعدك بنجاح');
    message = message.replace('يُرجى تأكيد الموعد', 'نتطلع لخدمتك!');

    return sendWhatsAppMessage(appointment.phone, message, 'confirmation', appointment, config);
  }

  function sendReminderMessage(appointment, hoursBefore, config) {
    var store = window.MkenServicesStore;
    var bookingStore = window.MkenBookingStore;
    if (!store || !bookingStore) return Promise.reject(new Error('Stores not loaded'));

    var brandName = store.getBrand(config).name;
    var service = store.getServiceById(appointment.serviceId);
    var serviceTitle = service ? service.title : appointment.serviceId;
    var act = store.getResolvedActivity(appointment.activityId, config);
    var activityTitle = act ? act.title : '';

    var message = bookingStore.buildReminderMessage(
      brandName,
      appointment,
      serviceTitle,
      activityTitle,
      hoursBefore
    );

    return sendWhatsAppMessage(appointment.phone, message, 'reminder', appointment, config);
  }

  var AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يونيو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var AR_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  function formatDateArabic(dateStr) {
    try {
      var parts = dateStr.split('-');
      var d = new Date(parts[0], parts[1] - 1, parts[2] || 12);
      return AR_DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + AR_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    } catch (e) {
      return dateStr;
    }
  }

  function formatTimeArabic(time) {
    try {
      var parts = time.split(':');
      var h = parseInt(parts[0], 10);
      var suffix = h < 12 ? 'صباحاً' : 'مساءً';
      var display = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return display + ':' + parts[1] + ' ' + suffix;
    } catch (e) {
      return time;
    }
  }

  function sendCancellationMessage(appointment, config) {
    var store = window.MkenServicesStore;
    if (!store) return Promise.reject(new Error('Store not loaded'));

    var brandName = store.getBrand(config).name;
    var service = store.getServiceById(appointment.serviceId);
    var serviceTitle = service ? service.title : appointment.serviceId;
    var act = store.getResolvedActivity(appointment.activityId, config);
    var activityTitle = act ? act.title : '';

    var lines = [
      'تم إلغاء موعدك — ' + brandName,
      '━━━━━━━━━━━━━━',
      'مرحباً ' + appointment.customerName + '،',
      'نود إفادتك بأنه تم إلغاء موعدك:',
    ];
    if (activityTitle) lines.push('النشاط: ' + activityTitle);
    lines.push(
      'الخدمة: ' + serviceTitle,
      'التاريخ: ' + formatDateArabic(appointment.date),
      'الوقت: ' + formatTimeArabic(appointment.time)
    );
    lines.push('━━━━━━━━━━━━━━', 'نشكرك لتفهمك.');
    var message = lines.join('\n');

    return sendWhatsAppMessage(appointment.phone, message, 'cancellation', appointment, config);
  }

  function sendPostponementMessage(appointment, config) {
    var store = window.MkenServicesStore;
    if (!store) return Promise.reject(new Error('Store not loaded'));

    var brandName = store.getBrand(config).name;
    var service = store.getServiceById(appointment.serviceId);
    var serviceTitle = service ? service.title : appointment.serviceId;
    var act = store.getResolvedActivity(appointment.activityId, config);
    var activityTitle = act ? act.title : '';

    var lines = [
      'تعديل موعدك — ' + brandName,
      '━━━━━━━━━━━━━━',
      'مرحباً ' + appointment.customerName + '،',
      'نود إفادتك بأنه تم تعديل موعد حجزك إلى:',
    ];
    if (activityTitle) lines.push('النشاط: ' + activityTitle);
    lines.push(
      'الخدمة: ' + serviceTitle,
      'التاريخ: ' + formatDateArabic(appointment.date),
      'الوقت: ' + formatTimeArabic(appointment.time)
    );
    if (appointment.partySize) lines.push('عدد الأشخاص: ' + appointment.partySize);
    if (appointment.nights) lines.push('عدد الليالي: ' + appointment.nights);
    if (appointment.locationAddress) lines.push('العنوان: ' + appointment.locationAddress);
    lines.push('━━━━━━━━━━━━━━', 'نتطلع لخدمتك!');
    var message = lines.join('\n');

    return sendWhatsAppMessage(appointment.phone, message, 'reschedule', appointment, config);
  }

  function processAutomatedReminders(config) {
    var store = window.MkenServicesStore;
    var bookingStore = window.MkenBookingStore;
    if (!store || !bookingStore) return;

    var waConfig = getWhatsAppConfig(config);
    if (!waConfig.enabled || !waConfig.sendReminder) return;

    var bookingSettings = bookingStore.getReminderSettings(store.getBooking(config));
    if (!bookingSettings.enabled) return;

    var appointments = bookingStore.getActiveAppointments();
    var due = bookingStore.getDueReminders(bookingSettings, appointments);

    due.forEach(function (item) {
      var apt = item.appointment;
      var hours = item.hoursBefore;

      console.log('Sending automated WhatsApp reminder for apt:', apt.id, 'hoursBefore:', hours);

      sendReminderMessage(apt, hours, config)
        .then(function () {
          console.log('Automated reminder sent successfully for:', apt.id);
          bookingStore.markReminderSent(apt.id, hours);
        })
        .catch(function (err) {
          console.error('Failed to send automated reminder for:', apt.id, err);
        });
    });
  }

  window.MkenWhatsappAutomation = {
    sendConfirmation: sendConfirmationMessage,
    sendReminder: sendReminderMessage,
    sendCancellation: sendCancellationMessage,
    sendPostponement: sendPostponementMessage,
    processQueue: processAutomatedReminders,
    sendMessage: sendWhatsAppMessage,
  };
})();
