'use strict';

module.exports = async function handler(_req, res) {
  return res.status(410).json({
    success: false,
    message: 'تم تعطيل نقطة التهيئة القديمة؛ تتم إدارة الحسابات وكلمات المرور عبر Supabase Auth فقط.'
  });
};
