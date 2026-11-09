# 📑 دراسة معمارية واستشارية شاملة: محرك توليد الإعلانات المؤتمت بالذكاء الاصطناعي (AI Ad Generation Engine)

* **الجهة:** الفريق الاستشاري المعماري لمنصة «مكِّن» (Mken Multi-Tenant SaaS)
* **المرجع المعماري:** `MKN-ARCH-AI-ADV-2026-v1`
* **تاريخ الإصدار:** سبتمبر 2026
* **نطاق التطبيق:** 21+ قطاعاً تشغيلياً عبر الأنماط الأربعة (`appointment-based`, `field-service`, `project-based`, `order-based`)

---

## 🎯 1. الموجز التنفيذي (Executive Summary)

تستهدف هذه الوثيقة المعمارية تأسيس محرك توليد الحملات الإعلانية والمحتوى التسويقي المؤتمت داخل منصة **مكِّن** بالاعتماد على بنية هجينة غير متزامنة تجمع بين:
1. **Supabase:** إدارة قواعد البيانات، العزل التام للمستأجرين عبر سياسات أمان الصفوف (`Row Level Security - RLS`)، وخطافات الويب للأحداث (`Database Webhooks`).
2. **محرك الأتمتة n8n Enterprise Cluster:** إدارة سير العمل، الجدولة الزمنية، وتوجيه المهام غير المتزامنة مع طوابير الرسائل.
3. **Gemini 1.5 / 2.0 Flash API:** النمذجة اللغوية والتوليد الإبداعي الموطّن سياقياً باللهجات السعودية ومحددات الهوية.
4. **محرك التصاميم البصرية الفيكتور (Dynamic SVG / Canvas Engine):** دمج النصوص مع ألوان وشعار المتجر وتوليد بنرات إعلانية جاهزة برمجياً بدقة قياسية.

### 💡 الأهداف الاستراتيجية:
* **ضمان استقلالية وأمن بيانات المتاجر** والامتثال الكامل لـ **نظام حماية البيانات الشخصية السعودي (PDPL)** وضوابط **الهيئة السعودية للبيانات والذكاء الاصطناعي (SDAIA)**.
* **رفع كفاءة إعادة الاستهداف** للمنشآت والمتاجر بنسبة تتجاوز **40%** دون تدخل بشري يدوي.
* **أتمتة دورة استعادة السلات والمواعيد المتروكة** خلال أقل من 15 دقيقة عبر واتساب.

---

## 🏗️ 2. المخطط المعماري الشامل وتدفق البيانات (Architectural Topology & Data Flow)

يعتمد المحرك على نمط **البنية الموجهة بالأحداث (Event-Driven Architecture)** ونموذج التوسع متعدد المستأجرين (**Multi-Tenant Architecture**)، حيث تنفصل واجهة الإدارة عن محرك المعالجة الخلفي لضمان سرعة الاستجابة ومنع تجميد واجهة المستخدم (Non-blocking I/O).

