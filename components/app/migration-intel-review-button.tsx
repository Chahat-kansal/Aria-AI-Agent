"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SubtleButton } from "@/components/ui/subtle-button";

export function MigrationIntelReviewButton({
  updateId,
  reviewed
}: {
  updateId: string;
  reviewed: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(reviewed);
  const [isPending, setIsPending] = useState(false);

  if (done) {
    return <span className="text-xs text-emerald-300">Reviewed</span>;
  }

  return (
    <SubtleButton
      disabled={isPending}
      className="h-9 rounded-[1rem] px-3 text-xs"
      onClick={async () => {
        setIsPending(true);
        const response = await fetch(`/api/updates/${updateId}/review`, { method: "PATCH" });
        setIsPending(false);
        if (response.ok) {
          setDone(true);
          router.refresh();
        }
      }}
    >
      {isPending ? "Saving..." : "Mark reviewed"}
    </SubtleButton>
  );
}
