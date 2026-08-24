import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dbe6fe",
          200: "#bfd3fe",
          300: "#93b4fd",
          400: "#6090fa",
          500: "#3b6df6",
          600: "#2551eb",
          700: "#1d3ed8",
          800: "#1e35ae",
          900: "#1e3189",
        },
        accent: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        ink: {
          950: "#070a12",
          900: "#0b0f17",
          850: "#0e1320",
          800: "#151b2b",
          700: "#1d2436",
          600: "#2a3248",
          500: "#3f4a66",
          400: "#67718c",
          300: "#99a1b8",
          200: "#c6cbdb",
          100: "#e6e9f1",
          50: "#f5f7fb",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10)",
        glow: "0 0 24px rgba(124, 58, 237, 0.35), 0 0 64px rgba(59, 109, 246, 0.20)",
        "glow-sm": "0 0 16px rgba(124, 58, 237, 0.30)",
        "glow-lg": "0 0 40px rgba(124, 58, 237, 0.45), 0 0 120px rgba(34, 211, 238, 0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "0.9" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(40px, -30px) scale(1.08)" },
          "66%": { transform: "translate(-30px, 25px) scale(0.95)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-up-delay-1": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both",
        "fade-up-delay-2": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.24s both",
        "fade-up-delay-3": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.36s both",
        float: "float 6s ease-in-out infinite",
        "pulse-slow": "pulse-slow 5s ease-in-out infinite",
        shimmer: "shimmer 3.5s linear infinite",
        aurora: "aurora 16s ease-in-out infinite",
        "aurora-slow": "aurora 22s ease-in-out infinite reverse",
      },
    },
  },
  plugins: [],
};

export default config;
