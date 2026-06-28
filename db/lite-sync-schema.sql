-- مكن — سكيمة المزامنة السحابية لـ Mken Lite (المرحلة 5)
-- نفّذها في Supabase SQL Editor بعد license-schema.sql.
--
-- التصميم: جدول واحد عام يخزّن كل سجلات Mken Lite (الفواتير/الأصناف/العملاء/الفروع/الورديات)
-- على هيئة JSON، مرتبطة بمفتاح الترخيص (الحساب). آخر تعديل يفوز (last-write-wins).

create table if not exists public.mken_lite_records (
  license_key text not null references public.mken_licenses(license_key) on delete cascade,
  store       text not null,            -- branches | products | customers | invoices | shifts
  record_id   text not null,            -- معرّف السجل المحلي (id)
  data        jsonb not null,           -- محتوى السجل كاملاً
  updated_at  timestamptz not null default now(),
  device_id   text,                     -- آخر جهاز رفع التغيير (machineId)
  deleted     boolean not null default false,
  primary key (license_key, store, record_id)
);

-- فهرس السحب التزايدي حسب آخر تعديل
create index if not exists idx_mken_lite_records_pull
  on public.mken_lite_records (license_key, updated_at desc);

create index if not exists idx_mken_lite_records_store
  on public.mken_lite_records (license_key, store);

-- الوصول يتم عبر خدمة الخادم (service role key) فقط بعد التحقق من الترخيص/الجهاز.
alter table public.mken_lite_records enable row level security;
