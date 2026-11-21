-- =============================================================================
-- منصة مكّن (mken.live) — نظام ربط الطابور بنقاط البيع (POS-Queue Integration Schema)
-- المرحلة الأولى: القاعدة والربط الذري (Base & Atomic Link Engine)
-- متوافق مع: ZATCA Phase 2, SAMA Payment Rules, PDPL Data Privacy, Multi-Tenancy
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. جدول ربط تذاكر الطابور بطلبات وفواتير نقاط البيع (queue_ticket_pos_link)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.queue_ticket_pos_link (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug          VARCHAR(100) NOT NULL DEFAULT 'default',
    branch_id            VARCHAR(100) NOT NULL DEFAULT 'default',
    
    -- مرجع الطابور الحي
    ticket_id            TEXT NOT NULL,
    ticket_number        VARCHAR(30) NOT NULL,
    ticket_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    queue_id             TEXT NOT NULL,                        -- C: مشروبات, F: مطبخ, T: طاولات, D: استلام توصيل, K: كشك سريع
    
    -- مرجع الطلب وجلسة الدفع
    order_id             UUID REFERENCES public.mken_orders(id) ON DELETE SET NULL,
    checkout_session_id  UUID REFERENCES public.mken_checkout_sessions(id) ON DELETE SET NULL,
    
    -- ملخص الطلب والبنود (JSONB Snapshot للعرض الفوري في شاشات الكاونتر)
    order_summary        JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_amount         NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency             VARCHAR(3) NOT NULL DEFAULT 'SAR',
    
    -- حالة الربط ودورة الحياة
    link_status          VARCHAR(30) NOT NULL DEFAULT 'active',
    -- الحالات: active, serving, served, invoiced, paid, cancelled
    
    -- التوقيتات الدقيقة لدورة الخدمة
    ordered_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ticket_issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    called_at            TIMESTAMPTZ,
    service_started_at   TIMESTAMPTZ,
    service_ended_at     TIMESTAMPTZ,
    invoiced_at          TIMESTAMPTZ,
    paid_at              TIMESTAMPTZ,
    
    -- المشغل والكاونتر المسؤول
    served_by_user_id    UUID,
    served_by_counter_id UUID,
    
    -- بيانات الفاتورة الضريبية ZATCA
    zatca_qr_code        TEXT,
    invoice_ref          TEXT,
    
    -- قناة الطلب وبرنامج الولاء
    order_channel        VARCHAR(30) NOT NULL DEFAULT 'pos',  -- pos, kiosk, whatsapp, web, qr_table
    loyalty_points_earned    INT DEFAULT 0,
    loyalty_points_redeemed  INT DEFAULT 0,
    loyalty_transaction_id   UUID,
    
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_ticket_pos_link_branch UNIQUE (tenant_slug, branch_id, ticket_date, ticket_number)
);

-- فهارس الأداء العالي
CREATE INDEX IF NOT EXISTS idx_qtpl_tenant_date ON public.queue_ticket_pos_link(tenant_slug, ticket_date);
CREATE INDEX IF NOT EXISTS idx_qtpl_order ON public.queue_ticket_pos_link(order_id);
CREATE INDEX IF NOT EXISTS idx_qtpl_ticket ON public.queue_ticket_pos_link(ticket_id);
CREATE INDEX IF NOT EXISTS idx_qtpl_status ON public.queue_ticket_pos_link(tenant_slug, link_status);
CREATE INDEX IF NOT EXISTS idx_qtpl_channel ON public.queue_ticket_pos_link(tenant_slug, order_channel);

-- =============================================================================
-- 2. ترقية الجداول القائمة لدعم الربط المتبادل
-- =============================================================================

-- ترقية جدول queue_runtime_tickets
DO $$ BEGIN
    IF to_regclass('public.queue_runtime_tickets') IS NOT NULL THEN
        ALTER TABLE public.queue_runtime_tickets
            ADD COLUMN IF NOT EXISTS pos_link_id UUID,
            ADD COLUMN IF NOT EXISTS order_summary JSONB DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS order_channel VARCHAR(30) DEFAULT 'pos';
    END IF;
END $$;

-- ترقية جدول mken_orders
DO $$ BEGIN
    IF to_regclass('public.mken_orders') IS NOT NULL THEN
        ALTER TABLE public.mken_orders
            ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(30),
            ADD COLUMN IF NOT EXISTS ticket_id TEXT,
            ADD COLUMN IF NOT EXISTS queue_id TEXT,
            ADD COLUMN IF NOT EXISTS branch_id VARCHAR(100) DEFAULT 'default',
            ADD COLUMN IF NOT EXISTS table_number VARCHAR(20),
            ADD COLUMN IF NOT EXISTS service_type VARCHAR(30) DEFAULT 'takeaway',
            ADD COLUMN IF NOT EXISTS order_channel VARCHAR(30) DEFAULT 'pos';
    END IF;
