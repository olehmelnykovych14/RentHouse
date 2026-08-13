"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import type { Listing } from "@/lib/listings";
import { formatPrice, listingTitle } from "@/lib/format";
import "leaflet/dist/leaflet.css";

/**
 * Карта каталогу. Координати в нас на рівні РАЙОНУ (geocode_listings.py), тож
 * оголошення одного району збігаються в точку — розводимо їх детермінованим
 * зсувом за id, щоб піни не перекривали один одного.
 *
 * Іконку малюємо самі (divIcon з ціною): дефолтні PNG-маркери leaflet ламаються
 * у бандлері, та й ціна на піні корисніша за булавку.
 */
const CENTER_UA: [number, number] = [49.0, 31.5];

function jitter(id: string): [number, number] {
  // Стабільний псевдовипадковий зсув ±~350 м із хеша id.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const dx = ((h % 1000) / 1000 - 0.5) * 0.006;
  const dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.006;
  return [dx, dy];
}

function priceIcon(text: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:inline-block;white-space:nowrap;background:#1b3a6b;color:#fff;
      font:600 12px/1 system-ui,sans-serif;padding:5px 8px;border-radius:999px;
      box-shadow:0 1px 4px rgba(0,0,0,.35)">${text}</span>`,
    iconSize: [0, 0],
    iconAnchor: [20, 12],
  });
}

export default function ListingsMap({ listings }: { listings: Listing[] }) {
  const points = useMemo(
    () => listings.filter((l) => l.lat != null && l.lng != null),
    [listings]
  );

  const center = useMemo<[number, number]>(() => {
    if (points.length === 0) return CENTER_UA;
    const lat = points.reduce((s, l) => s + (l.lat as number), 0) / points.length;
    const lng = points.reduce((s, l) => s + (l.lng as number), 0) / points.length;
    return [lat, lng];
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="h-[60vh] rounded-xl border border-surface-variant bg-surface-container-low flex flex-col items-center justify-center text-on-surface-variant">
        <span className="material-symbols-outlined text-[40px]">location_off</span>
        <p className="font-body-md text-body-md mt-2">
          Для цих оголошень ще немає координат.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[60vh] rounded-xl overflow-hidden border border-surface-variant">
      <MapContainer center={center} zoom={points.length > 20 ? 6 : 11} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((l) => {
          const [dx, dy] = jitter(l.id);
          const title = listingTitle(l.title, l.clean_description);
          return (
            <Marker
              key={l.id}
              position={[(l.lat as number) + dx, (l.lng as number) + dy]}
              icon={priceIcon(formatPrice(l.price, l.currency))}
            >
              <Popup>
                <span className="block max-w-[220px]">
                  {l.photos?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.photos[0]} alt="" className="w-full h-24 object-cover rounded mb-1" />
                  )}
                  <Link href={`/listings/${l.id}`} className="font-semibold text-[13px] leading-tight block mb-0.5">
                    {title}
                  </Link>
                  <span className="text-[12px] text-gray-600 block">
                    {[l.district, l.city].filter(Boolean).join(", ")}
                  </span>
                  <span className="text-[13px] font-semibold block mt-0.5">
                    {formatPrice(l.price, l.currency)}
                  </span>
                </span>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
