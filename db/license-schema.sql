-- مكن — سكيمة إدارة التراخيص والاشتراكات (Mken Lite)
-- نفّذها في Supabase SQL Editor.

-- التراخيص/الاشتراكات
create table if not exists public.mken_licenses (
  license_key   text primary key,
  plan          text not null default 'Lite',     -- Lite | Pro | Business
  customer_name text,
  customer_phone text,
  customer_email text,
  max_devices   integer not null default 1,
  status        text not null default 'active',    -- active | suspended | revoked
  billing_cycle text default 'annual',             -- annual | perpetual | trial
  issued_at     timestamptz not null default now(),
  expires_at    timestamptz,
  payment_id    text unique,
  source        text not null default 'admin',
  notes         text,
  tax_number    text,
  commercial_registry_number text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_mken_licenses_status on public.mken_licenses(status);
create index if not exists idx_mken_licenses_phone on public.mken_licenses(customer_phone);
create index if not exists idx_mken_licenses_payment on public.mken_licenses(payment_id);

-- الأجهزة المربوطة بكل ترخيص (يدعم أكثر من جهاز عبر max_devices)
create table if not exists public.mken_license_devices (
  id           uuid primary key default gen_random_uuid(),
  license_key  text not null references public.mken_licenses(license_key) on delete cascade,
  machine_id   text not null,
  hostname     text,
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (license_key, machine_id)
);

create index if not exists idx_mken_license_devices_key on public.mken_license_devices(license_key);

-- سجل الأحداث (تدقيق)
create table if not exists public.mken_license_events (
  id          uuid primary key default gen_random_uuid(),
  license_key text,
  type        text not null,        -- issued | activated | verified | deactivated | revoked | suspended | resumed | denied
  detail      jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_mken_license_events_key on public.mken_license_events(license_key);
create index if not exists idx_mken_license_events_created on public.mken_license_events(created_at desc);

-- ملاحظة: الوصول لهذه الجداول يتم عبر خدمة الخادم (service role key) فقط،
-- لذا اترك RLS مفعّلاً دون سياسات عامة، أو فعّله صراحةً:
alter table public.mken_licenses enable row level security;
alter table public.mken_license_devices enable row level security;
alter table public.mken_license_events enable row level security;
