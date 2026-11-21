/**
 * منصة مكّن (mken.live) — نظام الإعلان الصوتي الذكي للتذاكر (Queue Voice Announcer)
 * يدعم النطق الصوتي الطبيعي باللغة العربية (Web Speech API) مع منع التداخل الصوتي
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MkenQueueAnnouncer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var speechQueue = [];
  var isSpeaking = false;
  var arabicVoice = null;
  var currentScope = {
    zoneId: null,
    counters: null
  };

  function setScope(scope) {
    if (!scope) {
      currentScope.zoneId = null;
      currentScope.counters = null;
      return;
    }
    if (scope.zoneId !== undefined) {
      currentScope.zoneId = scope.zoneId ? String(scope.zoneId) : null;
    }
    if (scope.counters !== undefined) {
      if (Array.isArray(scope.counters)) {
        currentScope.counters = scope.counters.map(function (c) { return String(c).trim(); });
      } else if (typeof scope.counters === 'string') {
        currentScope.counters = scope.counters.split(',').map(function (c) { return c.trim(); });
      } else {
        currentScope.counters = null;
      }
    }
  }

  function getScope() {
    return {
      zoneId: currentScope.zoneId,
      counters: currentScope.counters ? currentScope.counters.slice() : null
    };
  }

  function loadArabicVoice() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    var voices = window.speechSynthesis.getVoices() || [];
    for (var i = 0; i < voices.length; i++) {
      var v = voices[i];
      if (v.lang && (v.lang.indexOf('ar') === 0 || v.lang.toLowerCase().indexOf('arabic') !== -1)) {
        arabicVoice = v;
        break;
      }
    }
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    loadArabicVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadArabicVoice;
    }
  }

  /**
   * معالجة نطق الحروف الإنجليزية بالعربية للأرقام مثل C-042 -> سي إثنين وأربعين
   */
  function formatSpokenTicket(ticketNumber) {
    var raw = String(ticketNumber || '').trim();
    var letterMap = {
      'A': 'ألف', 'B': 'باء', 'C': 'سي', 'D': 'دي', 'E': 'إي',
      'F': 'إف', 'K': 'كاف', 'T': 'تي', 'P': 'بي', 'S': 'سين'
    };

    var parts = raw.split('-');
    if (parts.length === 2) {
      var prefix = parts[0].toUpperCase();
      var num = parseInt(parts[1], 10);
      var prefixSpoken = letterMap[prefix] || prefix;
      return prefixSpoken + ' ' + (isNaN(num) ? parts[1] : num);
    }
    return raw;
  }

  /**
   * إعلان صوتي لرقم تذكرة محدد
   * @param {string} ticketNumber - مثل C-042
   * @param {string|number} counterNameOrNum - كاونتر 1 أو مكتب الاستقبال
   * @param {Object} options - اختيارات السرعة والنبرة
   */
  function announceTicket(ticketNumber, counterNameOrNum, options) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return Promise.resolve({ supported: false });
    }

    options = options || {};

    // فحص عزل شاشات المناطق والكاونترات المخصصة
    if (currentScope.counters && currentScope.counters.length > 0) {
      var checkCounterId = options.counterId != null ? String(options.counterId) : null;
      var checkCounterNum = typeof counterNameOrNum === 'number' || /^\d+$/.test(counterNameOrNum)
        ? String(counterNameOrNum)
        : null;
      var matchedCounter = false;
      for (var ci = 0; ci < currentScope.counters.length; ci++) {
        var allow = currentScope.counters[ci];
        if (checkCounterId && allow === checkCounterId) { matchedCounter = true; break; }
        if (checkCounterNum && allow === checkCounterNum) { matchedCounter = true; break; }
        if (String(counterNameOrNum || '').indexOf(allow) !== -1) { matchedCounter = true; break; }
      }
      if (!matchedCounter) {
        return Promise.resolve({ spoken: false, skipped: true, reason: 'counter_filtered' });
      }
    }

    if (currentScope.zoneId && options.zoneId) {
      if (String(currentScope.zoneId) !== String(options.zoneId)) {
        return Promise.resolve({ spoken: false, skipped: true, reason: 'zone_filtered' });
      }
    }

    var spokenNumber = formatSpokenTicket(ticketNumber);
    var counterText = typeof counterNameOrNum === 'number' || /^\d+$/.test(counterNameOrNum)
      ? 'كاونتر ' + counterNameOrNum
      : String(counterNameOrNum || 'كاونتر الخدمة');

    var text = 'تذكرة رقم ' + spokenNumber + '، تفضل إلى ' + counterText;

    return new Promise(function (resolve) {
      speechQueue.push({
        text: text,
        rate: options.rate || 0.9,
        pitch: options.pitch || 1.0,
        resolve: resolve
      });
      processNext();
    });
  }

  function processNext() {
    if (isSpeaking || speechQueue.length === 0) return;
    if (!window.speechSynthesis) return;

    var item = speechQueue.shift();
    isSpeaking = true;

    try {
      var utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = 'ar-SA';
      if (arabicVoice) utterance.voice = arabicVoice;
      utterance.rate = item.rate;
      utterance.pitch = item.pitch;

      utterance.onend = function () {
        isSpeaking = false;
        item.resolve({ spoken: true });
        setTimeout(processNext, 200);
      };

      utterance.onerror = function () {
        isSpeaking = false;
        item.resolve({ spoken: false });
        setTimeout(processNext, 200);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      isSpeaking = false;
      item.resolve({ spoken: false, error: e.message });
      processNext();
    }
  }

  return {
    announceTicket: announceTicket,
    formatSpokenTicket: formatSpokenTicket,
    setScope: setScope,
    getScope: getScope,
    isVoiceSupported: function () {
      return typeof window !== 'undefined' && !!window.speechSynthesis;
    }
  };
});
