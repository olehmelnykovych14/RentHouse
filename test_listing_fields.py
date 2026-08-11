#!/usr/bin/env python3
"""Тести витягування полів з тексту.  Запуск:  python test_listing_fields.py"""
import listing_fields as lf

passed = failed = 0


def check(name, got, want):
    global passed, failed
    if got == want:
        passed += 1
    else:
        failed += 1
        print(f"FAIL {name}: отримано {got!r}, треба {want!r}")


# ── меблі ──
check("пряма згадка", lf.parse_furniture("Квартира з меблями та технікою"), True)
check("мебльована", lf.parse_furniture("Повністю мебльована квартира"), True)
check("предмети", lf.parse_furniture("Є холодильник, пральна машина, диван"), True)
check("без меблів", lf.parse_furniture("Здається без меблів"), False)
check("заперечення > предмети", lf.parse_furniture("Без меблів, лише холодильник"), False)
check("не згадано", lf.parse_furniture("Світла квартира біля парку"), None)
check("порожній текст", lf.parse_furniture(""), None)

# ── площа ──
check("м²", lf.parse_area("Площа 45 м²"), 45.0)
check("м2", lf.parse_area("площа 62.5 м2"), 62.5)
check("кв.м", lf.parse_area("Загальна площа 70 кв.м"), 70.0)
check("кома", lf.parse_area("площа 44,5 м²"), 44.5)
check("з підписом", lf.parse_area("Загальна площа 53 м² житлова 48 м²"), 53.0)
check("замалу відсікає", lf.parse_area("балкон 2 м², кімната 30 м²"), 30.0)
check("немає", lf.parse_area("Затишна квартира"), None)

# ── поверх ──
check("X з Y", lf.parse_floor("4 поверх з 9"), (4, 9))
check("дріб", lf.parse_floor("Квартира 5/12 поверх"), (5, 12))
check("лише поверх", lf.parse_floor("на 3 поверсі"), (3, None))
check("нелогічне відсікає", lf.parse_floor("20 поверх з 5"), (None, None))
check("немає", lf.parse_floor("Гарний краєвид"), (None, None))

# ── enrich не перезаписує наявне ──
row = {"has_furniture": False, "area_sqm": 100.0, "floor": 2, "total_floors": 5}
lf.enrich(row, "з меблями, площа 45 м², 4 поверх з 9")
check("enrich зберігає наявні", (row["has_furniture"], row["area_sqm"], row["floor"]), (False, 100.0, 2))

row2 = {"has_furniture": None, "area_sqm": None, "floor": None, "total_floors": None}
lf.enrich(row2, "Мебльована, загальна площа 48 м², 6 поверх з 9")
check("enrich заповнює порожні",
      (row2["has_furniture"], row2["area_sqm"], row2["floor"], row2["total_floors"]),
      (True, 48.0, 6, 9))

print(f"\n{passed} passed, {failed} failed")
raise SystemExit(1 if failed else 0)
