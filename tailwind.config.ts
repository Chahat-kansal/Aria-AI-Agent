import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#060A14",
        surface: "#0B1220",
        border: "#1F2A3D",
        muted: "#96A0B5",
        accent: "#7C9DFF",
        success: "#35C58A",
        warning: "#FFBD59",
        danger: "#FF6E74"
      },
      boxShadow: {
        premium: "0 12px 40px rgba(2,8,24,0.35)"
      }
    }
  },
  plugins: []
};

export default config;
