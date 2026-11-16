'use strict';

/**
 * مكن — موجّه عمليات موحّد (Hobby ≤12 functions)
 *
 * يجمع نقاط النهاية الثقيلة خلف دالة serverless واحدة:
 *   queue | checkout | dispatch | governance | procurement | erp-reports | instagram
 *
 * عبر vercel.json:
 *   /api/v1/queue*        → /api/v1/ops?module=queue
 *   /api/v1/checkout*     → /api/v1/ops?module=checkout
 *   /api/v1/dispatch*     → /api/v1/ops?module=dispatch
 *   /api/v1/governance*   → /api/v1/ops?module=governance
 *   /api/v1/procurement*  → /api/v1/ops?module=procurement
 *   /api/v1/erp-reports*  → /api/v1/ops?module=erp-reports
 *   /api/instagram*       → /api/v1/ops?module=instagram
 */

const HANDLERS = {
  queue: () => require('../_lib/handlers/queue'),
  checkout: () => require('../_lib/handlers/checkout'),
  dispatch: () => require('../_lib/handlers/dispatch'),
  governance: () => require('../_lib/handlers/governance'),
  procurement: () => require('../_lib/handlers/procurement'),
  'erp-reports': () => require('../_lib/handlers/erp-reports'),
  instagram: () => require('../_lib/handlers/instagram'),
};

function resolveModule(req) {
  const q = (req.query && (req.query.module || req.query.m)) || '';
  if (q && HANDLERS[q]) return String(q);

  // Fallback from URL path when rewrite omitted module
  const url = String(req.url || '');
  if (url.includes('/instagram')) return 'instagram';
  if (url.includes('/checkout')) return 'checkout';
  if (url.includes('/dispatch')) return 'dispatch';
  if (url.includes('/governance')) return 'governance';
  if (url.includes('/procurement')) return 'procurement';
  if (url.includes('/erp-reports')) return 'erp-reports';
  if (url.includes('/queue')) return 'queue';
  return '';
}

module.exports = async function handler(req, res) {
  const mod = resolveModule(req);
  const loader = HANDLERS[mod];
  if (!loader) {
    return res.status(400).json({
      error: 'unknown_ops_module',
      hint: 'Pass ?module=queue|checkout|dispatch|governance|procurement|erp-reports|instagram',
    });
  }
  return loader()(req, res);
};
