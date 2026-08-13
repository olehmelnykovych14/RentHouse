"use client";

import { useEffect, useState, useCallback } from "react";

export default function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index !== null;

  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(
    () => setIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length)),
    [photos.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i === null ? i : (i + 1) % photos.length)),
    [photos.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, prev, next]);

  if (photos.length === 0) return null;

  const thumbs = photos.slice(1, 5);

  // Розкладка на кожну кількість фото окремо. Сітка була жорстко на 4 колонки
  // з головним фото на двох із них, тож будь-яка кількість, крім п'яти,
  // лишала порожні клітинки — при одному фото зяяла половина блока.
  // На мобільному мініатюри сховані (hidden md:block), тому там завжди
  // одна колонка, а справжня розкладка вмикається з md.
  // Класи виписані повністю: Tailwind не бачить згенеровані рядки.
  const LAYOUTS = [
    { grid: "grid-cols-1", main: "col-span-full row-span-full" },                        // тільки головне
    { grid: "grid-cols-1 md:grid-cols-2", main: "col-span-full md:col-span-1" },         // + 1
    { grid: "grid-cols-1 md:grid-cols-2 md:grid-rows-2", main: "col-span-full md:row-span-2" },   // + 2
    { grid: "grid-cols-1 md:grid-cols-3 md:grid-rows-3", main: "col-span-full md:col-span-3 md:row-span-2" }, // + 3
    { grid: "grid-cols-1 md:grid-cols-4 md:grid-rows-2", main: "col-span-full md:col-span-2 md:row-span-2" }, // + 4
  ];
  const { grid: gridClass, main: mainClass } = LAYOUTS[thumbs.length];

  return (
    <>
      {/* Bento grid */}
      <div className={`grid ${gridClass} gap-base mb-12 h-[300px] md:h-[440px] rounded-xl overflow-hidden`}>
        <button
          onClick={() => setIndex(0)}
          className={`${mainClass} relative bg-surface-container-low overflow-hidden group text-left`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[0]} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <span className="absolute bottom-3 right-3 bg-surface-container-lowest/90 text-on-surface font-caption text-caption px-3 py-1.5 rounded-lg flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">photo_library</span>
            {photos.length > 1 ? `Всі фото (${photos.length})` : "Відкрити фото"}
          </span>
        </button>
        {thumbs.map((p, i, arr) => (
          <button
            key={i}
            onClick={() => setIndex(i + 1)}
            className="hidden md:block relative bg-surface-container-low overflow-hidden group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            {i === arr.length - 1 && photos.length > 5 && (
              <div className="absolute inset-0 flex items-center justify-center bg-on-surface/50 text-on-primary font-headline-md text-headline-md">
                +{photos.length - 5}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {open && index !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
          onClick={close}
        >
          <button
            onClick={close}
            aria-label="Закрити"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <span className="material-symbols-outlined text-[32px]">close</span>
          </button>
          <span className="absolute top-5 left-5 text-white/80 font-label-md text-label-md">
            {index + 1} / {photos.length}
          </span>

          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Попереднє"
              className="absolute left-2 md:left-6 text-white/80 hover:text-white"
            >
              <span className="material-symbols-outlined text-[40px]">chevron_left</span>
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[index]}
            alt={`${title} — фото ${index + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] object-contain rounded-lg"
          />

          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Наступне"
              className="absolute right-2 md:right-6 text-white/80 hover:text-white"
            >
              <span className="material-symbols-outlined text-[40px]">chevron_right</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
