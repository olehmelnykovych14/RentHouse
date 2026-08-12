#!/usr/bin/env python3
"""
Витягування структурованих полів з тексту оголошення — спільне для всіх джерел.

Навіщо: фільтри каталогу працюють лише тоді, коли поля заповнені, а вони були
порожні масово — has_furniture у 100% dom.ria (там воно було захардкоджене в
None) і в 42% OLX, площа у 64% OLX. dom.ria тримає меблі лише в тексті опису,
структурованого поля для них немає, тож без текстового розбору фільтр
«мебльована» показував майже порожній каталог.

Використовується як ФОЛБЕК: структуровані дані джерела або AI мають пріоритет,
ці функції заповнюють лише те, що лишилось None.
"""
import re

# Пряма згадка меблів + характерні предмети, які бувають лише в мебльованій.
_FURNISHED = re.compile(
    r"мебл[іьовану]|з\s+мебл|мебель|повністю\s+умебльован|вся\s+техніка|"
    r"побутов\w*\s+техн|холодильник|пральн\w*\s+машин|диван|ліжко|шафа|"
    r"кухонн\w*\s+гарнітур|варильн\w*\s+поверхн",
    re.IGNORECASE,
)
# Явне заперечення переважає над згадкою предметів.
_UNFURNISHED = re.compile(
    r"без\s+мебл|не\s+мебльован|порожн\w*\s+кварт|вільна\s+від\s+мебл",
    re.IGNORECASE,
)


def parse_furniture(text: str | None) -> bool | None:
    """True/False, якщо в тексті є сигнал; None — якщо не згадано."""
    if not text:
        return None
    if _UNFURNISHED.search(text):
        return False
    if _FURNISHED.search(text):
        return True
    return None


# «45 м2», «45 кв.м», «45 м²», «площа 45». Кома як десятковий роздільник.
_AREA = re.compile(
    r"(?:загальна\s+площа\s*[:\-]?\s*)?(\d{1,4}(?:[.,]\d{1,2})?)\s*"
    r"(?:м²|м2|м\.кв|кв\.?\s*м|кв\.?м)",
    re.IGNORECASE,
)


def parse_area(text: str | None) -> float | None:
    """Загальна площа в м². Бере перше правдоподібне значення (10-1000 м²)."""
    if not text:
        return None
    for m in _AREA.finditer(text):
        try:
            val = float(m.group(1).replace(",", "."))
        except ValueError:
            continue
        if 10 <= val <= 1000:  # відсікає «2 м² балкон» і помилки парсингу
            return val
    return None


# «4 поверх з 9», «4/9 поверх», «поверх 4 з 9», «на 4 поверсі»
_FLOOR_OF = re.compile(
    r"(\d{1,2})\s*(?:поверх\w*)?\s*(?:з|із|/|from)\s*(\d{1,2})\s*(?:поверх\w*)?",
    re.IGNORECASE,
)
_FLOOR_ONLY = re.compile(r"(?:на\s+)?(\d{1,2})\s*[-–]?\s*(?:му|й|ий)?\s*поверс?[іхь]", re.IGNORECASE)


def parse_floor(text: str | None) -> tuple[int | None, int | None]:
    """(поверх, поверховість). None там, де не вдалось визначити."""
    if not text:
        return None, None
    m = _FLOOR_OF.search(text)
    if m:
        fl, total = int(m.group(1)), int(m.group(2))
        if 1 <= fl <= total <= 50:
            return fl, total
        # «20 поверх з 5» — дані суперечать одні одним. Не падаємо на слабший
        # патерн: він вихопив би 20 і записав явну нісенітницю як факт.
        return None, None
    m = _FLOOR_ONLY.search(text)
    if m:
        fl = int(m.group(1))
        if 1 <= fl <= 50:
            return fl, None
    return None, None


# Український мобільний у будь-якому вигляді: 0631234567, +380631234567,
# 380 63 123 45 67, (063) 123-45-67. Обмежуємось мобільними кодами — міські
# в оголошеннях оренди майже не трапляються, зате 5-значні числа в тексті
# (площа, ціна) інакше давали б хибні збіги.
_PHONE = re.compile(
    r"(?:\+?38)?[\s\-.]?\(?0(39|50|63|66|67|68|73|91|92|93|94|95|96|97|98|99)\)?"
    r"[\s\-.]?(\d{3})[\s\-.]?(\d{2})[\s\-.]?(\d{2})"
)
# @username Telegram. 5+ символів, щоб не чіпляти @ok чи хвіст пошти.
_TG_USER = re.compile(r"(?<![\w@./])@([A-Za-z][A-Za-z0-9_]{4,31})\b")


def parse_contact(text: str | None) -> str | None:
    """
    Контакт продавця з тексту: телефон у форматі +380XXXXXXXXX або @username.

    Телефон має пріоритет — за ним дзвонять; @username беремо лише коли
    номера немає. Без цього контакт лишався порожнім у 100% оголошень, і
    підписка відкривала порожнє поле.
    """
    if not text:
        return None
    m = _PHONE.search(text)
    if m:
        return f"+380{m.group(1)}{m.group(2)}{m.group(3)}{m.group(4)}"
    m = _TG_USER.search(text)
    if m:
        return f"@{m.group(1)}"
    return None


def enrich(row: dict, text: str | None) -> dict:
    """
    Дозаповнює порожні поля рядка з тексту. Не перезаписує вже наявні значення:
    структуровані дані джерела точніші за регулярку.
    """
    if row.get("has_furniture") is None:
        row["has_furniture"] = parse_furniture(text)
    if row.get("area_sqm") is None:
        row["area_sqm"] = parse_area(text)
    if row.get("floor") is None or row.get("total_floors") is None:
        fl, total = parse_floor(text)
        if row.get("floor") is None:
            row["floor"] = fl
        if row.get("total_floors") is None:
            row["total_floors"] = total
    if not row.get("seller_contact"):
        row["seller_contact"] = parse_contact(text)
    return row
