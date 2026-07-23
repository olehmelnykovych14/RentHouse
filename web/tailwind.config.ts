import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

// Дизайн-токени перенесені 1:1 зі Stitch-експорту RentDirect.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Бренд-кольори з прототипу handoff. У DESIGN.md таблиця токенів і
        // текст розходяться: таблиця дає primary #00236f, а текст і всі
        // макети малюють #1E3A8A / #0D9488. Веду за макетами — README
        // просить відтворити саме їх, — але шкалу токенів не чіпаю.
        "brand-blue": "#1E3A8A",
        "brand-teal": "#0D9488",
        "brand-amber": "#F59E0B",

        "surface-container-lowest": "#ffffff",
        primary: "#00236f",
        surface: "#f7f9fb",
        "on-background": "#191c1e",
        "on-tertiary": "#ffffff",
        tertiary: "#3e2400",
        "primary-fixed": "#dce1ff",
        "surface-container-low": "#f2f4f6",
        "on-tertiary-fixed": "#2a1700",
        "on-primary": "#ffffff",
        error: "#ba1a1a",
        "inverse-surface": "#2d3133",
        "on-secondary-fixed-variant": "#005049",
        "surface-bright": "#f7f9fb",
        "on-secondary-fixed": "#00201d",
        background: "#f7f9fb",
        "primary-container": "#1e3a8a",
        "inverse-on-surface": "#eff1f3",
        "tertiary-fixed": "#ffddb8",
        "primary-fixed-dim": "#b6c4ff",
        "on-error-container": "#93000a",
        "inverse-primary": "#b6c4ff",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#006f66",
        secondary: "#006a61",
        "on-primary-fixed-variant": "#264191",
        "on-primary-container": "#90a8ff",
        "surface-container": "#eceef0",
        "on-tertiary-container": "#ef9900",
        "surface-container-highest": "#e0e3e5",
        outline: "#757682",
        "on-tertiary-fixed-variant": "#653e00",
        "on-error": "#ffffff",
        "tertiary-fixed-dim": "#ffb95f",
        "surface-container-high": "#e6e8ea",
        "on-surface-variant": "#444651",
        "surface-dim": "#d8dadc",
        "tertiary-container": "#5c3800",
        "secondary-fixed-dim": "#6bd8cb",
        "secondary-container": "#86f2e4",
        "surface-tint": "#4059aa",
        "on-primary-fixed": "#00164e",
        "outline-variant": "#c5c5d3",
        "on-surface": "#191c1e",
        "surface-variant": "#e0e3e5",
        "secondary-fixed": "#89f5e7",
        "error-container": "#ffdad6",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        base: "8px",
        "margin-desktop": "64px",
        "container-max": "1280px",
        gutter: "24px",
        "margin-mobile": "20px",
      },
      maxWidth: {
        "container-max": "1280px",
      },
      fontFamily: {
        "label-md": ["Inter", "sans-serif"],
        "display-lg": ["Montserrat", "sans-serif"],
        "headline-lg-mobile": ["Montserrat", "sans-serif"],
        "headline-lg": ["Montserrat", "sans-serif"],
        "headline-md": ["Montserrat", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        caption: ["Inter", "sans-serif"],
      },
      fontSize: {
        "label-md": ["14px", { lineHeight: "1.2", letterSpacing: "0.05em", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg-mobile": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "headline-lg": ["32px", { lineHeight: "1.3", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      boxShadow: {
        "level-2": "0px 4px 20px rgba(30, 58, 138, 0.05)",
        "level-3": "0px 10px 30px rgba(0, 0, 0, 0.1)",
        // Наведення на картку: тінь із синім підтоном, як велить DESIGN.md
        // («blue tint keeps the depth integrated with the brand»).
        "card-hover": "0px 12px 32px rgba(30, 58, 138, 0.14)",
      },

      // Криві руху. Спокійний вихід для появи, легкий «перестріл» для
      // елементів, що виїжджають — щоб рух не був механічним.
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },

      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Пульс для лічильника днів до платежу.
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "70%": { transform: "scale(1.25)", opacity: "0" },
          "100%": { transform: "scale(1.25)", opacity: "0" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },

      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "slide-down": "slide-down 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [forms],
};

export default config;
