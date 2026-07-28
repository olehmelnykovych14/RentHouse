"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

/**
 * Випадайка під аватаром: особисті пункти (кабінет, перевірка договору,
 * профіль, вихід), щоб не перевантажувати верхню навігацію. Верхній рядок
 * лишається для основного перегляду (Огляд/Оголошення/Обране/Тарифи).
 */
export default function ProfileMenu({
  displayName,
  initial,
  isAdmin = false,
}: {
  displayName: string;
  initial: string;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 max-w-[200px] group"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-md text-label-md shrink-0">
          {initial}
        </div>
        <span className="font-label-md text-label-md text-on-surface truncate group-hover:text-primary transition-colors">
          {displayName}
        </span>
        <span
          className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-surface-container-lowest border border-surface-variant rounded-xl shadow-level-2 py-2 z-50"
        >
          <MenuLink href="/cabinet" icon="person" onSelect={() => setOpen(false)}>
            Профіль
          </MenuLink>
          <MenuLink href="/dashboard" icon="dashboard" onSelect={() => setOpen(false)}>
            Мій кабінет
          </MenuLink>
          <MenuLink href="/contract-check" icon="contract" onSelect={() => setOpen(false)}>
            Перевірка договору
          </MenuLink>
          {isAdmin && (
            <MenuLink href="/admin" icon="shield_person" onSelect={() => setOpen(false)}>
              Модерація
            </MenuLink>
          )}
          <div className="my-1 border-t border-surface-variant" />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-high hover:text-error transition-colors font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span> Вийти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onSelect,
}: {
  href: string;
  icon: string;
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      role="menuitem"
      className="flex items-center gap-3 px-4 py-2 text-on-surface hover:bg-surface-container-high hover:text-primary transition-colors font-label-md text-label-md"
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span> {children}
    </Link>
  );
}
