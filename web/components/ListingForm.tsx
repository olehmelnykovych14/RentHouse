"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { CITIES } from "@/lib/cities";
import {
  PROPERTY_TYPES,
  MAX_PHOTOS,
  validateOwnerListing,
  type OwnerListingInput,
} from "@/lib/ownerListing";
import { createOwnerListing } from "@/app/post/actions";

type Photo = { id: string; url: string; preview: string; uploading: boolean };

const MAX_FILE_MB = 8;

const inputCls =
  "w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2.5 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary";
const labelCls = "block font-label-sm text-label-sm text-on-surface-variant mb-1.5";

export default function ListingForm({ defaultContact }: { defaultContact: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const uploading = photos.some((p) => p.uploading);

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, room);
    if (chosen.length < files.length) setError(`Максимум ${MAX_PHOTOS} фото`);

    const supabase = createSupabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Сесія завершилась — увійдіть ще раз");
      return;
    }

    for (const file of chosen) {
      if (!file.type.startsWith("image/")) {
        setError("Можна завантажувати лише зображення");
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`Кожне фото — до ${MAX_FILE_MB} МБ`);
        continue;
      }
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setPhotos((p) => [...p, { id, url: "", preview, uploading: true }]);

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `user/${user.id}/${id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("listing-photos")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (upErr) {
        setError(`Не вдалося завантажити фото: ${upErr.message}`);
        setPhotos((p) => p.filter((x) => x.id !== id));
        URL.revokeObjectURL(preview);
        continue;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("listing-photos").getPublicUrl(path);
      setPhotos((p) => p.map((x) => (x.id === id ? { ...x, url: publicUrl, uploading: false } : x)));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((p) => {
      const gone = p.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return p.filter((x) => x.id !== id);
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    const num = (k: string): number | null => {
      const v = String(fd.get(k) ?? "").trim();
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const input: OwnerListingInput = {
      title: String(fd.get("title") ?? ""),
      city: String(fd.get("city") ?? ""),
      district: String(fd.get("district") ?? ""),
      price: num("price"),
      rooms: fd.get("rooms") === "3+" ? 3 : num("rooms"),
      area_sqm: num("area_sqm"),
      floor: num("floor"),
      total_floors: num("total_floors"),
      property_type: String(fd.get("property_type") ?? "apartment"),
      has_furniture: fd.get("has_furniture") === "on",
      description: String(fd.get("description") ?? ""),
      seller_contact: String(fd.get("seller_contact") ?? ""),
      photos: photos.filter((p) => p.url).map((p) => p.url),
    };

    const problem = validateOwnerListing(input);
    if (problem) {
      setError(problem);
      return;
    }
    if (uploading) {
      setError("Зачекайте, поки завантажаться фото");
      return;
    }

    setBusy(true);
    const res = await createOwnerListing(input);
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => {
        router.push("/cabinet?posted=1");
        router.refresh();
      }, 1200);
    } else {
      setError(res.error);
    }
  }

  if (done) {
    return (
      <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-8 text-center">
        <span className="material-symbols-outlined text-[48px] text-secondary">check_circle</span>
        <h2 className="font-headline-sm text-title-lg text-on-surface mt-3 mb-1">Оголошення надіслано</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Воно зʼявиться в каталозі після короткої модерації. Переходимо в кабінет…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-gutter">
      {/* Фото */}
      <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6">
        <h2 className="font-headline-sm text-title-lg text-on-surface mb-1">Фотографії</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
          Перше фото стане обкладинкою. До {MAX_PHOTOS} шт., кожне до {MAX_FILE_MB} МБ.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.map((p, i) => (
            <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-outline-variant group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="w-full h-full object-cover" />
              {p.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white animate-spin">progress_activity</span>
                </div>
              )}
              {i === 0 && !p.uploading && (
                <span className="absolute bottom-1 left-1 bg-primary text-on-primary font-caption text-caption px-1.5 py-0.5 rounded">
                  Обкладинка
                </span>
              )}
              <button
                type="button"
                onClick={() => removePhoto(p.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Видалити фото"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-outline-variant text-on-surface-variant flex flex-col items-center justify-center gap-1 hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">add_a_photo</span>
              <span className="font-caption text-caption">Додати</span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onPickFiles(e.target.files)}
        />
      </section>

      {/* Основне */}
      <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 space-y-4">
        <h2 className="font-headline-sm text-title-lg text-on-surface">Про квартиру</h2>

        <label className="block">
          <span className={labelCls}>Заголовок (необовʼязково)</span>
          <input name="title" maxLength={120} placeholder="напр. Світла 2-кімнатна біля парку" className={inputCls} />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className={labelCls}>Місто *</span>
            <select name="city" defaultValue="" className={inputCls} required>
              <option value="" disabled>Оберіть місто</option>
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Район</span>
            <input name="district" maxLength={80} placeholder="напр. Сихів" className={inputCls} />
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="block">
            <span className={labelCls}>Ціна, ₴/міс *</span>
            <input name="price" type="number" min={1} step={500} placeholder="15000" className={inputCls} required />
          </label>
          <label className="block">
            <span className={labelCls}>Площа, м²</span>
            <input name="area_sqm" type="number" min={1} step={1} placeholder="60" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Поверх</span>
            <input name="floor" type="number" min={0} step={1} placeholder="4" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Поверховість</span>
            <input name="total_floors" type="number" min={1} step={1} placeholder="9" className={inputCls} />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className={labelCls}>Кімнати</span>
            <div className="flex gap-2">
              {["1", "2", "3", "3+"].map((r) => (
                <label key={r} className="flex-1">
                  <input type="radio" name="rooms" value={r} className="peer sr-only" />
                  <span className="block text-center py-2 rounded-lg border border-outline-variant font-label-md text-label-md text-on-surface-variant cursor-pointer peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary transition-colors">
                    {r}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={labelCls}>Тип житла</span>
            <select name="property_type" defaultValue="apartment" className={inputCls}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" name="has_furniture" className="peer sr-only" />
          <span className="w-5 h-5 rounded border border-outline-variant flex items-center justify-center peer-checked:bg-primary peer-checked:border-primary transition-colors">
            <span className="material-symbols-outlined text-[16px] text-on-primary opacity-0 peer-checked:opacity-100">check</span>
          </span>
          <span className="font-body-md text-body-md text-on-surface">З меблями та технікою</span>
        </label>

        <label className="block">
          <span className={labelCls}>Опис *</span>
          <textarea
            name="description"
            rows={5}
            maxLength={2000}
            placeholder="Розкажіть про квартиру: ремонт, що поруч, умови оренди…"
            className={`${inputCls} resize-y`}
            required
          />
        </label>
      </section>

      {/* Контакт */}
      <section className="bg-surface-container-lowest border border-surface-variant rounded-xl p-6 space-y-4">
        <h2 className="font-headline-sm text-title-lg text-on-surface">Контакт</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant -mt-2">
          Його бачитимуть лише орендарі з підпискою — так само, як для інших оголошень.
        </p>
        <label className="block">
          <span className={labelCls}>Телефон або @username *</span>
          <input
            name="seller_contact"
            defaultValue={defaultContact}
            maxLength={80}
            placeholder="+380 67 123 45 67"
            className={inputCls}
            required
          />
        </label>
      </section>

      {error && (
        <p className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="font-caption text-caption text-on-surface-variant">
          Публікація після модерації. Поля з * — обовʼязкові.
        </p>
        <button
          type="submit"
          disabled={busy || uploading}
          className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-lg hover:bg-primary-container active:scale-[0.99] transition-[background-color,transform] duration-200 disabled:opacity-50 shrink-0"
        >
          {busy ? "Надсилання…" : uploading ? "Фото вантажаться…" : "Опублікувати"}
        </button>
      </div>
    </form>
  );
}
