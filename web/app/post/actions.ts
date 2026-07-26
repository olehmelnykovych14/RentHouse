"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { validateOwnerListing, type OwnerListingInput } from "@/lib/ownerListing";

type Result = { ok: true; id: string } | { ok: false; error: string };

/**
 * Створює оголошення від власника. Фото вже завантажені у Storage на клієнті —
 * сюди приходять лише їхні URL, тож payload маленький (без обмежень на розмір).
 *
 * Запис іде від сесії користувача (не service_role), тож RLS-політика
 * `listings_insert_own` реально працює: source='user', status='pending',
 * posted_by = поточний користувач. У каталог (listings_public) оголошення
 * потрапить лише після модерації, коли статус стане 'active'.
 */
export async function createOwnerListing(input: OwnerListingInput): Promise<Result> {
  const supabase = createSupabaseServer();
  if (!supabase) return { ok: false, error: "Немає з'єднання з базою" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Потрібно увійти" };

  // Той самий предикат, що й у формі, але тут він обовʼязковий: клієнтську
  // перевірку легко обійти, серверну — ні.
  const problem = validateOwnerListing(input);
  if (problem) return { ok: false, error: problem };

  const city = input.city.trim();
  const description = input.description.trim();
  const photos = input.photos.filter((u) => typeof u === "string" && u.trim());

  const { data, error } = await supabase
    .from("listings")
    .insert({
      source: "user",
      external_id: randomUUID(), // немає зовнішнього ID — генеруємо свій
      url: "", // оголошення живе тут, зовнішнього посилання немає
      title: input.title.trim() || `${labelRooms(input.rooms)}, ${city}`,
      raw_description: description,
      clean_description: description, // від власника текст уже «чистий»
      price: input.price,
      currency: "UAH",
      price_uah: input.price,
      rooms: input.rooms,
      district: input.district.trim() || null,
      city,
      has_furniture: input.has_furniture,
      area_sqm: input.area_sqm,
      floor: input.floor,
      total_floors: input.total_floors,
      property_type: input.property_type || "apartment",
      listing_type: "owner",
      commission: null,
      commission_verified: false,
      probability_of_owner: 100, // це і є оголошення від власника
      owner_verified: false, // самозаявка; підтвердить модерація
      seller_contact: input.seller_contact.trim(),
      photos,
      status: "pending",
      posted_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/cabinet");
  return { ok: true, id: data.id as string };
}

function labelRooms(rooms: number | null): string {
  return rooms == null ? "Квартира" : `${rooms}-кімнатна квартира`;
}