```mermaid
flowchart TB
    subgraph UI["طبقة واجهة التاجر (Next.js / Mken UI)"]
        A["لوحة تحكم التاجر / حدث مجدول (Event Trigger)"]
    end

    subgraph SupabaseLayer["طبقة البيانات والأمان (Supabase)"]
        B1["التحقق من الصلاحيات والاشتراك\n(RLS + Tenant Context)"]
        B2[("جدول ad_generation_jobs\n(حالة PENDING)")]
        B3["Supabase Database Webhook\n(POST Webhook + HMAC Signature)"]
        B1 --> B2 --> B3
    end

    subgraph n8nLayer["محرك الأتمتة والتكامل (n8n Enterprise Cluster)"]
        C1["التحقق من HMAC Signature وعزل tenant_id"]
        C2["استرجاع محددات الهوية من tenant_brand_profiles\n(Tone, Colors, Slogan)"]
        C3["تجهيز السياق اللغوي للهجة المستهدفة\n(نجدية، حجازية، شرقية، فصحى)"]
        C1 --> C2 --> C3
    end

    subgraph Engines["محركات الذكاء والتصميم"]
        D1["Google Gemini 1.5 Flash API\n(توليد النصوص، رسائل الواتساب، والـ CTA)"]
        D2["محرك التصاميم الديناميكي\n(Dynamic SVG / Imagen 3 Engine)"]
    end

    subgraph StorageLayer["التخزين والاعتماد (Storage & Distribution)"]
        E1[("Supabase Storage\n(campaign-assets)")]
        E2[("جدول marketing_campaigns\n(READY_FOR_APPROVAL / ACTIVE)")]
        E3["إشعار التاجر (Push / Dashboard)"]
        E4["إرسال المعاينة والإطلاق (Meta WhatsApp API)"]
    end

    A -->|(1) طلب توليد / حدث| B1
    B3 -->|(2) Webhook Payload| C1
    C3 -->|(3) هندسة الأوامر| D1
    C3 -->|(4) ألوان وشعار المتجر| D2
    D1 -->|(5) دمج المحتوى| E2
    D2 -->|(5) حفظ البنر| E1
    E1 --> E2
    E2 --> E3
    E2 --> E4
```

---

## 🗄️ 3. نمذجة البيانات وسياسات الأمان (Supabase Schema & Multi-Tenant Isolation)

لحماية بيانات التجار وعزلها عزلاً باتاً طبقاً لمعايير **SDAIA** ونظام **PDPL**، تُطبَّق سياسات أمان الصفوف (`Row Level Security - RLS`) استناداً إلى `tenant_id` المضمّن في رمز الـ JWT للتاجر.

### 3.1 مواصفات الـ DDL (Data Definition Language)

