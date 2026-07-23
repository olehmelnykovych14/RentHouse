-- ─────────────────────────────────────────────
-- 1. Історія платежів за оренду
--
-- Було: active_leases.last_paid_on — одна дата, яку кожна нова оплата
-- затирала. Історії не існувало: не видно ні що платив три місяці тому,
-- ні чи пропустив місяць.
--
-- Стало: окремий запис на кожен платіж. due_date — та дата платежу, яку
-- закривають гроші (не день, коли натиснули кнопку): саме за нею видно
-- пропущені періоди й можна платити наперед.
-- ─────────────────────────────────────────────

create table if not exists public.rent_payments (
    id          uuid primary key default gen_random_uuid(),
    lease_id    uuid not null references public.active_leases (id) on delete cascade,
    due_date    date not null,
    amount      numeric(12, 2) not null check (amount >= 0),
    paid_on     date not null default current_date,
    created_at  timestamptz not null default now(),

    -- Один платіж на період: подвійний клік не створить дубль.
    unique (lease_id, due_date)
);

alter table public.rent_payments enable row level security;

-- Власність — через оренду, як і в utility_logs: свого user_id тут немає.
drop policy if exists "rent_payments_select_own" on public.rent_payments;
drop policy if exists "rent_payments_insert_own" on public.rent_payments;
drop policy if exists "rent_payments_delete_own" on public.rent_payments;

create policy "rent_payments_select_own"
    on public.rent_payments for select
    using (exists (
        select 1 from public.active_leases l
        where l.id = rent_payments.lease_id and l.user_id = auth.uid()
    ));
create policy "rent_payments_insert_own"
    on public.rent_payments for insert
    with check (exists (
        select 1 from public.active_leases l
        where l.id = rent_payments.lease_id and l.user_id = auth.uid()
    ));
create policy "rent_payments_delete_own"
    on public.rent_payments for delete
    using (exists (
        select 1 from public.active_leases l
        where l.id = rent_payments.lease_id and l.user_id = auth.uid()
    ));

create index if not exists rent_payments_lease_idx
    on public.rent_payments (lease_id, due_date desc);

-- Переносимо наявні позначки, щоб уже зроблені оплати не зникли.
-- due_date рахуємо як день платежу в місяці позначки; якщо такого числа
-- в місяці немає (31-е в лютому) — останній день місяця.
-- Останній день місяця беремо як «перше число наступного місяця мінус день».
-- Складені літерали на кшталт interval '1 month - 1 day' PostgreSQL не парсить,
-- тому арифметику робимо явно над типом date.
insert into public.rent_payments (lease_id, due_date, amount, paid_on)
select
    l.id,
    make_date(
        extract(year from l.last_paid_on)::int,
        extract(month from l.last_paid_on)::int,
        least(
            l.payment_day,
            extract(
                day from ((date_trunc('month', l.last_paid_on) + interval '1 month')::date - 1)
            )::int
        )
    ),
    l.rent_amount,
    l.last_paid_on
from public.active_leases l
where l.last_paid_on is not null
on conflict (lease_id, due_date) do nothing;

-- Колонка більше не використовується: джерело правди — rent_payments.
-- Дані з неї перенесені вище.
alter table public.active_leases drop column if exists last_paid_on;

-- ─────────────────────────────────────────────
-- 2. Категорії комунальних платежів
--
-- Щоб не набирати «Електрика» щомісяця руками — і щоб однакові рахунки
-- групувались, а не жили як «електрика», «Електрика», «ел-ка».
-- ─────────────────────────────────────────────

alter table public.utility_logs
    add column if not exists category text;

create index if not exists utility_logs_category_idx
    on public.utility_logs (lease_id, category);
