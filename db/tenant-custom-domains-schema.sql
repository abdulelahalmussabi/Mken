-- مكّن — نطاقات العملاء الخاصة (إضافة سنوية)
-- نفّذها في Supabase SQL Editor. الوصول عبر service role فقط.

create table if not exists public.mken_tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  hostname text not null,
  status text not null default 'pending_dns'
    check (status in ('pending_dns', 'verified', 'active', 'suspended')),
  vercel_verified boolean not null default false,
  ssl_ready boolean not null default false,
  verification jsonb,
  dns_records jsonb,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hostname)
);

create index if not exists idx_mken_tenant_domains_slug
  on public.mken_tenant_domains(tenant_slug);
create index if not exists idx_mken_tenant_domains_active
  on public.mken_tenant_domains(hostname)
  where status = 'active';

alter table public.mken_tenant_domains enable row level security;