```sql
-- 1. جدول ملف الهوية التسويقية للنشاط التجاري (Brand Profiles)
CREATE TABLE IF NOT EXISTS public.tenant_brand_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.mken_saas_clients(id) ON DELETE CASCADE,
    sector_type VARCHAR(50) NOT NULL, -- e.g., 'SALON', 'CLINIC', 'FIELD_SERVICE', 'RESTAURANT', 'COMMERCE'
    brand_voice VARCHAR(50) DEFAULT 'WARM_LOCAL', -- 'WARM_LOCAL', 'PREMIUM_LUXURY', 'DIRECT_OFFER', 'CORPORATE'
    preferred_dialects TEXT[] DEFAULT ARRAY['SAUDI_GENERAL', 'SAUDI_NAJDI'],
    brand_colors JSONB DEFAULT '{"primary": "#0F172A", "secondary": "#10B981", "accent": "#F59E0B"}'::jsonb,
    logo_url TEXT,
    slogan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_brand UNIQUE (tenant_id)
);

-- 2. جدول وظائف توليد الإعلانات وحالات المعالجة (Ad Generation Jobs)
CREATE TABLE IF NOT EXISTS public.ad_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.mken_saas_clients(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50) NOT NULL, -- 'ABANDONED_CART', 'DORMANT_RETENTION', 'MANUAL_PROMO', 'SEASONAL_OFFER'
    target_audience_segment JSONB, -- المعايير المستهدفة (مثال: عملاء لم يحجزوا منذ 45 يوماً)
    channel_targets TEXT[] DEFAULT ARRAY['WHATSAPP', 'INSTAGRAM_STORY'],
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول الحملات التسويقية الناتجة (Generated Marketing Campaigns)
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.mken_saas_clients(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.ad_generation_jobs(id) ON DELETE SET NULL,
    campaign_title VARCHAR(255) NOT NULL,
    copy_variations JSONB NOT NULL, -- نصوص الإعلانات المولدة (WhatsApp text, Short SMS, Social caption)
    asset_urls JSONB, -- روابط التصاميم والصور المولدة
    discount_code VARCHAR(100),
    approval_status VARCHAR(30) DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'DISMISSED'
    sent_at TIMESTAMPTZ,
    analytics JSONB DEFAULT '{"sent": 0, "clicks": 0, "conversions": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- تفعيل سياسات الأمان RLS
ALTER TABLE public.tenant_brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- سياسات عزل المستأجر RLS
CREATE POLICY tenant_isolation_brand_profiles ON public.tenant_brand_profiles
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_ad_jobs ON public.ad_generation_jobs
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY tenant_isolation_campaigns ON public.marketing_campaigns
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

---

## ⚡ 4. هندسة محرك الأتمتة n8n (Orchestration & Workflow Logic)

يعمل سير العمل داخل **n8n** كموجّه ذكي للمهام (Task Orchestrator) عبر تسلسل العقد التالي:
1. **Webhook Receiver (Authentication Node):**
   * استقبال حدث التوليد من Supabase عبر `POST /webhook/mken-ad-engine`.
   * فحص رأس التفويض `X-Mken-HMAC-Token` لمنع الطلبات غير الموثوقة.
2. **Context Enrichment Node (Supabase Integration):**
   * استخراج سجل الهوية `tenant_brand_profiles`.
   * استخراج بيانات العرض المطلوب (نوع الخدمة، نسبة الخصم، كود الخصم، رابط الشراء المباشر عبر النطاق الفرعي `*.mken.sa`).
   * تجميع سياق التوطين الثقافي واللغوي بناءً على تصنيف النشاط (مثل: مصطلحات العناية بالبشرة لقطاع الصالونات والعيادات، أو مصطلحات الضمان وسرعة الوصول لقطاع الخدمات الميدانية).
3. **Gemini 1.5 Synthesis Node (AI Engine):**
   * إرسال موجه هندسي محكم (`System Prompt + Structured Output Schema`) يطلب إخراج النتائج بصيغة JSON صارمة دون مقدمات إنشائية.
4. **Visual Asset Generation / Template Rendering Node:**
   * دمج النصوص المولدة مع ألوان وشعار المتجر عبر واجهة تصميم مؤتمتة (Dynamic Graphics Engine) لإنتاج أبعاد إعلانية قياسية (1:1 للمنشورات، و 9:16 لقصص إنستغرام وحالات واتساب).
5. **Storage & Callback Node:**
   * رفع الصور الناتجة إلى Supabase Storage.
   * تحديث السجل في `marketing_campaigns`، وتحويل حالة وظيفة التوليد `ad_generation_jobs` إلى `COMPLETED`.
   * إطلاق تنبيه للتاجر عبر إشعار Push أو رسالة داخلية في لوحة التحكم.

---

## 📝 5. هندسة الأوامر ونموذج Gemini API الموطّن سياقياً (Prompt Engineering & Localization)

لضمان خروج الإعلانات بنبرة سعودية تسويقية أصيلة لكل قطاع، يُستخدم نموذج موجه نظامي (`System Prompt`) ديناميكي مدعوم بهيكلة صارمة:

### قالب موجه النظام (System Instruction Template):
```plaintext
أنت المحرك الإعلاني التسويقي لمنصة "مكِّن" في المملكة العربية السعودية.
مهمتك: صياغة محتوى إعلاني بيعي مباشر وجذاب لعملاء التاجر، متوافق مع الثقافة الاستهلاكية السعودية ونظام التجارة الإلكترونية.

محددات الهوية والنشاط:
- اسم التاجر: {{ $json.tenant_name }}
- القطاع التشغيلي: {{ $json.sector_type }}
- النبرة الإعلانية المطلوبة: {{ $json.brand_voice }}
- اللهجة المفضلة: {{ $json.preferred_dialect }}
- تفاصيل العرض: {{ $json.offer_details }}
- رمز الخصم: {{ $json.discount_code }}
- رابط التوجيه المباشر: https://{{ $json.subdomain }}.mken.sa

