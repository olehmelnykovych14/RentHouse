-- ─────────────────────────────────────────────
-- «Smart Radar»: розширюємо наявні alert_subscriptions, а не заводимо
-- окрему таблицю radars. Три додачі:
--   A. property_type — фільтр за типом житла.
--   B+. districts — кілька районів замість одного вільного поля.
--   C. instant — прапорець миттєвої доставки (діє лише для Premium; для
--      решти бот шле раз на добу згорнутий дайджест — див. telegram_alert_bot.py).
--
-- Premium визначається наявною subscriptions/is_subscriber(), НЕ окремим
-- profiles.is_premium — щоб не мати двох джерел правди про оплату.
-- RLS уже налаштований на цю таблицю (див. 005), нових політик не треба.
-- ─────────────────────────────────────────────

alter table public.alert_subscriptions
    add column if not exists property_type text
        check (property_type is null or property_type in ('apartment', 'house', 'studio')),
    add column if not exists districts text[] not null default '{}',
    add column if not exists instant boolean not null default false;

-- Переносимо старий одиничний район у масив districts, щоб діючі підписки
-- нічого не втратили.
update public.alert_subscriptions
   set districts = array[district]
 where district is not null
   and btrim(district) <> ''
   and cardinality(districts) = 0;

comment on column public.alert_subscriptions.districts is
    'Список районів (АБО-логіка): оголошення підходить, якщо його район збігається з будь-яким. Порожній масив = будь-який район.';
comment on column public.alert_subscriptions.instant is
    'Користувач хоче миттєву доставку. Діє лише для Premium; для решти — щоденний дайджест.';
