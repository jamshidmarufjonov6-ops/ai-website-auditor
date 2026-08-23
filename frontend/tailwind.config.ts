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
        ink: {
          950: "#0b0f17",
          900: "#0f1420",
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
      },
    },
  },
  plugins: [],
};

export default config;
