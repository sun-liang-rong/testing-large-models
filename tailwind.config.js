/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./web/index.html", "./web/src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0b",
        muted: "#71717a",
        line: "#e4e4e7",
        panel: "#ffffff",
        field: "#fafafa",
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af"
        },
        mint: {
          50: "#ecfdf5",
          100: "#d1fae5",
          600: "#059669",
          700: "#047857"
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          700: "#b45309"
        },
        rose: {
          50: "#fff1f2",
          100: "#ffe4e6",
          700: "#be123c"
        }
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "PingFang SC",
          "sans-serif"
        ],
        mono: ["ui-monospace", "SF Mono", "JetBrains Mono", "Cascadia Code", "Menlo", "monospace"]
      },
      boxShadow: {
        panel: "0 18px 54px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
