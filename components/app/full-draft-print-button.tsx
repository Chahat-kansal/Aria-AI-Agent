"use client";

import { SubtleButton } from "@/components/ui/subtle-button";

export function FullDraftPrintButton() {
  return (
    <SubtleButton onClick={() => window.print()}>
      Print full draft
    </SubtleButton>
  );
}
