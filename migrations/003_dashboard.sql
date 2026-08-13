-- ─────────────────────────────────────────────
-- Кабінет користувача: дошка пошуку (Kanban) + трекер оренди.
--
-- Таблиця обраного в нас зветься favorites (не saved_listings) — розширюємо її,
-- а не заводимо другу таблицю про те саме.
-- ─────────────────────────────────────────────

-- 1. Дошка пошуку ------------------------------------------------------------

alter table public.favorites
    add column if not exists status text not null default 'favorites'
        check (status in ('favorites', 'contacted', 'viewings_scheduled')),
    add column if not exists personal_note text;

-- favorites мала лише select/insert/delete. Без update інлайн-редагування
-- нотатки і перетягування карток між колонками мовчки не працювали б:
-- RLS не помилку віддає, а нуль оновлених рядків.
drop policy if exists "favorites_update_own" on public.favorites;
create policy "favorites_update_own"
    on public.favorites for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create index if not exists favorites_user_status_idx
    on public.favorites (user_id, status);

-- 2. Активна оренда ----------------------------------------------------------

create table if not exists public.active_leases (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null references auth.users (id) on delete cascade,
    property_address  text not null,
    rent_amount       numeric(12, 2) not null check (rent_amount >= 0),
    payment_day       integer not null check (payment_day between 1 and 31),
    lease_end_date    date not null,

    -- Немає в початковому ТЗ, але без них дві вимоги нездійсненні:
    --   lease_start_date — «скільки часу минуло проти скільки лишилось»
    --     неможливо порахувати, маючи саму лише дату кінця;
    --   last_paid_on    — інакше «Позначити оплаченим» нічого не зберігає
    --     і кнопка стає декоративною.
    lease_start_date  date not null default current_date,
    last_paid_on      date,

    created_at        timestamptz not null default now()
);

alter table public.active_leases enable row level security;

drop policy if exists "active_leases_select_own" on public.active_leases;
drop policy if exists "active_leases_insert_own" on public.active_leases;
drop policy if exists "active_leases_update_own" on public.active_leases;
drop policy if exists "active_leases_delete_own" on public.active_leases;

create policy "active_leases_select_own"
    on public.active_leases for select using (auth.uid() = user_id);
create policy "active_leases_insert_own"
    on public.active_leases for insert with check (auth.uid() = user_id);
create policy "active_leases_update_own"
    on public.active_leases for update
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "active_leases_delete_own"
    on public.active_leases for delete using (auth.uid() = user_id);

create index if not exists active_leases_user_idx on public.active_leases (user_id);

-- 3. Комунальні платежі ------------------------------------------------------

create table if not exists public.utility_logs (
    id          uuid primary key default gen_random_uuid(),
    lease_id    uuid not null references public.active_leases (id) on delete cascade,
    title       text not null,
    amount      numeric(12, 2) not null check (amount >= 0),
    created_at  timestamptz not null default now()
);

alter table public.utility_logs enable row level security;

-- У utility_logs немає user_id — власність визначається через оренду.
-- Перевіряємо саме її, інакше будь-хто читав би чужі рахунки, знаючи lease_id.
drop policy if exists "utility_logs_select_own" on public.utility_logs;
drop policy if exists "utility_logs_insert_own" on public.utility_logs;
drop policy if exists "utility_logs_update_own" on public.utility_logs;
drop policy if exists "utility_logs_delete_own" on public.utility_logs;

create policy "utility_logs_select_own"
    on public.utility_logs for select
    using (exists (
        select 1 from public.active_leases l
        where l.id = utility_logs.lease_id and l.user_id = auth.uid()
    ));
create policy "utility_logs_insert_own"
    on public.utility_logs for insert
    with check (exists (
        select 1 from public.active_leases l
        where l.id = utility_logs.lease_id and l.user_id = auth.uid()
    ));
create policy "utility_logs_update_own"
    on public.utility_logs for update
    using (exists (
        select 1 from public.active_leases l
        where l.id = utility_logs.lease_id and l.user_id = auth.uid()
    ));
create policy "utility_logs_delete_own"
    on public.utility_logs for delete
    using (exists (
        select 1 from public.active_leases l
        where l.id = utility_logs.lease_id and l.user_id = auth.uid()
    ));

create index if not exists utility_logs_lease_idx
    on public.utility_logs (lease_id, created_at desc);
