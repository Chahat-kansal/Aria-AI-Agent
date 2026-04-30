import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#08111F",
        surface: "rgba(15, 23, 42, 0.58)",
        border: "rgba(255,255,255,0.10)",
        muted: "#94A3B8",
        accent: "#7C3AED",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        aria: {
          bg: "#08111F",
          bg2: "#0D1B2E",
          panel: "rgba(15, 23, 42, 0.58)",
          panelStrong: "rgba(15, 23, 42, 0.82)",
          border: "rgba(255,255,255,0.10)",
          borderStrong: "rgba(255,255,255,0.16)",
          text: "#F8FAFC",
          text2: "#CBD5E1",
          muted: "#94A3B8",
          faint: "#64748B",
          violet: "#7C3AED",
          violetSoft: "#8B5CF6",
          violetLight: "#A78BFA",
          cyan: "#06B6D4",
          cyanLight: "#22D3EE",
          emerald: "#10B981",
          amber: "#F59E0B",
          red: "#EF4444"
        }
      },
      boxShadow: {
        premium: "0 24px 80px rgba(0,0,0,0.32)",
        glass: "0 24px 80px rgba(0,0,0,0.32)",
        glow: "0 0 40px rgba(124,58,237,0.28)",
        cyanGlow: "0 0 38px rgba(6,182,212,0.22)"
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
};

export default config;
