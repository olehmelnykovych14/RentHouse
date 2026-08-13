-- ─────────────────────────────────────────────
-- Розділяємо «джерело прямо каже, що це власник» і «ми не знайшли ознак
-- посередника». Досі це були однакові оголошення з міткою «Перевірений
-- власник» — тобто ми обіцяли перевірку там, де її не було.
--
-- owner_verified = true ставиться ЛИШЕ за прямою заявою джерела:
--   dom.ria  charId 1437 = «Пропозиція від власника»
--
-- Чого сюди НЕ входить і чому:
--   OLX isBusiness=false — це приватний акаунт, а не підтверджене
--     власництво: посередники масово працюють з приватних акаунтів.
--   Telegram — структурного сигналу не існує взагалі, лише оцінка моделі.
--
-- Різницю показує інтерфейс: «Перевірений власник» проти
-- «Ознак посередника не виявлено».
-- ─────────────────────────────────────────────

alter table public.listings
    add column if not exists owner_verified boolean not null default false;

comment on column public.listings.owner_verified is
    'true лише коли джерело прямо назвало продавця власником. Відсутність ознак посередника — це НЕ підтвердження.';

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
    photos,
    case
        when public.is_subscriber() then seller_contact
        else regexp_replace(coalesce(seller_contact, ''), '(\d{2})\d+(\d{2})$', '\1***\2')
    end as seller_contact,
    case
        when public.is_subscriber() then url
        else null
    end as original_url,
    owner_verified
from public.listings
where status = 'active'
  and (
        (listing_type = 'owner' and probability_of_owner >= 70)
     or  listing_type = 'agency_no_fee'
  );

grant select on public.listings_public to anon, authenticated;
