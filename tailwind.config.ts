import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F6F7FF",
        surface: "rgba(255,255,255,0.74)",
        border: "rgba(117,121,164,0.22)",
        muted: "#667085",
        accent: "#6D5EF6",
        success: "#16A37B",
        warning: "#C78100",
        danger: "#D9485F"
      },
      boxShadow: {
        premium: "0 18px 55px rgba(70,80,140,0.16)"
      }
    }
  },
  plugins: []
};

export default config;
