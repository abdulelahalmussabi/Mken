/**
 * عناوين البريد الإلكتروني — مكن
 */
(function () {
  'use strict';

  var TYPES = [
    {
      id: 'inquiries',
      name: 'الاستفسارات',
      icon: '✉️',
      placeholder: 'info@mken.live',
      hint: 'استفسارات عامة وطلبات معلومات',
    },
    {
      id: 'sales',
      name: 'المبيعات',
      icon: '🛒',
      placeholder: 'sales@mken.live',
      hint: 'عروض الأسعار والخدمات التجارية',
    },
    {
      id: 'support',
      name: 'خدمة العملاء',
      icon: '🎧',
      placeholder: 'CS@mken.live',
      hint: 'متابعة الطلبات والدعم الفني',
    },
  ];

  window.MkenEmailsCatalog = {
    TYPES: TYPES,
  };
})();
