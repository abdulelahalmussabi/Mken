-- =============================================================================
-- منصة مكّن (mken.live) — موديول E4.2: محرك الضرائب والعملات الخليجية (GCC Multi-Currency)
-- متوافق مع: SAMA (أسعار الصرف المربوطة), ZATCA المادة 53 (المكافئ بالريال السعودي),
-- والاتفاقية الموحدة لضريبة القيمة المضافة لدول مجلس التعاون (Place of Supply & RCM)
-- =============================================================================

-- 1. ترقية جدول جلسات الشراء mken_checkout_sessions لدعم الخانات العشرية الثلاث وأسعار SAMA
DO $$ BEGIN
    IF to_regclass('public.mken_checkout_sessions') IS NOT NULL THEN
        -- تعديل دقة المبالغ لدعم الدينار الكويتي/البحريني والريال العماني (3 خانات عشرية)
        ALTER TABLE public.mken_checkout_sessions ALTER COLUMN subtotal TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_checkout_sessions ALTER COLUMN tax_amount TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_checkout_sessions ALTER COLUMN shipping_cost TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_checkout_sessions ALTER COLUMN total_amount TYPE NUMERIC(14, 3);

        -- إضافة حقول الامتثال الضريبي الإقليمي والمكافئ السعودي
        ALTER TABLE public.mken_checkout_sessions ADD COLUMN IF NOT EXISTS customer_country VARCHAR(2) DEFAULT 'SA';
        ALTER TABLE public.mken_checkout_sessions ADD COLUMN IF NOT EXISTS currency_rate NUMERIC(12, 6) DEFAULT 1.000000;
        ALTER TABLE public.mken_checkout_sessions ADD COLUMN IF NOT EXISTS sar_total NUMERIC(14, 2);
        ALTER TABLE public.mken_checkout_sessions ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) DEFAULT 15.00;
        ALTER TABLE public.mken_checkout_sessions ADD COLUMN IF NOT EXISTS is_reverse_charge BOOLEAN DEFAULT FALSE;
        ALTER TABLE public.mken_checkout_sessions ADD COLUMN IF NOT EXISTS customer_gcc_trn TEXT;
        ALTER TABLE public.mken_checkout_sessions ADD COLUMN IF NOT EXISTS tax_exemption_reason TEXT;
    END IF;
END $$;

-- 2. ترقية جدول الطلبات mken_orders لدعم العملات الخليجية
DO $$ BEGIN
    IF to_regclass('public.mken_orders') IS NOT NULL THEN
        ALTER TABLE public.mken_orders ALTER COLUMN subtotal TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_orders ALTER COLUMN tax_amount TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_orders ALTER COLUMN shipping_cost TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_orders ALTER COLUMN total_amount TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_orders ALTER COLUMN payment_amount TYPE NUMERIC(14, 3);

        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'SAR';
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS customer_country VARCHAR(2) DEFAULT 'SA';
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS currency_rate NUMERIC(12, 6) DEFAULT 1.000000;
        ALTER TABLE public.mken_orders ADD COLUMN IF NOT EXISTS sar_total NUMERIC(14, 2);
    END IF;
END $$;

-- 3. ترقية جدول الفواتير mken_invoices لدعم المادة 53 من لائحة ZATCA
DO $$ BEGIN
    IF to_regclass('public.mken_invoices') IS NOT NULL THEN
        ALTER TABLE public.mken_invoices ALTER COLUMN subtotal TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_invoices ALTER COLUMN tax_amount TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_invoices ALTER COLUMN total_amount TYPE NUMERIC(14, 3);
        ALTER TABLE public.mken_invoices ALTER COLUMN discount TYPE NUMERIC(14, 3);

        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'SAR';
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS currency_rate NUMERIC(12, 6) DEFAULT 1.000000;
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS sar_tax_amount NUMERIC(14, 2);
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS sar_total_amount NUMERIC(14, 2);
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS tax_category VARCHAR(10) DEFAULT 'S';
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS tax_exemption_reason TEXT;
    END IF;
END $$;
