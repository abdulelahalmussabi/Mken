'use strict';

/**
 * منصة مكّن (mken.live) — موديول التقارير المالية والتحليلية المنفصلة (OLAP & Financial BI)
 * متوافق مع: ZATCA VAT Return, COGS Profitability, Multi-tier Inventory Aging
 */

const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../supabase-env');
const { handleCors } = require('../cors');

module.exports = async function handler(req, res) {
  if (handleCors && res.setHeader) {
    const handled = await handleCors(req, res);
    if (handled) return;
  }

  const url = new URL(req.url, 'http://localhost');
  const action = req.query.action || url.searchParams.get('action') || (req.body && req.body.action) || 'sales-cogs-margin';
  const tenantSlug = req.query.tenant_slug || (req.body && req.body.tenant_slug) || 'default';

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const serviceKey = sbEnv.getSupabaseServiceKey();
  const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  try {
    // =========================================================================
    // 1. تقرير المبيعات وتكلفة البضاعة المباعة وهوامش الربح (Sales, COGS & Margins)
    // =========================================================================
    if (action === 'sales-cogs-margin') {
      if (!supabase) {
        return res.status(200).json({
          success: true,
          summary: { totalSales: 0, totalCogs: 0, totalGrossProfit: 0, overallMarginPercent: 0 },
          items: []
        });
      }

      const { data, error } = await supabase
        .from('mken_v_sales_cogs_margins')
        .select('*')
        .eq('tenant_slug', tenantSlug);

      if (error) throw error;

      const items = data || [];
      const totalSales = items.reduce((acc, it) => acc + (Number(it.gross_sales_revenue) || 0), 0);
      const totalCogs = items.reduce((acc, it) => acc + (Number(it.total_cogs) || 0), 0);
      const totalGrossProfit = items.reduce((acc, it) => acc + (Number(it.total_gross_profit) || 0), 0);
      const overallMarginPercent = totalSales > 0 ? (totalGrossProfit / totalSales) * 100 : 0;

      return res.status(200).json({
        success: true,
        summary: {
          totalSales: Math.round(totalSales * 100) / 100,
          totalCogs: Math.round(totalCogs * 100) / 100,
          totalGrossProfit: Math.round(totalGrossProfit * 100) / 100,
          overallMarginPercent: Math.round(overallMarginPercent * 100) / 100
        },
        items
      });
    }

    // =========================================================================
    // 2. تقرير تقييم المخزون المالي وتقادم الأصناف (Valuation & Aging)
    // =========================================================================
    if (action === 'inventory-valuation') {
      if (!supabase) {
        return res.status(200).json({
          success: true,
          summary: { totalCostValuation: 0, potentialSalesValuation: 0, criticalStagnantCount: 0, lowStockCount: 0 },
          items: []
        });
      }

      const { data, error } = await supabase
        .from('mken_v_inventory_valuation_aging')
        .select('*')
        .eq('tenant_slug', tenantSlug);

      if (error) throw error;

      const items = data || [];
      const totalCostValuation = items.reduce((acc, it) => acc + (Number(it.total_cost_valuation) || 0), 0);
      const potentialSalesValuation = items.reduce((acc, it) => acc + (Number(it.potential_retail_valuation) || 0), 0);
      const criticalStagnantCount = items.filter(it => it.stock_health_status === 'STAGNANT_CRITICAL').length;
      const lowStockCount = items.filter(it => it.is_low_stock).length;

      return res.status(200).json({
        success: true,
        summary: {
          totalCostValuation: Math.round(totalCostValuation * 100) / 100,
          potentialSalesValuation: Math.round(potentialSalesValuation * 100) / 100,
          criticalStagnantCount,
          lowStockCount,
          totalItemsCount: items.length
        },
        items
      });
    }

    // =========================================================================
    // 3. تقرير الإقرار الضريبي الدوري لزاتكا (ZATCA VAT Return Reconciliation)
    // =========================================================================
    if (action === 'zatca-vat-return') {
      if (!supabase) {
        return res.status(200).json({
          success: true,
          periods: []
        });
      }

      const { data, error } = await supabase
        .from('mken_v_zatca_vat_reconciliation')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .order('tax_period', { ascending: false });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        periods: data || []
      });
    }

    // =========================================================================
    // 4. كشف حركة دفتر المخزون للصنف (Item Stock Ledger Audit Trail)
    // =========================================================================
    if (action === 'stock-ledger') {
      const itemId = req.query.item_id || (req.body && req.body.item_id);
      if (!itemId) {
        return res.status(400).json({ success: false, error: 'item_id is required.' });
      }

      if (!supabase) return res.status(200).json({ success: true, ledger: [] });

      const { data, error } = await supabase
        .from('mken_inventory_ledger')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        itemId,
        movementsCount: (data || []).length,
        ledger: data || []
      });
    }

    return res.status(400).json({ error: `Unknown report action: ${action}` });
  } catch (err) {
    console.error('ERP Reports API error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};
