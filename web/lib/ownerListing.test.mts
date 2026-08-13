/**
 * Валідація оголошення від власника.
 * Запуск:  npx tsx lib/ownerListing.test.mts
 */
import {
  validateOwnerListing,
  MAX_PHOTOS,
  MIN_DESCRIPTION,
  type OwnerListingInput,
} from "./ownerListing.js";

let passed = 0;
let failed = 0;

function check(name: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (ok) passed++;
  else {
    failed++;
    console.error(`✗ ${name}\n    отримано: ${JSON.stringify(got)}\n    треба:    ${JSON.stringify(want)}`);
  }
}

// Валідне оголошення — база, від якої відхиляємось у кожному кейсі.
const ok = (over: Partial<OwnerListingInput> = {}): OwnerListingInput => ({
  title: "Затишна 2-кімнатна",
  city: "Львів",
  district: "Сихів",
  price: 15000,
  rooms: 2,
  area_sqm: 60,
  floor: 4,
  total_floors: 9,
  property_type: "apartment",
  has_furniture: true,
  description: "Простора квартира з ремонтом, поруч парк і школа.",
  seller_contact: "+380671234567",
  photos: ["https://x/1.jpg"],
  ...over,
});

check("валідне → null", validateOwnerListing(ok()), null);

// Місто
check("без міста", validateOwnerListing(ok({ city: "" })), "Вкажіть місто");
check("місто з пробілів", validateOwnerListing(ok({ city: "   " })), "Вкажіть місто");

// Ціна
check("ціна null", validateOwnerListing(ok({ price: null })), "Вкажіть коректну ціну оренди");
check("ціна 0", validateOwnerListing(ok({ price: 0 })), "Вкажіть коректну ціну оренди");
check("ціна відʼємна", validateOwnerListing(ok({ price: -500 })), "Вкажіть коректну ціну оренди");
check("ціна NaN", validateOwnerListing(ok({ price: Number.NaN })), "Вкажіть коректну ціну оренди");

// Кімнати / площа
check("кімнат 0", validateOwnerListing(ok({ rooms: 0 })), "Кількість кімнат виглядає некоректно");
check("кімнат забагато", validateOwnerListing(ok({ rooms: 99 })), "Кількість кімнат виглядає некоректно");
check("кімнати null → пропускаємо", validateOwnerListing(ok({ rooms: null })), null);
check("площа 0", validateOwnerListing(ok({ area_sqm: 0 })), "Площа виглядає некоректно");

// Поверх vs поверховість
check(
  "поверх > поверховості",
  validateOwnerListing(ok({ floor: 10, total_floors: 9 })),
  "Поверх не може бути вищим за поверховість будинку"
);
check("поверх без поверховості → ок", validateOwnerListing(ok({ floor: 10, total_floors: null })), null);

// Опис
check(
  "короткий опис",
  validateOwnerListing(ok({ description: "мало" })),
  `Опишіть квартиру докладніше — щонайменше ${MIN_DESCRIPTION} символів`
);

// Контакт
check("без контакту", validateOwnerListing(ok({ seller_contact: " " })), "Вкажіть контакт для звʼязку");

// Фото
check("без фото", validateOwnerListing(ok({ photos: [] })), "Додайте хоча б одне фото");
check(
  "порожні рядки фото = немає фото",
  validateOwnerListing(ok({ photos: ["", "   "] })),
  "Додайте хоча б одне фото"
);
check(
  "забагато фото",
  validateOwnerListing(ok({ photos: Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => `https://x/${i}.jpg`) })),
  `Максимум ${MAX_PHOTOS} фото`
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
