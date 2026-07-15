import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RentDirect — квартири від власників",
  description: "Знайдіть ідеальну квартиру прямо від власника. Без комісій агентам.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className="light">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Montserrat:wght@600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface font-body-md min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
