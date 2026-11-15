-- =============================================================================
-- منصة مكّن (mken.live) — حزمة إدارة المبيعات، المشتريات، المخزون والتقارير (ERP-Commerce Suite)
-- متوافقة مع: ZATCA Phase 2, SAMA Payment Rules, PDPL Data Residency, MoC E-Commerce Law
-- =============================================================================

-- تفعيل امتداد توليد المعرفات إن لم يكن مفعلاً
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. جدول الأصناف والمخزون المتعدد الحالات (Multi-State Inventory Items)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mken_inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    sku VARCHAR(64) NOT NULL,
    barcode VARCHAR(64),
    name TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) DEFAULT 'general',
    
    -- طبقات المخزون الرباعية (Four-Tier Stock Architecture)
    physical_qty INT NOT NULL DEFAULT 0 CHECK (physical_qty >= 0),
    reserved_qty INT NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
    allocated_qty INT NOT NULL DEFAULT 0 CHECK (allocated_qty >= 0),
    
    -- نقطة إعادة الطلب للتنبيه الآلي
    reorder_point INT NOT NULL DEFAULT 5 CHECK (reorder_point >= 0),
    
    -- التسعير والتكلفة
    sell_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (sell_price >= 0),
    moving_average_cost NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (moving_average_cost >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_mken_inv_tenant_sku UNIQUE (tenant_slug, sku)
);

