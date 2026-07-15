import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Tier = {
  name: string;
  price: string;
  unit: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
  accent: "surface-variant" | "primary" | "tertiary";
};

const TIERS: Tier[] = [
  {
    name: "Базовий",
    price: "₴0",
    unit: "/міс",
    blurb: "Доступ до бази, але нові квартири зʼявляються із затримкою 24 години.",
    features: [
      "Доступ до бази оголошень",
      "Перегляд нових оголошень через 24 години після публікації",
      "Базові фільтри пошуку",
    ],
    cta: "Обрати Базовий",
    accent: "surface-variant",
  },
  {
    name: "Преміум",
    price: "₴299",
    unit: "/міс",
    blurb: "Миттєвий доступ до контактів усіх власників без затримок.",
    features: [
      "Доступ до нових квартир миттєво",
      "Миттєві сповіщення в Telegram про нові обʼєкти",
      "Повна відсутність реклами на платформі",
      "Прямий контакт з власником без затримок",
    ],
    cta: "Оформити Преміум",
    featured: true,
    accent: "primary",
  },
  {
    name: "VIP (для власників)",
    price: "₴999",
    unit: "/обʼєкт",
    blurb: "Для орендодавців: підняття у ТОП і персональні інструменти просування.",
    features: [
      "Підняття оголошень у ТОП списку щодня",
      "Професійна фото- та відеозйомка обʼєкта (1 раз)",
      "Виділення оголошення кольором у пошуку",
      "Детальна аналітика переглядів",
    ],
    cta: "Для орендодавців",
    accent: "tertiary",
  },
];

const ACCENT_BAR: Record<Tier["accent"], string> = {
  "surface-variant": "bg-surface-variant",
  primary: "bg-primary",
  tertiary: "bg-tertiary",
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow pt-[104px] pb-24 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto w-full flex flex-col items-center">
        <div className="text-center max-w-3xl mb-16 px-4">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-6">
            Оберіть свій ідеальний план
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Прозорі тарифи для орендарів та орендодавців. Жодних прихованих платежів, лише зручний
            інструмент для пошуку та здачі нерухомості.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative bg-surface-container-lowest rounded-xl p-8 flex flex-col h-full overflow-hidden ${
                t.featured
                  ? "border-2 border-primary shadow-level-3 md:-translate-y-4"
                  : "border border-outline-variant/30 hover:shadow-level-2 transition-shadow"
              }`}
            >
              <div className={`absolute top-0 left-0 w-full h-1.5 ${ACCENT_BAR[t.accent]}`} />
              {t.featured && (
                <div className="absolute top-4 right-4 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-caption text-caption font-semibold">
                  Популярний
                </div>
              )}

              <div className="mb-8 mt-2">
                <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{t.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-display-lg text-display-lg text-primary">{t.price}</span>
                  <span className="font-body-md text-body-md text-on-surface-variant">{t.unit}</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant">{t.blurb}</p>
              </div>

              <ul className="flex flex-col gap-4 mb-10 flex-grow">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span
                      className="material-symbols-outlined text-secondary shrink-0"
                      style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="font-body-md text-body-md text-on-surface">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-4 rounded-lg font-label-md text-label-md transition-colors ${
                  t.featured
                    ? "bg-primary text-on-primary hover:bg-primary-container shadow-md"
                    : "bg-surface-container-low text-primary hover:bg-surface-container border border-outline-variant/20"
                }`}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="font-caption text-caption text-on-surface-variant mt-12 text-center max-w-xl">
          Оплата підключається наступним кроком (український еквайринг). Кнопки поки без checkout.
        </p>
      </main>
      <Footer />
    </>
  );
}
