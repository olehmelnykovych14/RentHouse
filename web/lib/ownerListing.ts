/**
 * Оголошення від власника: спільний тип + чиста валідація.
 *
 * Валідацію тримаємо окремо від server action, щоб:
 *   1. те саме правило працювало і на клієнті (миттєвий фідбек у формі),
 *      і на сервері (справжній захист — клієнту довіряти не можна);
 *   2. його можна було покрити тестами без Supabase (ownerListing.test.mts).
 */

export const PROPERTY_TYPES = [
  { value: "apartment", label: "Квартира" },
  { value: "house", label: "Будинок" },
  { value: "room", label: "Кімната" },
  { value: "studio", label: "Студія" },
] as const;

export const MAX_PHOTOS = 12;
export const MIN_DESCRIPTION = 20;

export type OwnerListingInput = {
  title: string;
  city: string;
  district: string;
  price: number | null;
  rooms: number | null;
  area_sqm: number | null;
  floor: number | null;
  total_floors: number | null;
  property_type: string;
  has_furniture: boolean;
  description: string;
  seller_contact: string;
  photos: string[];
};

/**
 * Повертає текст першої помилки або null, якщо все гаразд.
 * Порядок перевірок = порядок полів у формі, щоб помилка вказувала «вгору».
 */
export function validateOwnerListing(input: OwnerListingInput): string | null {
  const city = input.city?.trim();
  if (!city) return "Вкажіть місто";

  if (input.price == null || !Number.isFinite(input.price) || input.price <= 0) {
    return "Вкажіть коректну ціну оренди";
  }

  if (input.rooms != null && (input.rooms < 1 || input.rooms > 20)) {
    return "Кількість кімнат виглядає некоректно";
  }
  if (input.area_sqm != null && (input.area_sqm <= 0 || input.area_sqm > 10000)) {
    return "Площа виглядає некоректно";
  }
  if (
    input.floor != null &&
    input.total_floors != null &&
    input.floor > input.total_floors
  ) {
    return "Поверх не може бути вищим за поверховість будинку";
  }

  const description = input.description?.trim() ?? "";
  if (description.length < MIN_DESCRIPTION) {
    return `Опишіть квартиру докладніше — щонайменше ${MIN_DESCRIPTION} символів`;
  }

  if (!input.seller_contact?.trim()) return "Вкажіть контакт для звʼязку";

  const photos = (input.photos ?? []).filter((u) => typeof u === "string" && u.trim());
  if (photos.length === 0) return "Додайте хоча б одне фото";
  if (photos.length > MAX_PHOTOS) return `Максимум ${MAX_PHOTOS} фото`;

  return null;
}
