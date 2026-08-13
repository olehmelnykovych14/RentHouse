import Link from "next/link";

/**
 * Дії зі звʼязку для оголошень, де контакт справді є: подзвонити / Viber /
 * написати в Telegram. Без цього підписник бачив номер текстом і мусив
 * переписувати його вручну в телефон — саме на цьому кроці шлях орендаря
 * і провисав.
 */
export default function ContactActions({ contact }: { contact: string }) {
  const value = contact.trim();
  const isUsername = value.startsWith("@");

  if (isUsername) {
    const handle = value.slice(1);
    return (
      <a
        href={`https://t.me/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-brand-teal text-on-secondary font-label-md text-label-md py-3 rounded-lg hover:brightness-110 active:scale-[0.99] transition-[filter,transform] flex justify-center items-center gap-2"
      >
        <span className="material-symbols-outlined text-[20px]">send</span>
        Написати в Telegram
      </a>
    );
  }

  // Телефон зберігаємо нормалізованим (+380XXXXXXXXX), тож tel: і viber:
  // будуються без додаткової обробки.
  const digits = value.replace(/[^\d+]/g, "");
  return (
    <div className="flex gap-2">
      <a
        href={`tel:${digits}`}
        className="flex-grow bg-brand-teal text-on-secondary font-label-md text-label-md py-3 rounded-lg hover:brightness-110 active:scale-[0.99] transition-[filter,transform] flex justify-center items-center gap-2"
      >
        <span className="material-symbols-outlined text-[20px]">call</span>
        Подзвонити
      </a>
      <a
        href={`viber://chat?number=${encodeURIComponent(digits)}`}
        className="shrink-0 border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-3 rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-1.5"
        title="Написати у Viber"
      >
        <span className="material-symbols-outlined text-[20px]">chat</span>
        Viber
      </a>
    </div>
  );
}

/** Компактна мітка «прямий контакт» для картки каталогу. */
export function DirectContactBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 bg-secondary-container text-on-secondary-container font-caption text-caption px-2 py-0.5 rounded"
      title="У цьому оголошенні є номер власника — телефонуйте одразу"
    >
      <span className="material-symbols-outlined text-[13px]">call</span>
      Прямий контакт
    </span>
  );
}

/** Посилання на джерело, коли номера в тексті немає. */
export function SourceLink({ url }: { url: string }) {
  return (
    <Link
      href={url}
      target="_blank"
      rel="noreferrer"
      className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg hover:bg-primary-container transition-colors shadow-md flex justify-center items-center gap-2"
    >
      <span className="material-symbols-outlined">open_in_new</span>
      Відкрити оригінал і контакт
    </Link>
  );
}