قواعد صارمة:
1. تجنب الكلمات المبتذلة أو المترجمة حرفياً من الإنجليزية.
2. استخدم مصطلحات محلية متناسبة مع القطاع (مثل: "دلعي نفسك / إطلالة العيد" للصالونات، "فنيين معتمدين / نوصلك وين ما كنت" للخدمات الميدانية).
3. ضمّن عبارة واضحة للحث على اتخاذ إجراء (Call to Action).
4. التزم بإخراج النتيجة بصيغة JSON حصراً وفق المخطط التالي:
{
  "whatsapp_message": "نص الرسالة التسويقية المناسبة للواتساب مع الرموز التعبيرية وروابط الحجز/الشراء",
  "social_caption": "نص المنشور لإنستغرام أو إكس شامل الهاشتاقات المناسبة",
  "short_sms": "نص موجز لا يتجاوز 140 حرفاً للحملات السريعة",
  "image_headline": "عنوان قصير جذاب يوضع داخل التصميم الإعلاني (أقل من 6 كلمات)",
  "image_subheadline": "نص توضيحي فرعي يوضع داخل التصميم"
}
```

---

## 📊 6. جدول الإنجازات وحالة العمل (Accomplishments & Work Status)

| الركيزة المعمارية / النمط التشغيلي | الإنجازات المكتملة (Completed) | المهام قيد التنفيذ (In-Progress) | المهام القادمة المجدولة (Upcoming) | مؤشر الحالة |
| :--- | :--- | :--- | :--- | :---: |
| **محرك الذكاء الاصطناعي (Gemini + n8n)** | تحديد معمارية التدفق وتوصيف واجهات REST ونموذج الأوامر المهيكل وبناء `/api/ai/marketing-generate.js`. | بناء تدفق n8n واختبار توليد نصوص العروض التلقائية عبر Gemini 1.5. | ربط محرك توليد الصور الديناميكي وحقن شعارات المستأجرين آلياً. | 🟢 **متقدم** |
| **بنية البيانات وتعدد المستأجرين (Supabase)** | بناء جداول `tenant_brand_profiles` وعزل البيانات بالكامل عبر RLS. | ربط Webhooks الخاصة بالأحداث المشغلة (مثل سلات الشراء المتروكة). | أرشفة مقاييس التفاعل ونسب التحويل لكل حملة إعلانية في لوحة التحكم. | 🟢 **متقدم** |
| **نمط الحجوزات (صالونات، عيادات، سبا)** | بناء جداول المواعيد وتقويم الفروع والموظفين الموحد وحساب `slotDuration`. | أتمتة رسائل إعادة استهداف العملاء المنقطعين لأكثر من 30 يوماً. | حملات مواسم الأعياد وتوزيع المواعيد تلقائياً عبر الواتساب. | 🟢 **مستقر** |
| **نمط الخدمات الميدانية (صيانة، تشغيل)** | نظام توجيه الفرق وإصدار أوامر العمل وتتبع الفنيين وتحديد المواقع. | صياغة قوالب العروض التسويقية لخدمات الصيانة الدورية والتكييف. | الربط مع التقييمات التلقائية لتحفيز طلبات الصيانة الوقائية. | 🟡 **قيد التطوير** |
| **نمط المشاريع والاستشارات** | جدولة الدفعات المرحلية وإصدار عروض الأسعار الرسمية وتوثيق العقود. | مواءمة نبرة التخاطب الرسمية (`Corporate B2B`) في محرك الإعلانات. | توليد بورتفوليو المشاريع المكتملة بصيغة حملات تسويقية للشركات. | 🟡 **قيد التطوير** |
| **نمط التجارة ونقاط البيع (مطاعم، تجزئة)** | نظام إدارة المخزون متعدد المستودعات وربط طابعات المطبخ والسلة السحابية. | تفعيل محرك عروض استعادة السلات المتروكة لحظياً عبر الواتساب. | التوصية الذكية للمنتجات (`Dynamic Upselling`) ضمن رسائل التذكير. | 🟢 **متقدم** |
| **الفوترة الإلكترونية (ZATCA Phase 2)** | إصدار الفواتير بالـ QR Code المشفر والمرحلة الأولى بنجاح. | اختبار التوقيع التشفيري (`CSID Onboarding` عبر `ECDSA secp256r1`) على بيئة الاختبار. | مطابقة حقول الخصومات والحملات الإعلانية في الفاتورة مع متطلبات الهيئة. | 🟡 **أولوية حرجة** |

---

## 🛡️ 7. التحديات والتنبيهات التقنية وسبل معالجتها (Risk & Engineering Alerts)

> [!CAUTION]
> **انحراف النبرة أو الهلوسة التسويقية (AI Hallucination & Tone Drift):**
> * **الخطر:** توليد أسعار خاطئة أو وعود ترويجية غير حقيقية أو لهجات غير مقبولة محلياً.
> * **خطة المعالجة:** إخضاع المخرجات لقاعدة "الاعتماد المسبق من التاجر" (`Merchant-in-the-loop`) قبل النشر، وتمرير قيود صارمة داخل الـ System Prompt تقصر النصوص على البيانات الممررة من قاعدة بيانات المتجر حصراً.

> [!WARNING]
> **إجهاد واجهات الذكاء الاصطناعي وحدود الطلبات (API Rate Limiting & Queue Bottlenecks):**
> * **الخطر:** في مواسم الذروة (عروض يوم التأسيس أو اليوم الوطني)، قد يؤدي إرسال آلاف طلبات التوليد المتزامنة إلى حظر الطلبات (`HTTP 429`).
> * **خطة المعالجة:** تشغيل n8n في نمط الطوابير (`Queue Mode`) مدعوماً بـ Redis لإدارة أولويات المعالجة وتنفيذ آليات إعادة المحاولة التدريجية (`Exponential Backoff`).

> [!CAUTION]
> **حظر أرقام الواتساب بسبب الرسائل التسويقية (Meta Spam Policy):**
> * **الخطر:** إرسال رسائل إعلانية متطابقة قد يؤدي لخفض تقييم جودة الرقم على Meta Cloud API وحظره.
> * **خطة المعالجة:** استخدام Gemini لتوليد 3 تنويعات مختلفة (`Variations`) من نص الرسالة لنفس الحملة، مع جدولة الإرسال بفواصل زمنية عشوائية والالتزام بقوالب Meta التسويقية المعتمدة مسبقاً، وإضافة خيار إلغاء الاشتراك التلقائي (`Opt-out`).

> [!IMPORTANT]
> **سيادة البيانات والامتثال لنظام PDPL:**
> * **الخطر:** تسريب بيانات العملاء الشخصية أو سلوكياتهم الشرائية إلى نماذج الذكاء الاصطناعي.
> * **خطة المعالجة:** تجريد الحمولات المرسلة إلى Gemini API من أي بيانات شخصية (`PII Masking`)؛ بحيث يمرر المحرك فقط مسميات الخدمات وأسعارها ورموز التخفيض دون أسماء أو أرقام هواتف المستهلكين.

---

## 🚀 8. الخطوات القادمة وخطة العمل (Strategic Next Steps & Sprint Roadmap)

1. **إطلاق بيئة الاختبار لسير عمل n8n و Gemini (Sprint 1 - أسبوع عمل):**
   * ربط الـ Webhook بين Supabase و n8n واختبار استجابة Gemini 1.5 بنظام الإخراج المهيكل (`JSON Schema Validation`).
2. **برمجة واجهة إعدادات الهوية التسويقية في لوحة تحكم مكِّن (Sprint 2 - أسبوع عمل):**
   * إتاحة شاشة إدخال بيانات الهوية، الألوان، وشعار المتجر للتاجر لتغذية جدول `tenant_brand_profiles`.
3. **تفعيل دورة استعادة السلات المتروكة تلقائياً (Sprint 3 - 10 أيام):**
   * ربط حدث ترك السلة بإنشاء مهمة توليد كود خصم وعرض فوري يرسل للعميل عبر الواتساب خلال 15 دقيقة من مغادرة المتجر.
4. **استكمال اختبارات شهادات CSID الخاصة بهيئة الزكاة (مسار متوازٍ مستمر):**
   * التحقق من سلامة الأختام الرقمية (`ECDSA`) للفواتير المقترنة بأكواد الخصم الناتجة عن الحملات الإعلانية.
