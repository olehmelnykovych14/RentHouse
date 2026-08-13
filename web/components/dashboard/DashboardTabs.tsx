"use client";

import { useState } from "react";
import SearchBoard, { type BoardCard } from "./SearchBoard";
import LeaseTracker, { type UtilityBill } from "./LeaseTracker";
import LeaseSetupModal from "./LeaseSetupModal";
import type { Lease, RentPayment } from "@/lib/lease";

type Tab = "search" | "apartment";

export default function DashboardTabs({
  cards,
  lease,
  payments,
  bills,
}: {
  cards: BoardCard[];
  lease: Lease | null;
  payments: RentPayment[];
  bills: UtilityBill[];
}) {
  // Якщо оренда вже є — відкриваємо саме її: це головний екран для того,
  // хто вже зняв житло.
  const [tab, setTab] = useState<Tab>(lease ? "apartment" : "search");
  const [modalOpen, setModalOpen] = useState(false);

  // Немає оренди й користувач перейшов на «Моє житло» — форма і є вмістом
  // вкладки, тож закривати її нема куди.
  const forcedSetup = tab === "apartment" && !lease;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div
          role="tablist"
          className="inline-flex bg-surface-container-low border border-outline-variant/40 rounded-full p-1"
        >
          <TabButton active={tab === "search"} onClick={() => setTab("search")}>
            Активний пошук
          </TabButton>
          <TabButton active={tab === "apartment"} onClick={() => setTab("apartment")}>
            Моє житло
          </TabButton>
        </div>

        {tab === "apartment" && lease && (
          <button
            onClick={() => setModalOpen(true)}
            className="sm:ml-auto inline-flex items-center gap-1.5 bg-primary text-on-primary font-label-md text-label-md px-4 py-2.5 rounded-full hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Нова оренда
          </button>
        )}
      </div>

      {tab === "search" ? (
        <SearchBoard cards={cards} />
      ) : lease ? (
        <LeaseTracker lease={lease} payments={payments} bills={bills} />
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-[40px] text-outline">key</span>
          <h3 className="font-headline-md text-headline-md text-on-surface mt-3 mb-2">
            Оренда ще не додана
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Додайте договір — нагадаємо про платіж і покажемо, скільки лишилось
            до його закінчення.
          </p>
        </div>
      )}

      <LeaseSetupModal
        open={modalOpen || forcedSetup}
        onClose={() => {
          setModalOpen(false);
          // Форму відкрито через порожню вкладку — повертаємо на пошук,
          // інакше вона одразу відкрилась би знову.
          if (forcedSetup) setTab("search");
        }}
        dismissible
      />
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-5 py-2 rounded-full font-label-md text-label-md transition-colors ${
        active
          ? "bg-surface-container-lowest text-on-surface shadow-sm"
          : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      {children}
    </button>
  );
}