END $$;

-- =============================================================================
-- 3. سياسات الأمان وعزل المستأجرين (RLS)
-- =============================================================================
ALTER TABLE public.queue_ticket_pos_link ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS qtpl_admin_reception_policy ON public.queue_ticket_pos_link;
  CREATE POLICY qtpl_admin_reception_policy ON public.queue_ticket_pos_link
  FOR ALL TO authenticated
  USING (
      EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() 
            AND users.tenant_slug = queue_ticket_pos_link.tenant_slug 
            AND users.role IN ('admin', 'receptionist')
      )
  );
EXCEPTION WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS qtpl_counter_select_policy ON public.queue_ticket_pos_link;
  CREATE POLICY qtpl_counter_select_policy ON public.queue_ticket_pos_link
  FOR SELECT TO authenticated
  USING (
      served_by_user_id = auth.uid()
      OR EXISTS (
          SELECT 1 FROM public.users u
          JOIN public.counters c ON c.current_user_id = u.id
          WHERE u.id = auth.uid()
            AND c.id = queue_ticket_pos_link.served_by_counter_id
      )
  );
EXCEPTION WHEN undefined_table THEN null;
END $$;

-- =============================================================================
-- 4. محرك تحديد مسار الطابور التلقائي (resolve_queue_id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.resolve_queue_id(
    p_items       JSONB,
    p_service_type TEXT DEFAULT 'takeaway'
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_has_food   BOOLEAN := FALSE;
    v_has_drinks BOOLEAN := FALSE;
    v_item       JSONB;
    v_cat        TEXT;
BEGIN
    IF p_service_type = 'delivery_pickup' THEN
        RETURN 'D'; -- استلام شركات التوصيل
    ELSIF p_service_type = 'dine_in' THEN
        RETURN 'T'; -- خدمة الطاولات والجلوس
    END IF;

    IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_cat := LOWER(COALESCE(v_item->>'category', v_item->>'type', ''));
            IF v_cat IN ('food', 'meal', 'kitchen', 'bakery', 'sweets', 'طعام', 'وجبات', 'مطبخ') THEN
                v_has_food := TRUE;
            ELSIF v_cat IN ('drink', 'drinks', 'coffee', 'beverage', 'مشروبات', 'قهوة', 'عصائر') THEN
                v_has_drinks := TRUE;
            END IF;
        END LOOP;
    END IF;

    IF v_has_food THEN
        RETURN 'F'; -- مطبخ / طعام
    ELSIF v_has_drinks THEN
        RETURN 'C'; -- مشروبات وكافيه
    ELSE
        RETURN 'K'; -- كشك / خدمة سريعة عامة
    END IF;
END;
$$;

-- =============================================================================
-- 5. الإجراء المخزن الذري لإنشاء الطلب والتذكرة وربطهما (pos_create_order_and_ticket)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.pos_create_order_and_ticket(
    p_tenant        TEXT,
    p_branch        TEXT DEFAULT 'default',
    p_items         JSONB DEFAULT '[]'::jsonb,
    p_customer_name TEXT DEFAULT 'عميل مكّن',
    p_phone         TEXT DEFAULT NULL,
    p_service_type  TEXT DEFAULT 'takeaway',
    p_table_number  TEXT DEFAULT NULL,
    p_queue_id      TEXT DEFAULT NULL,
    p_notes         TEXT DEFAULT NULL,
    p_channel       TEXT DEFAULT 'pos'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id      UUID := gen_random_uuid();
    v_ticket_id     TEXT;
    v_ticket_num    VARCHAR(30);
    v_seq           INT;
    v_total         NUMERIC(14, 2) := 0.00;
    v_subtotal      NUMERIC(14, 2) := 0.00;
    v_tax_amount    NUMERIC(14, 2) := 0.00;
    v_resolved_q    TEXT;
    v_prefix        VARCHAR(10);
    v_link_id       UUID;
    v_session_token UUID := gen_random_uuid();
    v_summary       JSONB := '[]'::jsonb;
    v_item          JSONB;
    v_item_price    NUMERIC(14, 2);
    v_item_qty      INT;
BEGIN
    -- 1. التحقق من المدخلات الأساسية
    IF p_tenant IS NULL OR TRIM(p_tenant) = '' THEN
        RAISE EXCEPTION 'Tenant slug is required.';
    END IF;

    -- 2. احتساب إجمالي الطلب ومطابقة البنود
    IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_item_qty := GREATEST(1, COALESCE((v_item->>'qty')::INT, (v_item->>'quantity')::INT, 1));
            v_item_price := GREATEST(0.00, COALESCE((v_item->>'price')::NUMERIC, (v_item->>'sell_price')::NUMERIC, 0.00));
            v_subtotal := v_subtotal + (v_item_price * v_item_qty);
        END LOOP;
        v_summary := p_items;
    END IF;

    -- ضريبة القيمة المضافة 15% (شاملة أو مضافة حسب طبيعة التسعير)
    v_total := v_subtotal;
    v_tax_amount := ROUND((v_total * 0.15 / 1.15), 2);

    -- 3. تحديد نوع الطابور إن لم يتم تمريره صراحة
    v_resolved_q := COALESCE(p_queue_id, public.resolve_queue_id(p_items, p_service_type));
    v_prefix := UPPER(LEFT(v_resolved_q, 1));

    -- 4. توليد الرقم التسلسلي اليومي مع قفل الصف لتجنب Race Condition
    SELECT COALESCE(MAX(
        CASE 
            WHEN ticket_number ~ '^[A-Z]-[0-9]+$' 
            THEN CAST(SPLIT_PART(ticket_number, '-', 2) AS INT)
            ELSE 0 
        END
    ), 0) + 1
    INTO v_seq
    FROM public.queue_runtime_tickets
    WHERE tenant_slug = p_tenant 
      AND branch_id = COALESCE(p_branch, 'default')
      AND ticket_date = CURRENT_DATE 
      AND queue_id = v_resolved_q
    FOR UPDATE;

    v_ticket_num := v_prefix || '-' || LPAD(v_seq::TEXT, 3, '0');
    v_ticket_id  := p_tenant || '-' || COALESCE(p_branch, 'default') || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || v_ticket_num;

    -- 5. إدراج الطلب في جدول mken_orders إن وجد
    IF to_regclass('public.mken_orders') IS NOT NULL THEN
        INSERT INTO public.mken_orders (
            id,
            tenant_slug,
            branch_id,
            customer_name,
            phone,
            items,
            status,
            payment_status,
            subtotal,
            tax_amount,
            total_amount,
            table_number,
            service_type,
            order_channel,
            ticket_number,
            ticket_id,
            queue_id,
            notes,
            created_at,
            updated_at
        ) VALUES (
            v_order_id,
            p_tenant,
            COALESCE(p_branch, 'default'),
            COALESCE(p_customer_name, 'عميل مكّن'),
            p_phone,
            v_summary,
            'pending',
            'pending_payment',
            v_subtotal,
            v_tax_amount,
            v_total,
            p_table_number,
            COALESCE(p_service_type, 'takeaway'),
            COALESCE(p_channel, 'pos'),
            v_ticket_num,
            v_ticket_id,
            v_resolved_q,
            p_notes,
            NOW(),
            NOW()
        );
    END IF;

    -- 6. إنشاء سجل الربط الرئيسي (queue_ticket_pos_link)
    INSERT INTO public.queue_ticket_pos_link (
        tenant_slug,
        branch_id,
        ticket_id,
        ticket_number,
        ticket_date,
        queue_id,
        order_id,
        order_summary,
        total_amount,
        link_status,
        order_channel
    ) VALUES (
        p_tenant,
        COALESCE(p_branch, 'default'),
        v_ticket_id,
        v_ticket_num,
        CURRENT_DATE,
        v_resolved_q,
        v_order_id,
        v_summary,
        v_total,
        'active',
        COALESCE(p_channel, 'pos')
    ) RETURNING id INTO v_link_id;

    -- 7. إدراج التذكرة في جدول queue_runtime_tickets
    IF to_regclass('public.queue_runtime_tickets') IS NOT NULL THEN
        INSERT INTO public.queue_runtime_tickets (
            id,
            tenant_slug,
            branch_id,
            ticket_date,
            ticket_number,
            queue_id,
            status,
            session_token,
            first_arrived_at,
            pos_link_id,
            order_summary,
            order_channel,
            payload
        ) VALUES (
            v_ticket_id,
            p_tenant,
            COALESCE(p_branch, 'default'),
            CURRENT_DATE,
            v_ticket_num,
            v_resolved_q,
            'waiting',
            v_session_token::TEXT,
            NOW(),
            v_link_id,
            v_summary,
            COALESCE(p_channel, 'pos'),
            jsonb_build_object(
                'ticket_number',   v_ticket_num,
                'queue_id',        v_resolved_q,
                'customer_name',   COALESCE(p_customer_name, 'عميل مكّن'),
                'phone',           p_phone,
                'items',           v_summary,
                'total',           v_total,
                'service_type',    COALESCE(p_service_type, 'takeaway'),
                'table_number',    p_table_number,
                'notes',           p_notes,
                'order_id',        v_order_id,
                'link_id',         v_link_id,
                'order_channel',   COALESCE(p_channel, 'pos'),
                'session_token',   v_session_token::TEXT
            )
        );
    END IF;

    -- 8. إرجاع النتيجة الكاملة المتوافقة
    RETURN jsonb_build_object(
        'success',        TRUE,
        'ticket_number',  v_ticket_num,
        'ticket_id',      v_ticket_id,
        'order_id',       v_order_id,
        'link_id',        v_link_id,
        'queue_id',       v_resolved_q,
        'total',          v_total,
        'order_summary',  v_summary,
        'session_token',  v_session_token::TEXT
    );
END;
$$;

-- =============================================================================
-- 6. إنهاء خدمة التذكرة وإصدار الفاتورة الضريبية ZATCA ذرياً (sp_finalize_ticket_payment)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sp_finalize_ticket_payment(
    p_tenant          TEXT,
    p_ticket_id       TEXT,
    p_payment_method  TEXT DEFAULT 'cash',
    p_payment_ref     TEXT DEFAULT NULL,
    p_zatca_qr        TEXT DEFAULT NULL,
    p_invoice_ref     TEXT DEFAULT NULL,
    p_paid_amount     NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_link       public.queue_ticket_pos_link%ROWTYPE;
    v_order_id   UUID;
    v_final_amt  NUMERIC(14, 2);
    v_inv_ref    TEXT;
BEGIN
    -- 1. استخراج وقفل سجل الربط
    SELECT * INTO v_link
    FROM public.queue_ticket_pos_link
    WHERE tenant_slug = p_tenant AND ticket_id = p_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue POS Link record not found for ticket: %', p_ticket_id;
    END IF;

    v_order_id  := v_link.order_id;
    v_final_amt := COALESCE(p_paid_amount, v_link.total_amount, 0.00);
    v_inv_ref   := COALESCE(p_invoice_ref, v_link.invoice_ref, 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || v_link.ticket_number);

    -- 2. إنهاء التذكرة الحية في queue_runtime_tickets
    IF to_regclass('public.queue_runtime_tickets') IS NOT NULL THEN
        UPDATE public.queue_runtime_tickets
        SET status = 'completed',
            updated_at = NOW(),
            payload = jsonb_set(
                jsonb_set(payload, '{status}', '"completed"'),
                '{payment_status}', '"paid"'
            )
        WHERE tenant_slug = p_tenant AND id = p_ticket_id;
    END IF;

    -- 3. تحديث سجل الربط (queue_ticket_pos_link)
    UPDATE public.queue_ticket_pos_link
    SET link_status = 'paid',
        service_ended_at = COALESCE(service_ended_at, NOW()),
        invoiced_at = COALESCE(invoiced_at, NOW()),
        paid_at = NOW(),
        zatca_qr_code = COALESCE(p_zatca_qr, zatca_qr_code),
        invoice_ref = v_inv_ref,
        total_amount = v_final_amt,
        updated_at = NOW()
    WHERE id = v_link.id;

    -- 4. تحديث الطلب في mken_orders
    IF v_order_id IS NOT NULL AND to_regclass('public.mken_orders') IS NOT NULL THEN
        UPDATE public.mken_orders
        SET status = 'paid',
            payment_status = 'paid',
            payment_amount = v_final_amt,
            zatca_qr_code = COALESCE(p_zatca_qr, zatca_qr_code),
            updated_at = NOW()
        WHERE id = v_order_id;
    END IF;

    RETURN jsonb_build_object(
        'success',        TRUE,
        'ticket_id',      p_ticket_id,
        'ticket_number',  v_link.ticket_number,
        'order_id',       v_order_id,
        'invoice_ref',    v_inv_ref,
        'paid_amount',    v_final_amt,
        'payment_method', p_payment_method,
        'zatca_qr_code',  COALESCE(p_zatca_qr, v_link.zatca_qr_code)
    );
END;
$$;

-- =============================================================================
-- 7. إجراء إخفاء الهوية لحماية البيانات الشخصية بعد انتهاء الصلاحية (PDPL Compliance)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.anonymize_old_queue_records(
    p_tenant TEXT,
    p_retention_days INT DEFAULT 30
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_affected INT := 0;
BEGIN
    UPDATE public.queue_ticket_pos_link
    SET order_summary = jsonb_set(
            jsonb_set(order_summary, '{customer_name}', '"***"'),
            '{phone}', '"***"'
        ),
        updated_at = NOW()
    WHERE tenant_slug = p_tenant
      AND ticket_date < (CURRENT_DATE - p_retention_days)
      AND link_status IN ('paid', 'served', 'cancelled');

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
END;
$$;
