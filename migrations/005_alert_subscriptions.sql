-- ─────────────────────────────────────────────
-- Telegram-сповіщення про нові квартири за критеріями користувача.
--
-- Один запис на користувача (unique) — це один набір критеріїв, як у макеті.
-- Прив'язка до Telegram відбувається через link_token: користувач відкриває
-- бота з deep-link ?start=<link_token>, бот записує його chat_id сюди.
-- Доти telegram_chat_id порожній і сповіщення нікуди не йдуть.
-- ─────────────────────────────────────────────

create table if not exists public.alert_subscriptions (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null unique references auth.users (id) on delete cascade,

    -- Критерії. NULL = «будь-що» по цьому параметру.
    city              text,
    district          text,
    price_min         integer check (price_min is null or price_min >= 0),
    price_max         integer check (price_max is null or price_max >= 0),
    rooms             integer check (rooms is null or rooms between 1 and 10),
    rooms_plus        boolean not null default false,  -- true → «rooms і більше»

    -- Прив'язка Telegram.
    link_token        uuid not null default gen_random_uuid(),
    telegram_chat_id  bigint,

    active            boolean not null default true,
    -- Щоб не слати старі оголошення повторно: шлемо лише те, що новіше.
    -- При прив'язці ставимо now() — користувач отримує майбутні, не потоп.
    last_notified_at  timestamptz not null default now(),

    created_at        timestamptz not null default now()
);

alter table public.alert_subscriptions enable row level security;

drop policy if exists "alerts_select_own" on public.alert_subscriptions;
drop policy if exists "alerts_insert_own" on public.alert_subscriptions;
drop policy if exists "alerts_update_own" on public.alert_subscriptions;
drop policy if exists "alerts_delete_own" on public.alert_subscriptions;

create policy "alerts_select_own"
    on public.alert_subscriptions for select using (auth.uid() = user_id);
create policy "alerts_insert_own"
    on public.alert_subscriptions for insert with check (auth.uid() = user_id);
create policy "alerts_update_own"
    on public.alert_subscriptions for update
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "alerts_delete_own"
    on public.alert_subscriptions for delete using (auth.uid() = user_id);

-- Бот шукає підписку за link_token під service-role (RLS не заважає), тож
-- індекс саме на нього; і на chat_id для розсилки.
create index if not exists alert_subscriptions_token_idx
    on public.alert_subscriptions (link_token);
create index if not exists alert_subscriptions_chat_idx
    on public.alert_subscriptions (telegram_chat_id) where telegram_chat_id is not null;
