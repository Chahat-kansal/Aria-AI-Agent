"use client";

import { type ReactNode } from "react";
import {
  FileWarning,
  FolderKanban,
  GraduationCap,
  History,
  Languages,
  MapPinned,
  ShieldCheck,
  UserRound,
  WalletCards
} from "lucide-react";

const iconMap = {
  FileWarning,
  FolderKanban,
  GraduationCap,
  History,
  Languages,
  MapPinned,
  ShieldCheck,
  UserRound,
  WalletCards
} as const;

export function ExtractionReviewSection({
  title,
  description,
  icon,
  children
}: {
  title: string;
  description: string;
  icon: string;
  children: ReactNode;
}) {
  const Icon = iconMap[icon as keyof typeof iconMap] ?? FolderKanban;

  return (
    <section className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(9,13,21,0.95),rgba(12,17,27,0.92))] p-5 shadow-glass">
      <div className="flex items-start gap-3">
        <div className="rounded-[1rem] border border-white/10 bg-white/[0.05] p-3">
          <Icon className="h-4 w-4 text-cyan-200" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
