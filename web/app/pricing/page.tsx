import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SubscribeButton from "@/components/SubscribeButton";
import { PLANS } from "@/lib/wayforpay";

export const metadata = { title: "Тарифи — RentDirect" };

type Tier = {
  name: string;
  price: string;
  unit: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
  accent: "surface-variant" | "primary" | "tertiary";
  plan?: string; // якщо задано — кнопка ініціює оплату цього тарифу
};

// Ціни беремо з PLANS (lib/wayforpay) — там єдине джерело, тож показане
// збігається зі списанням.
// Обіцяємо лише те, що продукт справді робить. Раніше тут стояло «прямий
// контакт власника» як головна цінність усіх платних тарифів, хоча номер у
// тексті публікує далеко не кожне джерело (dom.ria та OLX ховають його за
// власним віджетом дзвінків), і «відсутність реклами», якої на платформі
// ніколи й не було. Реальна цінність — відсіяні посередники та швидкість.
const TIERS: Tier[] = [
  {
    name: "Базовий",
    price: "₴0",
    unit: "/міс",
    blurb: "Каталог без посередників. Нові квартири зʼявляються через 24 години.",
    features: [
      "Каталог, з якого прибрано ріелторів",
      "Фільтри за містом, районом, ціною та кімнатами",
      "AI-помічник для пошуку звичайною мовою",
      "Перевірка договору оренди",
      "Нові оголошення — через 24 години після появи",
    ],
    cta: "Користуватись безкоштовно",
    accent: "surface-variant",
  },
  {
    name: "Спринт",
    price: `₴${PLANS.sprint.price}`,
    unit: "/7 днів",
    blurb: "Тиждень без затримки — коли шукаєте житло просто зараз.",
    features: [
      "Усе з Базового",
      "Нові оголошення одразу, без затримки 24 години",
      "Відкриті контакти й посилання на оригінал",
      "7 днів повного доступу",
    ],
    cta: "Обрати Спринт",
    accent: "tertiary",
    plan: "sprint",
  },
  {
    name: "Преміум",
    price: `₴${PLANS.premium.price}`,
    unit: "/міс",
    blurb: "Дізнаватись про квартиру першим — поки її не розібрали.",
    features: [
      "Усе зі Спринту",
      "Миттєві сповіщення в Telegram за вашими критеріями",
      "Радар: місто, райони, ціна, тип житла",
      "Місяць доступу без затримок",
    ],
    cta: "Оформити Преміум",
    featured: true,
    accent: "primary",
    plan: "premium",
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
            Платите за швидкість, а не за доступ
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Каталог без посередників доступний безкоштовно — ми відсіюємо ріелторів для всіх.
            Підписка дає головне на цьому ринку: дізнаватись про квартиру першим, поки її
            не розібрали.
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

              {(() => {
                const cls = `w-full py-4 rounded-lg font-label-md text-label-md transition-colors ${
                  t.featured
                    ? "bg-primary text-on-primary hover:bg-primary-container shadow-md"
                    : "bg-surface-container-low text-primary hover:bg-surface-container border border-outline-variant/20"
                }`;
                return t.plan ? (
                  <SubscribeButton plan={t.plan} className={cls}>
                    {t.cta}
                  </SubscribeButton>
                ) : (
                  <button className={cls}>{t.cta}</button>
                );
              })()}
            </div>
          ))}
        </div>

        {/* Чесно про межу: телефон є не в кожному оголошенні, бо дошки ховають
            його за власним віджетом. Краще сказати це до оплати, ніж дати
            підписнику відкрити порожнє поле. */}
        <div className="mt-12 text-center max-w-xl flex flex-col gap-3">
          <p className="font-caption text-caption text-on-surface-variant">
            Частина джерел не публікує номер у тексті оголошення — там підписка відкриває
            посилання на оригінал, де є звʼязок із власником. Де номер вказано, він
            показується напряму.
          </p>
          <p className="font-caption text-caption text-on-surface-variant">
            Оплата через WayForPay (український еквайринг). Підписку можна скасувати
            будь-коли — доступ діятиме до кінця оплаченого періоду.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
