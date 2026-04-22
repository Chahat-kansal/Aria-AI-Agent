import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aria for Migration Agents",
  description: "AI-assisted migration operations platform for Australian migration practices."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
