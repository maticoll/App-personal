import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class", // Controlado por next-themes con la clase "dark"
  theme: {
    extend: {
      colors: {
        // Design system: dark mode
        dark: {
          bg: "#0D0F14",
          surface: "#1A1D27",
          surfaceHover: "#232736",
          border: "#2D3148",
          muted: "#3D4266",
        },
        // Design system: light mode
        light: {
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          surfaceHover: "#F1F5F9",
          border: "#E2E8F0",
          muted: "#CBD5E1",
        },
        // Accent principal — Indigo/Violet
        accent: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
          light: "#818CF8",
          subtle: "#EEF2FF",
        },
        // Colores de scoring (gradient verde → rojo)
        score: {
          excellent: "#22C55E",   // 80-100
          good: "#84CC16",        // 60-79
          average: "#EAB308",     // 40-59
          poor: "#F97316",        // 20-39
          bad: "#EF4444",         // 0-19
        },
        // Colores por módulo
        module: {
          sleep: "#8B5CF6",       // Violeta
          fitness: "#06B6D4",     // Cyan
          nutrition: "#10B981",   // Esmeralda
          projects: "#F59E0B",    // Ámbar
          ideas: "#EC4899",       // Rosa
          finances: "#3B82F6",    // Azul
          scoring: "#6366F1",     // Indigo
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      screens: {
        xs: "375px",  // iPhone 14 width
      },
      animation: {
        "score-fill": "scoreFill 1s ease-out forwards",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        scoreFill: {
          "0%": { width: "0%" },
          "100%": { width: "var(--score-width)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
