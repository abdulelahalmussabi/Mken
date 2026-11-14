-- =============================================================================
-- منصة مكّن (mken.live) — موديول E3.1: سلة الشراء والدفع الإلكتروني الموثق
-- متوافق مع: SAMA, ZATCA (Fatoora Phase 2), PDPL (SDAIA), MoC E-Commerce Law
-- =============================================================================

-- 1. جدول جلسات الشراء الموحدة (Checkout Sessions)
CREATE TABLE IF NOT EXISTS public.mken_checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    customer_phone TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    shipping_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
    status VARCHAR(30) NOT NULL DEFAULT 'pending_payment', -- pending_payment, paid, failed, expired
    payment_id TEXT UNIQUE,
    payment_gateway VARCHAR(30) DEFAULT 'moyasar',
    payment_method VARCHAR(50),
    zatca_qr_code TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الأداء والحتمية
CREATE INDEX IF NOT EXISTS idx_mken_checkout_tenant_status ON public.mken_checkout_sessions(tenant_slug, status);
CREATE INDEX IF NOT EXISTS idx_mken_checkout_payment_id ON public.mken_checkout_sessions(payment_id);
CREATE INDEX IF NOT EXISTS idx_mken_checkout_created ON public.mken_checkout_sessions(created_at DESC);

-- 2. ترقية جدول mken_orders لإضافة حقول الفوترة والضريبة المعتمدة
DO $$ BEGIN
    IF to_regclass('public.mken_orders') IS NOT NULL THEN
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0.00;
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.00;
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12, 2) DEFAULT 0.00;
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0.00;
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS zatca_qr_code TEXT;
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS checkout_session_id UUID;
    END IF;
END $$;

-- 3. دالة حجز المخزون الذري وحساب الأسعار على السيرفر (Atomic Stock Reservation)
CREATE OR REPLACE FUNCTION public.mken_fn_create_checkout_session(
    p_tenant_slug TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_shipping_address JSONB,
    p_cart_items JSONB,
    p_shipping_cost NUMERIC DEFAULT 0.00,
    p_activity_id TEXT DEFAULT 'commerce'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_service_id TEXT;
    v_quantity INT;
    v_inv_record RECORD;
    v_subtotal NUMERIC(12, 2) := 0.00;
    v_tax_amount NUMERIC(12, 2) := 0.00;
    v_total_amount NUMERIC(12, 2) := 0.00;
    v_shipping NUMERIC(12, 2) := COALESCE(p_shipping_cost, 0.00);
    v_session_id UUID;
    v_resolved_items JSONB := '[]'::jsonb;
    v_item_price NUMERIC(12, 2);
    v_item_name TEXT;
BEGIN
    -- معالجة وقفل عناصر السلة
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
        v_service_id := v_item->>'serviceId';
        v_quantity := GREATEST(1, COALESCE((v_item->>'quantity')::INT, 1));

        -- محاولة جلب الصنف من المخزون مع قفل السجل FOR UPDATE
        SELECT id, name, sell_price, quantity
        INTO v_inv_record
        FROM public.mken_inventory_items
        WHERE id = v_service_id AND tenant_slug = p_tenant_slug
        FOR UPDATE;

        IF FOUND THEN
            -- الصنف مسجل في المخزون
            IF v_inv_record.quantity < v_quantity THEN
                RAISE EXCEPTION 'الكمية المطلوبة غير متوفرة في المخزن للمنتج % (المتبقي: %)', v_inv_record.name, v_inv_record.quantity;
            END IF;

            v_item_price := COALESCE(v_inv_record.sell_price, 0.00);
            v_item_name := v_inv_record.name;

            -- خصم مؤقت للمخزون
            UPDATE public.mken_inventory_items
            SET quantity = quantity - v_quantity,
                updated_at = NOW()
            WHERE id = v_service_id AND tenant_slug = p_tenant_slug;
        ELSE
            -- إذا لم يكن في مخزون المستودع، نعتمد سعر الصنف القادم من الكتالوج بعد التحقق من إيجابيته
            v_item_price := GREATEST(0.00, COALESCE((v_item->>'unitPrice')::NUMERIC, (v_item->>'price')::NUMERIC, 0.00));
            v_item_name := COALESCE(v_item->>'serviceTitle', v_item->>'name', 'منتج / خدمة');
        END IF;

        v_subtotal := v_subtotal + (v_item_price * v_quantity);
        v_resolved_items := v_resolved_items || jsonb_build_object(
            'serviceId', v_service_id,
            'serviceTitle', v_item_name,
            'name', v_item_name,
            'quantity', v_quantity,
            'unitPrice', v_item_price,
            'lineTotal', (v_item_price * v_quantity)
        );
    END LOOP;

    -- حساب ضريبة القيمة المضافة 15% المعتمدة من هيئة الزكاة والضريبة والجمارك
    v_tax_amount := ROUND((v_subtotal * 0.15)::NUMERIC, 2);
    v_total_amount := v_subtotal + v_tax_amount + v_shipping;

    -- إنشاء سجل جلسة الدفع
    INSERT INTO public.mken_checkout_sessions (
        tenant_slug,
        customer_name,
        customer_phone,
        shipping_address,
        items,
        subtotal,
        tax_amount,
        shipping_cost,
        total_amount,
        status,
        expires_at
    ) VALUES (
        p_tenant_slug,
        p_customer_name,
        p_customer_phone,
        p_shipping_address,
        v_resolved_items,
        v_subtotal,
        v_tax_amount,
        v_shipping,
        v_total_amount,
        'pending_payment',
        NOW() + INTERVAL '15 minutes'
    ) RETURNING id INTO v_session_id;

    -- إدراج نسخة أولية في جدول الطلبات بحالة غير مدفوع
    INSERT INTO public.mken_orders (
        id,
        tenant_slug,
        activity_id,
        activity_title,
        items,
        customer_name,
        phone,
        district,
        location_address,
        notes,
        status,
        payment_status,
        payment_amount,
        subtotal,
        tax_amount,
        shipping_cost,
        total_amount,
        checkout_session_id,
        created_at,
        updated_at
    ) VALUES (
        'ord_' || SUBSTRING(v_session_id::text, 1, 8),
        p_tenant_slug,
        p_activity_id,
        'متجر المنتجات',
        v_resolved_items,
        p_customer_name,
        p_customer_phone,
        p_shipping_address->>'district',
        p_shipping_address->>'address',
        p_shipping_address->>'notes',
        'pending',
        'unpaid',
        v_total_amount,
        v_subtotal,
        v_tax_amount,
        v_shipping,
        v_total_amount,
        v_session_id,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'sessionId', v_session_id,
        'orderId', 'ord_' || SUBSTRING(v_session_id::text, 1, 8),
        'subtotal', v_subtotal,
        'taxAmount', v_tax_amount,
        'shippingCost', v_shipping,
        'totalAmount', v_total_amount,
        'totalHalalas', ROUND(v_total_amount * 100),
        'currency', 'SAR',
        'expiresAt', NOW() + INTERVAL '15 minutes'
    );
END;
$$;

-- 4. سياسات الأمان RLS لجلسات الشراء
ALTER TABLE public.mken_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_checkout_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_sessions_tenant_isolation ON public.mken_checkout_sessions;
CREATE POLICY checkout_sessions_tenant_isolation ON public.mken_checkout_sessions
FOR ALL USING (
    tenant_slug = COALESCE(current_setting('app.current_tenant', true), 'default')
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
);
