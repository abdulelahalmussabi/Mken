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

    // =========================================================================
    // 5. تقرير تحليلات الطابور ونقاط البيع (Queue & POS Real-time Analytics)
    // =========================================================================
    if (action === 'queue-pos-analytics' || action === 'queue-analytics') {
      const fromDate = req.query.from || req.query.from_date || new Date().toISOString().slice(0, 10);
      const toDate = req.query.to || req.query.to_date || new Date().toISOString().slice(0, 10);
      const branchId = req.query.branch || req.query.branch_id || null;
      const format = String(req.query.format || 'json').toLowerCase();

      let records = [];

      if (supabase) {
        let q = supabase
          .from('queue_ticket_pos_link')
          .select('*')
          .eq('tenant_slug', tenantSlug)
          .gte('ticket_date', fromDate)
          .lte('ticket_date', toDate);

        if (branchId) q = q.eq('branch_id', branchId);
        const { data: dbRows, error: dbErr } = await q.order('ticket_issued_at', { ascending: false });
        if (!dbErr && Array.isArray(dbRows)) {
          records = dbRows;
        }
      }

      // حساب المقاييس
      let totalTickets = records.length;
      let paidTickets = records.filter(r => r.link_status === 'paid');
      let cancelledTickets = records.filter(r => r.link_status === 'cancelled');

      let totalRevenue = paidTickets.reduce((acc, r) => acc + (parseFloat(r.total_amount) || 0), 0);
      let avgOrderValue = paidTickets.length > 0 ? (totalRevenue / paidTickets.length) : 0;

      // حساب أوقات الانتظار والخدمة
      let totalWaitSec = 0;
      let countWithWait = 0;
      let totalServiceSec = 0;
      let countWithService = 0;

      records.forEach(r => {
        if (r.called_at && r.ticket_issued_at) {
          const wait = Math.max(0, (new Date(r.called_at) - new Date(r.ticket_issued_at)) / 1000);
          totalWaitSec += wait;
          countWithWait++;
        }
        if (r.service_ended_at && r.service_started_at) {
          const srv = Math.max(0, (new Date(r.service_ended_at) - new Date(r.service_started_at)) / 1000);
          totalServiceSec += srv;
          countWithService++;
        }
      });

      const avgWaitMinutes = countWithWait > 0 ? Math.round((totalWaitSec / countWithWait / 60) * 10) / 10 : 0;
      const avgServiceMinutes = countWithService > 0 ? Math.round((totalServiceSec / countWithService / 60) * 10) / 10 : 0;
      const noShowPercent = totalTickets > 0 ? Math.round((cancelledTickets.length / totalTickets) * 1000) / 10 : 0;

      // التوزيع حسب المسار (byQueue)
      const queueGroups = {};
      const queueNames = { C: 'مشروبات وقهوة', F: 'مطبخ ووجبات', T: 'خدمة الطاولات', D: 'استلام التوصيل', K: 'كشك سريع' };

      records.forEach(r => {
        const qId = r.queue_id || 'C';
        if (!queueGroups[qId]) {
          queueGroups[qId] = {
            queue_id: qId,
            name_ar: queueNames[qId] || qId,
            tickets_count: 0,
            revenue: 0
          };
        }
        queueGroups[qId].tickets_count++;
        if (r.link_status === 'paid') {
          queueGroups[qId].revenue += (parseFloat(r.total_amount) || 0);
        }
      });

      const byQueue = Object.values(queueGroups).map(g => ({
        ...g,
        revenue: Math.round(g.revenue * 100) / 100
      }));

      // التوزيع بساعات اليوم (hourlyDemand)
      const hourlyDemand = [];
      for (let h = 0; h < 24; h++) {
        hourlyDemand.push({ hour: h, hour_label: `${h}:00`, orders_count: 0, revenue: 0 });
      }

      records.forEach(r => {
        const d = r.ticket_issued_at ? new Date(r.ticket_issued_at) : new Date();
        const hr = d.getHours();
        if (hourlyDemand[hr]) {
          hourlyDemand[hr].orders_count++;
          if (r.link_status === 'paid') {
            hourlyDemand[hr].revenue += (parseFloat(r.total_amount) || 0);
          }
        }
      });

      hourlyDemand.forEach(h => {
        h.revenue = Math.round(h.revenue * 100) / 100;
      });

      // تصدير CSV
      if (format === 'csv') {
        let csv = 'Ticket Number,Queue,Status,Total Amount,Issued At,Called At,Ended At\n';
        records.forEach(r => {
          csv += `"${r.ticket_number}","${r.queue_id}","${r.link_status}",${r.total_amount || 0},"${r.ticket_issued_at || ''}","${r.called_at || ''}","${r.service_ended_at || ''}"\n`;
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="queue_analytics_${fromDate}.csv"`);
        if (res.send) return res.status(200).send(csv);
        return res.status(200).json(csv);
      }

      return res.status(200).json({
        success: true,
        tenant_slug: tenantSlug,
        from_date: fromDate,
        to_date: toDate,
        summary: {
          total_tickets: totalTickets,
          paid_tickets_count: paidTickets.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          average_order_value: Math.round(avgOrderValue * 100) / 100,
          average_wait_minutes: avgWaitMinutes,
          average_service_minutes: avgServiceMinutes,
          no_show_percent: noShowPercent
        },
        by_queue: byQueue,
        hourly_demand: hourlyDemand
      });
    }

    return res.status(400).json({ error: `Unknown report action: ${action}` });
  } catch (err) {
    console.error('ERP Reports API error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};
