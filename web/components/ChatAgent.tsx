"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/listings";
import { formatPrice } from "@/lib/format";

type Msg = { role: "assistant" | "user"; text: string; listings?: Listing[] };

const GREETING =
  "Привіт! Я ваш персональний AI-рієлтор. Які параметри квартири вас цікавлять?";
const CHIPS = [
  "Що зараз є на Франківському?",
  "Квартири, де можна з тваринами",
  "Найдешевші варіанти за сьогодні",
];

export default function ChatAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Помилка");
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.summary ?? "", listings: data.listings ?? [] },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Вибачте, сталася помилка. Спробуйте ще раз." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="AI-рієлтор"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-on-primary shadow-level-3 flex items-center justify-center hover:bg-primary-container transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            auto_awesome
          </span>
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface-container-lowest shadow-level-3 border-l border-surface-variant flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-4 h-16 border-b border-surface-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_awesome
            </span>
            <span className="font-headline-md text-headline-md text-on-surface">AI Agent</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Закрити" className="text-on-surface-variant hover:text-primary">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 font-body-md text-body-md ${
                  m.role === "user"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface"
                }`}
              >
                {m.text && <p className="whitespace-pre-line">{m.text}</p>}
                {m.listings && m.listings.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.listings.map((l) => (
                      <Link
                        key={l.id}
                        href={`/listings/${l.id}`}
                        onClick={() => setOpen(false)}
                        className="flex gap-3 items-center bg-surface-container-lowest rounded-lg p-2 border border-surface-variant hover:border-primary transition-colors"
                      >
                        {l.photos?.[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.photos[0]} alt="" className="w-14 h-14 rounded object-cover shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-label-md text-label-md text-primary">
                            {formatPrice(l.price, l.currency)}
                          </div>
                          <div className="font-caption text-caption text-on-surface-variant truncate">
                            {[l.rooms ? `${l.rooms} кімн.` : null, l.district].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Quick chips (лише на старті) */}
          {messages.length === 1 && !loading && (
            <div className="flex flex-col items-start gap-2 pt-1">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="bg-primary-fixed/40 text-primary font-caption text-caption px-3 py-1.5 rounded-full hover:bg-primary-fixed transition-colors"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-container-low text-on-surface-variant rounded-xl px-4 py-2.5 font-body-md text-body-md">
                Шукаю…
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="p-4 border-t border-surface-variant flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напишіть ваш запит…"
            className="flex-1 bg-surface-container-low border border-surface-variant rounded-full px-4 py-2.5 font-body-md text-body-md outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Надіслати"
            className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center disabled:opacity-50 hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </form>
      </div>
    </>
  );
}
