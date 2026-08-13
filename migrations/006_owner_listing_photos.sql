-- ─────────────────────────────────────────────
-- Розміщення оголошень власниками — доступ до Storage.
--
-- Таблиця listings уже має RLS-політики для source='user' (див.
-- supabase_schema.sql): користувач створює/редагує лише свої оголошення,
-- вони стартують зі status='pending' і потрапляють у каталог лише після
-- модерації. Бракувало тільки дозволу заливати фото.
--
-- Парсери пишуть фото через service_role (обходить RLS) — цих політик не
-- торкається. Тут дозволяємо АВТОРИЗОВАНОМУ користувачу заливати й видаляти
-- файли лише у власній теці:  user/<uid>/<file>  у бакеті listing-photos.
-- Читання публічне (бакет public), тож окремий select-policy не потрібен.
-- ─────────────────────────────────────────────

create policy "owner_listing_photos_insert"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'listing-photos'
        and (storage.foldername(name))[1] = 'user'
        and (storage.foldername(name))[2] = auth.uid()::text
    );

create policy "owner_listing_photos_delete"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'listing-photos'
        and (storage.foldername(name))[1] = 'user'
        and (storage.foldername(name))[2] = auth.uid()::text
    );
