-- ─────────────────────────────────────────────
-- Скарги на оголошення: людський сигнал про неактуальність і посередників.
--
-- Навіщо: перевірка URL ловить лише знятi оголошення на OLX/dom.ria, а
-- Telegram-пости не «вмирають» ніколи. Орендар, який подзвонив і почув «вже
-- здано», — найшвидше джерело правди, якого в нас не було.
--
-- Один користувач — одна скарга на оголошення (unique), щоб накрутка не
-- знімала чужі оголошення пачкою.
-- ─────────────────────────────────────────────

create table if not exists public.listing_reports (
    id          uuid primary key default gen_random_uuid(),
    listing_id  uuid not null references public.listings (id) on delete cascade,
    user_id     uuid not null references auth.users (id) on delete cascade,
    reason      text not null check (reason in ('rented', 'agent', 'scam', 'wrong')),
    comment     text,
    created_at  timestamptz not null default now(),
    unique (listing_id, user_id)
);

create index if not exists listing_reports_listing_idx on public.listing_reports (listing_id);

alter table public.listing_reports enable row level security;

-- Скаржитись може будь-який залогінений; бачити — лише свої скарги.
-- Адмін читає через service-role (RLS обходиться), тож окремої політики нема.
drop policy if exists "reports_insert_own" on public.listing_reports;
drop policy if exists "reports_select_own" on public.listing_reports;

create policy "reports_insert_own"
    on public.listing_reports for insert to authenticated
    with check (auth.uid() = user_id);

create policy "reports_select_own"
    on public.listing_reports for select to authenticated
    using (auth.uid() = user_id);

comment on table public.listing_reports is
    'Скарги користувачів на оголошення. reason=rented — «вже здано» (найчастіше); agent — посередник; scam — шахрайство; wrong — неправильні дані.';
