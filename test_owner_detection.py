#!/usr/bin/env python3
"""
Перевірка рубрики на прикладах із відомою відповіддю.

Ці тексти взяті з реальних оголошень, які вже проходили через систему —
зокрема ті, на яких вона помилялась.
"""
import telegram_parser as tp

CASES = [
    # (текст, очікуваний post_type, очікується owner?)
    ("Здаю свою 1-кімнатну квартиру на вул. Шевченка. Сама виїжджаю до дочки в Польщу. "
     "Меблі всі залишаються, холодильник новий. Без тварин, можна студентам. 7000 грн + комуналка.",
     "rent_offer", True),

    ("🏡 Оренда 1-кімнатної квартири 📍 вул. Під Голоском | 💰 20500 грн | 🔑 Комісія 50% "
     "Є ще варіанти в цьому районі! Телефонуйте, підберемо ідеальний варіант. Код об'єкта 4412.",
     "rent_offer", False),

    ("Куплю квартиру до 38т. Чекаємо на пропозиції", "wanted", None),

    ("Доброго дня! Пара шукає квартиру на довготривалу оренду з 15 серпня. "
     "Порядні, без шкідливих звичок. Розглянемо варіанти до 15000.",
     "wanted", None),

    ("Продаж 3-кімнатної квартири по вул. Костомарова. Площа 82 кв.м. Ціна 185000 у.о.",
     "sale", None),

    # spam чи other — не принципово, обидва відсіюються воротарем.
    ("🚀 BotFactory Ukraine — екосистема Telegram-ботів для бізнесу. Замовляйте розсилку!",
     ("spam", "other"), None),

    # Найкаверзніший: агентство, що прикидається власником
    ("Здається квартира без комісії! Затишне гніздечко в центрі, розвинена інфраструктура. "
     "Деталі та відео в приват. Працюємо щодня з 9 до 20.",
     "rent_offer", False),

    # Нейтральний текст без ознак — не має ставати власником
    ("Квартира 2 кімнати, 55 кв.м, 5 поверх. Ціна 12000 грн на місяць. Львів.",
     "rent_offer", None),
]


def main():
    print(f"{'очік.':>10} {'факт':>10} {'prob':>5}  {'вердикт':<8} текст")
    print("-" * 100)
    passed = failed = 0
    for text, want_type, want_owner in CASES:
        e = tp.ai_check(text)
        got_type = e.get("post_type")
        prob = e.get("probability_of_owner")
        is_owner = tp.classify(e)[0] == "owner"

        expected = want_type if isinstance(want_type, tuple) else (want_type,)
        type_ok = got_type in expected
        owner_ok = want_owner is None or is_owner == want_owner
        ok = type_ok and owner_ok
        passed, failed = (passed + 1, failed) if ok else (passed, failed + 1)

        label = "/".join(expected)
        print(f"{label:>16} {str(got_type):>10} {prob:>5}  {'OK' if ok else 'ПОМИЛКА':<8} {text[:48]}")
        if not ok:
            print(f"           owner: очікували {want_owner}, отримали {is_owner}")
        for s in (e.get("realtor_signals") or [])[:2]:
            print(f"             - посередник: {s[:70]}")
        for s in (e.get("owner_signals") or [])[:2]:
            print(f"             + власник:    {s[:70]}")

    print("-" * 100)
    print(f"пройдено {passed}, провалено {failed}")


if __name__ == "__main__":
    main()