CREATE INDEX IF NOT EXISTS idx_mken_inv_tenant ON public.mken_inventory_items(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_mken_inv_sku ON public.mken_inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_mken_inv_active ON public.mken_inventory_items(tenant_slug, is_active);

-- =============================================================================
-- 2. جدول حجوزات السلة المؤقتة ذات الصلاحية (Inventory Cart Reservations with TTL)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mken_inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    session_id UUID NOT NULL,
    item_id UUID NOT NULL REFERENCES public.mken_inventory_items(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- active, committed, expired, cancelled
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_resv_session ON public.mken_inventory_reservations(session_id);
CREATE INDEX IF NOT EXISTS idx_mken_resv_status_expires ON public.mken_inventory_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_mken_resv_item ON public.mken_inventory_reservations(item_id);

-- =============================================================================
-- 3. دفتر حركة المخزون غير القابل للتعديل (Immutable Double-Entry Stock Ledger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mken_inventory_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    item_id UUID NOT NULL REFERENCES public.mken_inventory_items(id) ON DELETE RESTRICT,
    movement_type VARCHAR(50) NOT NULL, 
    -- Types: PURCHASE_RECEIPT, SALE_DEDUCTION, RESERVATION_HOLD, RESERVATION_RELEASE, RETURN_RESTOCK, INVENTORY_ADJUSTMENT
    qty_change INT NOT NULL,
    physical_after INT NOT NULL,
    reserved_after INT NOT NULL,
    unit_cost NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    total_cost_impact NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    reference_type VARCHAR(50) NOT NULL, -- purchase_order, goods_receipt, order, checkout_session, adjustment
    reference_id TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_ledger_tenant_item ON public.mken_inventory_ledger(tenant_slug, item_id);
CREATE INDEX IF NOT EXISTS idx_mken_ledger_created ON public.mken_inventory_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mken_ledger_ref ON public.mken_inventory_ledger(reference_type, reference_id);

-- =============================================================================
-- 4. إدارة الموردين والمشتريات (Procurement & Suppliers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mken_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    vat_number VARCHAR(32), -- الرقم الضريبي المعتمد (15 رقم لزاتكا)
    cr_number VARCHAR(32),  -- السجل التجاري
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    payment_terms VARCHAR(50) DEFAULT 'net_30', -- immediate, net_15, net_30, net_60
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mken_supplier_tenant_name UNIQUE (tenant_slug, name)
);

CREATE INDEX IF NOT EXISTS idx_mken_supplier_tenant ON public.mken_suppliers(tenant_slug);

-- أوامر الشراء (Purchase Orders)
CREATE TABLE IF NOT EXISTS public.mken_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    po_number VARCHAR(32) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES public.mken_suppliers(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft', -- draft, approved, partially_received, received, billed, cancelled
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
    notes TEXT,
    expected_delivery TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mken_po_tenant_number UNIQUE (tenant_slug, po_number)
);

CREATE INDEX IF NOT EXISTS idx_mken_po_tenant_status ON public.mken_purchase_orders(tenant_slug, status);

-- بنود أمر الشراء
CREATE TABLE IF NOT EXISTS public.mken_purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    purchase_order_id UUID NOT NULL REFERENCES public.mken_purchase_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.mken_inventory_items(id) ON DELETE RESTRICT,
    ordered_qty INT NOT NULL CHECK (ordered_qty > 0),
    received_qty INT NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    unit_purchase_price NUMERIC(14, 4) NOT NULL CHECK (unit_purchase_price >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    line_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. إشعارات استلام البضائع وتكاليف الإنزال (Goods Receipt Notes & Landed Costs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mken_goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    grn_number VARCHAR(32) NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES public.mken_purchase_orders(id) ON DELETE RESTRICT,
    received_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    receiver_name TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'completed', -- completed, voided
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mken_grn_tenant_number UNIQUE (tenant_slug, grn_number)
);

CREATE TABLE IF NOT EXISTS public.mken_goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    grn_id UUID NOT NULL REFERENCES public.mken_goods_receipt_notes(id) ON DELETE CASCADE,
    po_item_id UUID NOT NULL REFERENCES public.mken_purchase_order_items(id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES public.mken_inventory_items(id) ON DELETE RESTRICT,
    received_qty INT NOT NULL CHECK (received_qty > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- تكاليف الإنزال الملحقة بالشحنات (Landed Costs Allocation)
CREATE TABLE IF NOT EXISTS public.mken_landed_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    grn_id UUID NOT NULL REFERENCES public.mken_goods_receipt_notes(id) ON DELETE CASCADE,
    cost_type VARCHAR(50) NOT NULL, -- freight, customs, insurance, handling, other
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
    allocation_method VARCHAR(30) NOT NULL DEFAULT 'by_value', -- by_value, by_quantity
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. ترقية بنود الطلبات لتسجيل لقطة التكلفة (COGS Snapshot)
-- =============================================================================
DO $$ BEGIN
    IF to_regclass('public.mken_orders') IS NOT NULL THEN
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS cogs_total NUMERIC(14, 4) DEFAULT 0.0000;
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS gross_profit NUMERIC(14, 4) DEFAULT 0.0000;
    END IF;
END $$;

-- جدول بنود الطلبات التفصيلي لحفظ لقطات التكلفة التاريخية
CREATE TABLE IF NOT EXISTS public.mken_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    order_id TEXT NOT NULL,
    inventory_item_id UUID REFERENCES public.mken_inventory_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_sale_price NUMERIC(14, 2) NOT NULL,
    unit_cost_snapshot NUMERIC(14, 4) NOT NULL DEFAULT 0.0000, -- لقطة تكلفة البضاعة المباعة لحظة الشراء
    total_sale_price NUMERIC(14, 2) NOT NULL,
    total_cost_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    gross_margin_amount NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_order_items_order ON public.mken_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_mken_order_items_item ON public.mken_order_items(inventory_item_id);

-- =============================================================================
-- 7. الدوال التشغيلية الذرية (Atomic PL/pgSQL Business Engine)
-- =============================================================================

-- دالة تحرير الحجوزات المنتهية الصلاحية وإعادتها لـ ATP (Auto-Expiry Release)
CREATE OR REPLACE FUNCTION public.mken_fn_release_expired_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT := 0;
    v_rec RECORD;
BEGIN
    FOR v_rec IN 
        SELECT r.id, r.item_id, r.quantity, r.tenant_slug, r.session_id
        FROM public.mken_inventory_reservations r
        WHERE r.status = 'active' AND r.expires_at <= NOW()
        FOR UPDATE OF r
    LOOP
        -- تخفيض الكمية المحجوزة في جدول المخزون
        UPDATE public.mken_inventory_items
        SET reserved_qty = GREATEST(0, reserved_qty - v_rec.quantity),
            updated_at = NOW()
        WHERE id = v_rec.item_id;

        -- تحديث حالة الحجز إلى منتهي
        UPDATE public.mken_inventory_reservations
        SET status = 'expired',
            updated_at = NOW()
        WHERE id = v_rec.id;

        -- تسجيل الحركة في دفتر المخزون
        INSERT INTO public.mken_inventory_ledger (
            tenant_slug, item_id, movement_type, qty_change,
            physical_after, reserved_after, unit_cost, total_cost_impact,
            reference_type, reference_id, notes
        )
        SELECT 
            v_rec.tenant_slug, v_rec.item_id, 'RESERVATION_RELEASE', 0,
            i.physical_qty, i.reserved_qty, i.moving_average_cost, 0,
            'checkout_session', v_rec.session_id::text, 'إلغاء حجز منتهي الصلاحية تلقائياً'
        FROM public.mken_inventory_items i
        WHERE i.id = v_rec.item_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- دالة حجز المخزون الذرية لجلسة الشراء (Atomic Cart Reservation)
CREATE OR REPLACE FUNCTION public.mken_fn_reserve_cart_inventory(
    p_tenant_slug TEXT,
    p_session_id UUID,
    p_cart_items JSONB,
    p_ttl_minutes INT DEFAULT 10
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_item_id UUID;
    v_requested_qty INT;
    v_inv RECORD;
    v_atp INT;
    v_reserved_count INT := 0;
    v_expiry TIMESTAMPTZ := NOW() + (p_ttl_minutes || ' minutes')::INTERVAL;
BEGIN
    -- تنظيف أولي سريع للحجوزات المنتهية
    PERFORM public.mken_fn_release_expired_reservations();

    -- فحص وحجز كل بند
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
        v_item_id := (v_item->>'itemId')::UUID;
        v_requested_qty := GREATEST(1, COALESCE((v_item->>'quantity')::INT, 1));

        -- جلب الصنف مع قفل الصف لمنع تعارض الحجز المتزامن
        SELECT id, name, sku, physical_qty, reserved_qty, allocated_qty, sell_price, moving_average_cost
        INTO v_inv
        FROM public.mken_inventory_items
        WHERE id = v_item_id AND tenant_slug = p_tenant_slug AND is_active = TRUE
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'ITEM_NOT_FOUND',
                'message', 'أحد الأصناف المطلوبة غير موجود أو غير متاح للبيع.'
            );
        END IF;

        -- حساب المتاح للبيع ATP
        v_atp := v_inv.physical_qty - (v_inv.reserved_qty + v_inv.allocated_qty);

        IF v_atp < v_requested_qty THEN
            -- إلغاء كل ما تم حجزه في هذه المحاولة لضمان الذرية التامة (All-or-Nothing)
            PERFORM public.mken_fn_cancel_cart_reservation(p_session_id);

            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'INSUFFICIENT_STOCK',
                'message', format('الكمية المتاحة من الصنف "%s" هي (%s) فقط، والكمية المطلوبة (%s).', v_inv.name, GREATEST(0, v_atp), v_requested_qty),
                'item_id', v_item_id,
                'available_qty', GREATEST(0, v_atp)
            );
        END IF;

        -- زيادة الكمية المحجوزة دون مساس بالرصيد الفعلي physical_qty
        UPDATE public.mken_inventory_items
        SET reserved_qty = reserved_qty + v_requested_qty,
            updated_at = NOW()
        WHERE id = v_item_id;

        -- إدراج سجل الحجز المربوط بجلسة الشراء
        INSERT INTO public.mken_inventory_reservations (
            tenant_slug, session_id, item_id, quantity, status, expires_at
        ) VALUES (
            p_tenant_slug, p_session_id, v_item_id, v_requested_qty, 'active', v_expiry
        );

        -- تسجيل حركة قفل في دفتر المخزون
        INSERT INTO public.mken_inventory_ledger (
            tenant_slug, item_id, movement_type, qty_change,
            physical_after, reserved_after, unit_cost, total_cost_impact,
            reference_type, reference_id, notes
        ) VALUES (
            p_tenant_slug, v_item_id, 'RESERVATION_HOLD', 0,
            v_inv.physical_qty, v_inv.reserved_qty + v_requested_qty, v_inv.moving_average_cost, 0,
            'checkout_session', p_session_id::text, format('حجز مؤقت لمدة %s دقائق للعميل', p_ttl_minutes)
        );

        v_reserved_count := v_reserved_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'reserved_items_count', v_reserved_count,
        'expires_at', v_expiry
    );
END;
$$;

-- دالة إلغاء حجز سلة معينة يدوياً أو عند الفشل
CREATE OR REPLACE FUNCTION public.mken_fn_cancel_cart_reservation(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    FOR v_rec IN 
        SELECT id, item_id, quantity, tenant_slug
        FROM public.mken_inventory_reservations
        WHERE session_id = p_session_id AND status = 'active'
        FOR UPDATE
    LOOP
        UPDATE public.mken_inventory_items
        SET reserved_qty = GREATEST(0, reserved_qty - v_rec.quantity),
            updated_at = NOW()
        WHERE id = v_rec.item_id;

        UPDATE public.mken_inventory_reservations
        SET status = 'cancelled',
            updated_at = NOW()
        WHERE id = v_rec.id;

        INSERT INTO public.mken_inventory_ledger (
            tenant_slug, item_id, movement_type, qty_change,
            physical_after, reserved_after, unit_cost, total_cost_impact,
            reference_type, reference_id, notes
        )
        SELECT 
            v_rec.tenant_slug, v_rec.item_id, 'RESERVATION_RELEASE', 0,
            i.physical_qty, i.reserved_qty, i.moving_average_cost, 0,
            'checkout_session', p_session_id::text, 'إلغاء حجز السلة بناء على طلب أو فشل عملية'
        FROM public.mken_inventory_items i
        WHERE i.id = v_rec.item_id;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- دالة تثبيت الشراء بعد استلام إشعار الدفع البنكي SAMA الموثق (Commit Reservation)
CREATE OR REPLACE FUNCTION public.mken_fn_commit_cart_reservation(
    p_tenant_slug TEXT,
    p_session_id UUID,
    p_order_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec RECORD;
    v_inv RECORD;
    v_total_cogs NUMERIC(14, 4) := 0.0000;
    v_committed_items INT := 0;
BEGIN
    FOR v_rec IN 
        SELECT r.id, r.item_id, r.quantity
        FROM public.mken_inventory_reservations r
        WHERE r.session_id = p_session_id AND r.status = 'active'
        FOR UPDATE OF r
    LOOP
        -- جلب الصنف وحفظ تكلفة البضاعة المباعة وقت البيع
        SELECT id, name, sell_price, moving_average_cost, physical_qty, reserved_qty
        INTO v_inv
        FROM public.mken_inventory_items
        WHERE id = v_rec.item_id
        FOR UPDATE;

        -- خصم فعلي من الرصيد الفيزيائي والرصيد المحجوز
        UPDATE public.mken_inventory_items
        SET physical_qty = GREATEST(0, physical_qty - v_rec.quantity),
            reserved_qty = GREATEST(0, reserved_qty - v_rec.quantity),
            updated_at = NOW()
        WHERE id = v_rec.item_id;

        -- تحديث حالة الحجز إلى مثبّت
        UPDATE public.mken_inventory_reservations
        SET status = 'committed',
            updated_at = NOW()
        WHERE id = v_rec.id;

        -- تسجيل بند الطلب مع لقطة التكلفة COGS Snapshot
        INSERT INTO public.mken_order_items (
            tenant_slug, order_id, inventory_item_id, item_name,
            quantity, unit_sale_price, unit_cost_snapshot,
            total_sale_price, total_cost_amount, gross_margin_amount
        ) VALUES (
            p_tenant_slug, p_order_id, v_rec.item_id, v_inv.name,
            v_rec.quantity, v_inv.sell_price, v_inv.moving_average_cost,
            (v_inv.sell_price * v_rec.quantity),
            (v_inv.moving_average_cost * v_rec.quantity),
            ((v_inv.sell_price - v_inv.moving_average_cost) * v_rec.quantity)
        );

        -- تسجيل القيد المحاسبي في دفتر المخزون
        INSERT INTO public.mken_inventory_ledger (
            tenant_slug, item_id, movement_type, qty_change,
            physical_after, reserved_after, unit_cost, total_cost_impact,
            reference_type, reference_id, notes
        ) VALUES (
            p_tenant_slug, v_rec.item_id, 'SALE_DEDUCTION', -v_rec.quantity,
            v_inv.physical_qty - v_rec.quantity, v_inv.reserved_qty - v_rec.quantity,
            v_inv.moving_average_cost, -(v_inv.moving_average_cost * v_rec.quantity),
            'order', p_order_id, 'خصم نهائي بعد تأكيد الدفع الإلكتروني المعتمد'
        );

        v_total_cogs := v_total_cogs + (v_inv.moving_average_cost * v_rec.quantity);
        v_committed_items := v_committed_items + 1;
    END LOOP;

    -- تحديث إجمالي تكلفة البضاعة المباعة على الطلب الرئيسي
    UPDATE public.mken_orders
    SET cogs_total = v_total_cogs,
        gross_profit = (total_amount - tax_amount - v_total_cogs)
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'committed_items_count', v_committed_items,
        'total_cogs', v_total_cogs
    );
END;
$$;

-- دالة اعتماد استلام بضاعة الشراء وتحديث متوسط التكلفة المرجح (GRN Receipt & Moving Average Cost)
CREATE OR REPLACE FUNCTION public.mken_fn_process_goods_receipt(
    p_tenant_slug TEXT,
    p_grn_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_grn RECORD;
    v_item RECORD;
    v_inv RECORD;
    v_po_item RECORD;
    v_landed_total NUMERIC(14, 2) := 0.00;
    v_po_total_value NUMERIC(14, 2) := 0.00;
    v_item_landed_share NUMERIC(14, 4) := 0.0000;
    v_effective_unit_cost NUMERIC(14, 4);
    v_new_mac NUMERIC(14, 4);
    v_processed_count INT := 0;
BEGIN
    SELECT * INTO v_grn
    FROM public.mken_goods_receipt_notes
    WHERE id = p_grn_id AND tenant_slug = p_tenant_slug AND status = 'completed';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'إشعار استلام البضائع غير موجود أو تم إلغاؤه.');
    END IF;

    -- احتساب إجمالي تكاليف الإنزال الملحقة بالـ GRN
    SELECT COALESCE(SUM(amount), 0.00) INTO v_landed_total
    FROM public.mken_landed_costs
    WHERE grn_id = p_grn_id;

    -- احتساب إجمالي قيمة البضائع المستلمة في هذه الشحنة لتوزيع تكلفة الإنزال بالنسبة والتناسب
    SELECT COALESCE(SUM(gri.received_qty * poi.unit_purchase_price), 0.00)
    INTO v_po_total_value
    FROM public.mken_goods_receipt_items gri
    JOIN public.mken_purchase_order_items poi ON gri.po_item_id = poi.id
    WHERE gri.grn_id = p_grn_id;

    -- معالجة كل صنف مستلم وتحديث الرصيد والتكلفة المرجحة
    FOR v_item IN 
        SELECT gri.item_id, gri.received_qty, gri.po_item_id, poi.unit_purchase_price
        FROM public.mken_goods_receipt_items gri
        JOIN public.mken_purchase_order_items poi ON gri.po_item_id = poi.id
        WHERE gri.grn_id = p_grn_id
    LOOP
        SELECT id, physical_qty, reserved_qty, moving_average_cost
        INTO v_inv
        FROM public.mken_inventory_items
        WHERE id = v_item.item_id AND tenant_slug = p_tenant_slug
        FOR UPDATE;

        -- توزيع تكلفة الإنزال على الوحدة الواحدة
        IF v_po_total_value > 0 AND v_landed_total > 0 THEN
            v_item_landed_share := ((v_item.unit_purchase_price * v_item.received_qty) / v_po_total_value * v_landed_total) / v_item.received_qty;
        ELSE
            v_item_landed_share := 0.0000;
        END IF;

        v_effective_unit_cost := v_item.unit_purchase_price + v_item_landed_share;

        -- احتساب متوسط التكلفة المتحرك الجديد (Moving Average Cost Formula)
        IF (v_inv.physical_qty + v_item.received_qty) > 0 THEN
            v_new_mac := (
                (v_inv.physical_qty * v_inv.moving_average_cost) + (v_item.received_qty * v_effective_unit_cost)
            ) / (v_inv.physical_qty + v_item.received_qty);
        ELSE
            v_new_mac := v_effective_unit_cost;
        END IF;

        -- تحديث الرصيد الفيزيائي ومتوسط التكلفة في بطاقة الصنف
        UPDATE public.mken_inventory_items
        SET physical_qty = physical_qty + v_item.received_qty,
            moving_average_cost = ROUND(v_new_mac, 4),
            updated_at = NOW()
        WHERE id = v_item.item_id;

        -- تحديث الكمية المستلمة في أمر الشراء
        UPDATE public.mken_purchase_order_items
        SET received_qty = received_qty + v_item.received_qty
        WHERE id = v_item.po_item_id;

        -- تسجيل حركة الدخول في دفتر المخزون
        INSERT INTO public.mken_inventory_ledger (
            tenant_slug, item_id, movement_type, qty_change,
            physical_after, reserved_after, unit_cost, total_cost_impact,
            reference_type, reference_id, notes
        ) VALUES (
            p_tenant_slug, v_item.item_id, 'PURCHASE_RECEIPT', v_item.received_qty,
            v_inv.physical_qty + v_item.received_qty, v_inv.reserved_qty,
            v_effective_unit_cost, (v_effective_unit_cost * v_item.received_qty),
            'goods_receipt', v_grn.grn_number, format('استلام مشتريات مع تكلفة إنزال مضافة: %s ريال/وحدة', v_item_landed_share)
        );

        v_processed_count := v_processed_count + 1;
    END LOOP;

    -- فحص اكتمال استلام أمر الشراء وتحديث حالته
    UPDATE public.mken_purchase_orders
    SET status = CASE 
            WHEN (SELECT COUNT(*) FROM public.mken_purchase_order_items WHERE purchase_order_id = v_grn.purchase_order_id AND received_qty < ordered_qty) = 0 THEN 'received'
            ELSE 'partially_received'
        END,
        updated_at = NOW()
    WHERE id = v_grn.purchase_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'grn_id', p_grn_id,
        'processed_items', v_processed_count,
        'total_landed_costs_distributed', v_landed_total
    );
END;
$$;

-- =============================================================================
-- 8. الرؤى التحليلية والتقارير المنفصلة (OLAP Analytics & Financial Views)
-- =============================================================================

-- 1. تقرير المبيعات وهوامش الأرباح وتكلفة البضاعة المباعة (Sales, COGS & Margins)
CREATE OR REPLACE VIEW public.mken_v_sales_cogs_margins AS
SELECT 
    oi.tenant_slug,
    oi.inventory_item_id,
    oi.item_name,
    COUNT(DISTINCT oi.order_id) AS orders_count,
    SUM(oi.quantity) AS total_sold_qty,
    SUM(oi.total_sale_price) AS gross_sales_revenue,
    SUM(oi.total_cost_amount) AS total_cogs,
    SUM(oi.gross_margin_amount) AS total_gross_profit,
    CASE 
        WHEN SUM(oi.total_sale_price) > 0 
        THEN ROUND((SUM(oi.gross_margin_amount) / SUM(oi.total_sale_price) * 100)::NUMERIC, 2)
        ELSE 0.00 
    END AS gross_margin_percentage,
    MIN(oi.created_at) AS first_sale_date,
    MAX(oi.created_at) AS last_sale_date
FROM public.mken_order_items oi
GROUP BY oi.tenant_slug, oi.inventory_item_id, oi.item_name;

-- 2. تقرير تقييم المخزون المالي والأصناف الراكدة (Inventory Valuation & Aging)
CREATE OR REPLACE VIEW public.mken_v_inventory_valuation_aging AS
SELECT 
    i.tenant_slug,
    i.id AS item_id,
    i.sku,
    i.name,
    i.category,
    i.physical_qty,
    i.reserved_qty,
    (i.physical_qty - (i.reserved_qty + i.allocated_qty)) AS atp_qty,
    i.moving_average_cost,
    i.sell_price,
    ROUND((i.physical_qty * i.moving_average_cost)::NUMERIC, 2) AS total_cost_valuation,
    ROUND((i.physical_qty * i.sell_price)::NUMERIC, 2) AS potential_retail_valuation,
    i.reorder_point,
    CASE 
        WHEN (i.physical_qty - (i.reserved_qty + i.allocated_qty)) <= i.reorder_point THEN TRUE 
        ELSE FALSE 
    END AS is_low_stock,
    COALESCE(MAX(l.created_at), i.created_at) AS last_movement_date,
    EXTRACT(DAY FROM (NOW() - COALESCE(MAX(l.created_at), i.created_at)))::INT AS days_since_last_movement,
    CASE 
        WHEN EXTRACT(DAY FROM (NOW() - COALESCE(MAX(l.created_at), i.created_at))) > 90 THEN 'STAGNANT_CRITICAL'
        WHEN EXTRACT(DAY FROM (NOW() - COALESCE(MAX(l.created_at), i.created_at))) > 45 THEN 'SLOW_MOVING'
        ELSE 'HEALTHY'
    END AS stock_health_status
FROM public.mken_inventory_items i
LEFT JOIN public.mken_inventory_ledger l ON i.id = l.item_id AND l.movement_type = 'SALE_DEDUCTION'
GROUP BY i.tenant_slug, i.id, i.sku, i.name, i.category, i.physical_qty, i.reserved_qty, i.allocated_qty, i.moving_average_cost, i.sell_price, i.reorder_point, i.created_at;

-- 3. تقرير إقرار ضريبة ZATCA ومطابقة المدخلات والمخرجات (VAT Return Reconciliation)
CREATE OR REPLACE VIEW public.mken_v_zatca_vat_reconciliation AS
WITH sales_tax AS (
    SELECT 
        tenant_slug,
        DATE_TRUNC('month', created_at) AS tax_period,
        SUM(subtotal) AS sales_taxable_amount,
        SUM(tax_amount) AS output_vat_15
    FROM public.mken_checkout_sessions
    WHERE status = 'paid'
    GROUP BY tenant_slug, DATE_TRUNC('month', created_at)
),
purchases_tax AS (
    SELECT 
        tenant_slug,
        DATE_TRUNC('month', created_at) AS tax_period,
        SUM(subtotal) AS purchases_taxable_amount,
        SUM(tax_amount) AS input_vat_15
    FROM public.mken_purchase_orders
    WHERE status IN ('received', 'billed')
    GROUP BY tenant_slug, DATE_TRUNC('month', created_at)
)
SELECT 
    COALESCE(s.tenant_slug, p.tenant_slug) AS tenant_slug,
    COALESCE(s.tax_period, p.tax_period) AS tax_period,
    COALESCE(s.sales_taxable_amount, 0.00) AS total_sales_excl_vat,
    COALESCE(s.output_vat_15, 0.00) AS output_vat_collected,
    COALESCE(p.purchases_taxable_amount, 0.00) AS total_purchases_excl_vat,
    COALESCE(p.input_vat_15, 0.00) AS input_vat_deductible,
    ROUND((COALESCE(s.output_vat_15, 0.00) - COALESCE(p.input_vat_15, 0.00))::NUMERIC, 2) AS net_vat_payable_to_zatca
FROM sales_tax s
FULL OUTER JOIN purchases_tax p 
    ON s.tenant_slug = p.tenant_slug AND s.tax_period = p.tax_period;

-- =============================================================================
-- 9. أمن البيانات وعزل المستأجرين (Multi-Tenant Row Level Security)
-- =============================================================================
ALTER TABLE public.mken_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_landed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY inv_items_tenant_iso ON public.mken_inventory_items
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY inv_resv_tenant_iso ON public.mken_inventory_reservations
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY inv_ledger_tenant_iso ON public.mken_inventory_ledger
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY suppliers_tenant_iso ON public.mken_suppliers
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY po_tenant_iso ON public.mken_purchase_orders
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY po_items_tenant_iso ON public.mken_purchase_order_items
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY grn_tenant_iso ON public.mken_goods_receipt_notes
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY grn_items_tenant_iso ON public.mken_goods_receipt_items
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY landed_costs_tenant_iso ON public.mken_landed_costs
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');

CREATE POLICY order_items_tenant_iso ON public.mken_order_items
FOR ALL USING (tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default') OR current_setting('request.jwt.claim.role', true) = 'service_role');
