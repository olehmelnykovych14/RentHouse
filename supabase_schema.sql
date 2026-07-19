-- RentDirect — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push` with a migration).

-- ─────────────────────────────────────────────
-- 1. Raw listings table (written only by the Python scrapers via the service_role key)
-- ─────────────────────────────────────────────
create table public.listings (
    id                  uuid primary key default gen_random_uuid(),
    source              text not null check (source in ('olx', 'telegram', 'dimria', 'facebook', 'user')),
    external_id         text not null,          -- OLX ad ID, or "{chat_id}_{msg_id}" for Telegram
    url                 text not null,
    title               text,
    raw_description     text,                   -- original scraped/posted text
    clean_description   text,                   -- AI-rewritten, agent language stripped
    price               numeric,
    currency            text check (currency in ('UAH', 'USD', 'EUR')),
    price_uah           numeric,                -- ціна, нормалізована в гривні (для фільтрів/сортування)
    rooms               smallint,
    district            text,
    city                text not null default 'Львів',
    has_furniture       boolean,
    -- Additional display fields shown on the listing detail page
    area_sqm            numeric,                -- площа, м²
    floor               smallint,               -- поверх
    total_floors        smallint,               -- поверховість будинку
    property_type       text,                   -- apartment / house / room / studio
    residential_complex text,                   -- назва ЖК, якщо є
    lat                 numeric,                -- координати для List/Map (заповнюються геокодером пізніше)
    lng                 numeric,
    -- Тип оголошення та комісія. Продукт = "оренда без комісії": показуємо owner
    -- та agency_no_fee. Заскрапене "0%" — неверифіковане (commission_verified=false),
    -- бо це часта приманка ріелторів; справжнє 0% приходить від self-реєстрації агенцій.
    listing_type        text default 'owner' check (listing_type in ('owner', 'agency_no_fee', 'agency')),
    commission          text,                   -- напр. "0%", "50%", "1000 грн"
    commission_verified boolean not null default false,
    probability_of_owner smallint not null check (probability_of_owner between 0 and 100),
    ai_reasoning        text,
    seller_name         text,
    seller_contact      text,                   -- phone/username — masked in listings_public unless subscribed
    photos              jsonb not null default '[]',
    status              text not null default 'active' check (status in ('active', 'rented', 'expired', 'removed', 'pending')),
    posted_by           uuid references auth.users (id) on delete set null,  -- заповнюється для оголошень від власника (source='user'); null для скрапів
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (source, external_id)
);

create index listings_probability_idx on public.listings (probability_of_owner);
create index listings_city_district_idx on public.listings (city, district);
create index listings_created_at_idx on public.listings (created_at desc);

-- keep updated_at current on every upsert
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger listings_set_updated_at
    before update on public.listings
    for each row execute function public.set_updated_at();

-- RLS enabled. Scrapers write via the service_role key (bypasses RLS). Public
-- reads go through the listings_public view. The policies below are the phase-2
-- foundation for owner-posted listings (source='user'): an authenticated user
-- can create and manage only their own listings, which start as 'pending' for
-- moderation and become publicly visible only after an admin sets status='active'.
alter table public.listings enable row level security;

create policy "listings_select_own"
    on public.listings for select
    using (auth.uid() = posted_by);

create policy "listings_insert_own"
    on public.listings for insert
    with check (auth.uid() = posted_by and source = 'user' and status = 'pending');

create policy "listings_update_own"
    on public.listings for update
    using (auth.uid() = posted_by)
    with check (auth.uid() = posted_by and source = 'user');

create policy "listings_delete_own"
    on public.listings for delete
    using (auth.uid() = posted_by);

-- ─────────────────────────────────────────────
-- 2. Subscriptions (paywall) — filled in later by a payment webhook, not by the scrapers
-- ─────────────────────────────────────────────
create table public.subscriptions (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users (id) on delete cascade,
    status              text not null check (status in ('active', 'canceled', 'past_due', 'trialing')),
    plan                text,
    current_period_end  timestamptz,
    provider_customer_id text,
    created_at          timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- users may read only their own subscription row; writes are done by the
-- payment webhook via the service_role key, so no insert/update policy here.
create policy "subscriptions_select_own"
    on public.subscriptions for select
    using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 2b. User profiles — extends auth.users. role is future-proofed for the phase-2
--     owner marketplace; MVP only creates 'tenant' rows.
-- ─────────────────────────────────────────────
create table public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    role        text not null default 'tenant' check (role in ('tenant', 'owner')),
    full_name   text,
    phone       text,
    avatar_url  text,
    created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
    on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own"
    on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, phone, role)
    values (
        new.id,
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'phone',
        case when new.raw_user_meta_data ->> 'role' = 'owner' then 'owner' else 'tenant' end
    );
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 2c. Favorites — the "Обране" section in the user dashboard
-- ─────────────────────────────────────────────
create table public.favorites (
    user_id     uuid not null references auth.users (id) on delete cascade,
    listing_id  uuid not null references public.listings (id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (user_id, listing_id)
);

alter table public.favorites enable row level security;

create policy "favorites_select_own"
    on public.favorites for select using (auth.uid() = user_id);
create policy "favorites_insert_own"
    on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own"
    on public.favorites for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. Paywall enforcement, done in Postgres — not left to the frontend to hide fields
-- ─────────────────────────────────────────────
create or replace function public.is_subscriber()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.subscriptions s
        where s.user_id = auth.uid()
          and s.status = 'active'
          and (s.current_period_end is null or s.current_period_end > now())
    );
$$;

-- Public-facing view: this is what the frontend actually queries.
-- Unsubscribed users get masked contact info, no original link, and only the first photo.
create or replace view public.listings_public as
select
    id,
    source,
    title,
    clean_description,
    price,
    currency,
    price_uah,
    rooms,
    district,
    city,
    has_furniture,
    area_sqm,
    floor,
    total_floors,
    property_type,
    residential_complex,
    lat,
    lng,
    listing_type,
    commission,
    commission_verified,
    probability_of_owner,
    status,
    created_at,
    photos,   -- фото публічні (продають квартиру); платним лишається контакт + оригінальний лінк
    case
        when public.is_subscriber() then seller_contact
        else regexp_replace(coalesce(seller_contact, ''), '(\d{2})\d+(\d{2})$', '\1***\2')
    end as seller_contact,
    case
        when public.is_subscriber() then url
        else null
    end as original_url
from public.listings
where status = 'active'
  and probability_of_owner >= 70;

grant select on public.listings_public to anon, authenticated;

-- ─────────────────────────────────────────────
-- 3b. Channel / source registry — parsers read their source list from here instead
--     of a hardcoded array. Grows via auto-discovery (@mentions), Telegram keyword
--     search, and user suggestions. Admin promotes 'pending' → 'active'.
-- ─────────────────────────────────────────────
create table public.channel_sources (
    id          uuid primary key default gen_random_uuid(),
    platform    text not null default 'telegram' check (platform in ('telegram', 'olx')),
    identifier  text not null,           -- @username (telegram) or listing URL (olx)
    city        text,
    status      text not null default 'pending' check (status in ('pending', 'active', 'rejected')),
    source      text,                    -- how it was found: mention / search / suggestion / seed
    added_by    uuid references auth.users (id) on delete set null,
    created_at  timestamptz not null default now(),
    unique (platform, identifier)
);

create index channel_sources_active_idx on public.channel_sources (platform, status);

-- Backend-only: scrapers read/write via the service_role key (bypasses RLS).
-- Once the frontend exists, add an insert policy so authenticated users can
-- suggest channels (status defaults to 'pending' for review).
alter table public.channel_sources enable row level security;

-- ─────────────────────────────────────────────
-- 4. Storage bucket for listing photos (public read; scrapers write via service_role)
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- Public read is granted by the bucket being public. Writes come from the
-- service_role key (scrapers), which bypasses storage RLS — no extra policy needed.
