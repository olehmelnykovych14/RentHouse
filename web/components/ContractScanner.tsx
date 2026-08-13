"use client";

import { useRef, useState } from "react";
import {
  ACCEPTED_MIME,
  ACCEPTED_HINT,
  fileRejectReason,
  type ContractReview,
  type RedFlag,
} from "@/lib/contract";

type State =
  | { phase: "idle" }
  | { phase: "loading"; fileName: string }
  | { phase: "done"; review: ContractReview; fileName: string }
  | { phase: "error"; message: string };

export default function ContractScanner() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);

  async function analyze(file: File) {
    const reject = fileRejectReason(file.type, file.size);
    if (reject) {
      setState({ phase: "error", message: reject });
      return;
    }
    setState({ phase: "loading", fileName: file.name });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/contract-check", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setState({ phase: "error", message: data.error || "Помилка аналізу" });
        return;
      }
      setState({ phase: "done", review: data.review as ContractReview, fileName: file.name });
    } catch {
      setState({ phase: "error", message: "Не вдалося зв'язатися з сервером" });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) analyze(file);
  }

  function reset() {
    setState({ phase: "idle" });
    if (fileRef.current) fileRef.current.value = "";
  }

  if (state.phase === "done") {
    return <Results review={state.review} fileName={state.fileName} onReset={reset} />;
  }

  return (
    <div className="space-y-gutter">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`bg-surface-container-lowest border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-outline-variant"
        }`}
      >
        <div className="flex justify-center gap-3 mb-4">
          <span className="w-12 h-12 rounded-full bg-primary-fixed/40 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined">description</span>
          </span>
          <span className="w-12 h-12 rounded-full bg-brand-teal/15 text-brand-teal flex items-center justify-center">
            <span className="material-symbols-outlined">photo_camera</span>
          </span>
        </div>
        <h2 className="font-headline-sm text-title-lg text-on-surface mb-1">Перетягніть документ сюди</h2>
        <p className="font-body-sm text-body-sm text-primary mb-5">Підтримується {ACCEPTED_HINT}</p>

        {state.phase === "loading" ? (
          <div className="inline-flex items-center gap-2 text-on-surface-variant font-label-md text-label-md">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            Аналізую «{state.fileName}»…
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-5 py-2.5 rounded-lg hover:bg-primary-container active:scale-[0.99] transition-[background-color,transform]"
          >
            <span className="material-symbols-outlined text-[20px]">upload_file</span>
            Завантажити документ
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_MIME.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) analyze(f);
          }}
        />
      </div>

      {state.phase === "error" && (
        <p className="bg-error-container text-on-error-container font-body-md text-body-md rounded-lg px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">error</span>
          {state.message}
        </p>
      )}

      <Disclaimer />
    </div>
  );
}

function Results({
  review,
  fileName,
  onReset,
}: {
  review: ContractReview;
  fileName: string;
  onReset: () => void;
}) {
  const { is_rental_contract, red_flags, safe_clauses, summary, pages } = review;
  const criticalCount = red_flags.filter((f) => f.severity === "high").length;

  return (
    <div className="space-y-gutter">
      {/* Резюме від асистента */}
      <div className="bg-surface-container-lowest border border-surface-variant rounded-xl p-5 flex gap-4">
        <span className="w-10 h-10 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-[22px]">robot_2</span>
        </span>
        <div className="min-w-0">
          <p className="font-body-md text-body-md text-on-surface">{summary}</p>
          <p className="font-caption text-caption text-on-surface-variant mt-2 truncate">
            {fileName}
            {pages > 0 ? ` · ${pages} стор.` : ""}
            {is_rental_contract && (
              <>
                {" · "}
                <span className={criticalCount ? "text-error" : "text-secondary"}>
                  {criticalCount ? `${criticalCount} критичн. ризик(ів)` : "критичних ризиків не знайдено"}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {!is_rental_contract ? (
        <p className="bg-tertiary-container text-on-tertiary-container font-body-md text-body-md rounded-xl px-4 py-4 flex items-center gap-2">
          <span className="material-symbols-outlined">help</span>
          Схоже, це не договір оренди житла. Завантажте сам договір (усі сторінки), і я перевірю його.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {/* Червоні прапорці */}
          <section className="bg-error-container/40 border border-error/20 rounded-xl p-5">
            <h3 className="font-headline-sm text-title-md text-error flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              Червоні прапорці ({red_flags.length})
            </h3>
            {red_flags.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Явних ризиків для орендаря не виявлено.
              </p>
            ) : (
              <ul className="space-y-4">
                {red_flags.map((f, i) => (
                  <RedFlagItem key={i} flag={f} />
                ))}
              </ul>
            )}
          </section>

          {/* Безпечні пункти */}
          <section className="bg-secondary-container/40 border border-secondary/20 rounded-xl p-5">
            <h3 className="font-headline-sm text-title-md text-secondary flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[20px]">verified</span>
              Безпечні пункти ({safe_clauses.length})
            </h3>
            {safe_clauses.length === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Стандартних безпечних пунктів не виділено.
              </p>
            ) : (
              <ul className="space-y-4">
                {safe_clauses.map((c, i) => (
                  <li key={i}>
                    <p className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                      {c.title}
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 ml-[22px]">{c.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Disclaimer />
        <button
          type="button"
          onClick={onReset}
          className="shrink-0 inline-flex items-center gap-2 border border-outline-variant text-on-surface font-label-md text-label-md px-4 py-2 rounded-lg hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">restart_alt</span>
          Перевірити інший
        </button>
      </div>
    </div>
  );
}

function RedFlagItem({ flag }: { flag: RedFlag }) {
  return (
    <li>
      <p className="font-label-md text-label-md text-on-surface flex items-center gap-1.5">
        <span
          className={`material-symbols-outlined text-[16px] ${
            flag.severity === "high" ? "text-error" : "text-tertiary"
          }`}
        >
          {flag.severity === "high" ? "dangerous" : "info"}
        </span>
        {flag.clause && <span className="text-error font-semibold">{flag.clause}.</span>}
        {flag.title}
      </p>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 ml-[22px]">{flag.detail}</p>
    </li>
  );
}

function Disclaimer() {
  return (
    <p className="font-caption text-caption text-on-surface-variant flex items-start gap-1.5 max-w-2xl">
      <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
      Це попередній AI-огляд для орієнтації, а не юридична консультація. Важливі рішення звіряйте з юристом.
    </p>
  );
}
