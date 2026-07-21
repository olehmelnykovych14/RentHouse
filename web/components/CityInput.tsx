"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CITIES, suggestCities } from "@/lib/cities";

type Props = {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
};

export default function CityInput({
  name = "q",
  defaultValue = "",
  placeholder = "Місто, район",
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => suggestCities(value), [value]);

  // Клік поза полем закриває список — інакше він лишається висіти над сторінкою.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(city: string) {
    setValue(city);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      // Не даємо формі відправитись, поки користувач обирає зі списку.
      e.preventDefault();
      choose(options[active].name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative flex items-center w-full">
      <span className="material-symbols-outlined text-outline mr-2">location_on</span>
      <input
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full bg-transparent border-none focus:ring-0 text-body-md font-body-md placeholder-outline p-0"
        placeholder={placeholder}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="city-options"
      />

      {open && options.length > 0 && (
        <ul
          id="city-options"
          role="listbox"
          className="absolute left-0 top-full mt-3 z-50 w-[280px] max-h-72 overflow-y-auto bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-level-3 py-2"
        >
          {options.map((city, i) => (
            <li key={city.name}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(city.name)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                  i === active ? "bg-surface-container" : ""
                }`}
              >
                <span className="material-symbols-outlined text-outline text-[20px]">
                  location_on
                </span>
                <span className="min-w-0">
                  <span className="block text-body-md font-body-md text-on-surface truncate">
                    {city.name}
                  </span>
                  <span className="block text-body-sm font-body-sm text-on-surface-variant truncate">
                    {city.region}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && value.trim() !== "" && options.length === 0 && (
        <div className="absolute left-0 top-full mt-3 z-50 w-[280px] bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-level-3 px-4 py-3">
          <p className="text-body-sm font-body-sm text-on-surface-variant">
            Поки не шукаємо в цьому місті. Доступні:{" "}
            {CITIES.slice(0, 4).map((c) => c.name).join(", ")} та інші.
          </p>
        </div>
      )}
    </div>
  );
}
