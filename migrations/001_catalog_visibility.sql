-- ─────────────────────────────────────────────
-- Що саме видно в каталозі.
--
-- Раніше view пропускав лише probability_of_owner >= 70, і листинги агенцій
-- без комісії не показувались узагалі — навіть коли фронтенд їх просив.
-- Правило видимості має жити в одному місці, і це місце — база.
--
-- Правило:
--   owner          — показуємо, якщо впевненість >= 70
--   agency_no_fee  — показуємо завжди (питання «чи власник» до них не стоїть,
--                    цінність у нульовій комісії; картка так їх і підписує)
--   agency         — не показуємо ніколи: обіцянка продукту саме в цьому
-- ─────────────────────────────────────────────

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
    end as original_url
from public.listings
where status = 'active'
  and (
        (listing_type = 'owner' and probability_of_owner >= 70)
     or  listing_type = 'agency_no_fee'
  );

grant select on public.listings_public to anon, authenticated;
