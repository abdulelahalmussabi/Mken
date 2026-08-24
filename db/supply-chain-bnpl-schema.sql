-- ==============================================================================
-- منصة مكِّن (Mken SaaS) - محرك سلاسل الإمداد وإعادة الطلب بالذكاء الاصطناعي و BNPL
-- PostgreSQL / Supabase RLS Schema
-- ==============================================================================

-- 1. جدول سجلات وأوامر الشراء التلقائية (auto_reorder_logs)
CREATE TABLE IF NOT EXISTS public.auto_reorder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    supplier_id VARCHAR(50),
    supplier_name VARCHAR(150),
    current_stock INT NOT NULL,
    safety_stock_threshold INT NOT NULL,
    recommended_po_qty INT NOT NULL,
    po_status VARCHAR(30) DEFAULT 'DRAFT_PO_CREATED', -- DRAFT_PO_CREATED, SENT_TO_SUPPLIER, APPROVED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, item_id, po_status) -- Anti-Duplicate PO Protection
);

ALTER TABLE public.auto_reorder_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY auto_reorder_isolation ON public.auto_reorder_logs
    FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);

-- 2. دالة فحص المخزون وتوليد مسودات أومر الشراء بالذكاء الاصطناعي (process_auto_reorder_triggers)
CREATE OR REPLACE FUNCTION public.process_auto_reorder_triggers(
    p_tenant_id UUID
)
RETURNS TABLE (
    out_item_id VARCHAR,
    out_item_name VARCHAR,
    out_supplier_name VARCHAR,
    out_current_stock INT,
    out_recommended_qty INT,
    out_status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_po_id UUID;
BEGIN
    -- محاكاة فحص المخزون وتحديد الأصناف ذات الرصيد المنخفض
    IF NOT EXISTS (
        SELECT 1 FROM public.auto_reorder_logs 
        WHERE tenant_id = p_tenant_id AND item_id = 'ITEM-FABRIC-99' AND po_status = 'DRAFT_PO_CREATED'
    ) THEN
        INSERT INTO public.auto_reorder_logs (
            tenant_id, item_id, item_name, supplier_id, supplier_name,
            current_stock, safety_stock_threshold, recommended_po_qty, po_status
        ) VALUES (
            p_tenant_id, 'ITEM-FABRIC-99', 'لفة قماش إيطالي تفصيل', 'SUPP-001', 'مؤسسة النسيج الذهبي للتجارة',
            4, 10, 50, 'DRAFT_PO_CREATED'
        );
    END IF;

    RETURN QUERY
    SELECT 
        arl.item_id,
        arl.item_name,
        arl.supplier_name,
        arl.current_stock,
        arl.recommended_po_qty,
        arl.po_status
    FROM public.auto_reorder_logs arl
    WHERE arl.tenant_id = p_tenant_id AND arl.po_status = 'DRAFT_PO_CREATED';
END;
$$;
