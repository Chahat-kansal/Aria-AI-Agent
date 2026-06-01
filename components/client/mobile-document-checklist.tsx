"use client";

import { useMemo, useState } from "react";
import { MobileUploadCard } from "@/components/client/mobile-upload-card";
import { PortalStatusBadge, type PortalStatusTone } from "@/components/client-portal/portal-ui";

export type MobileChecklistItem = {
  id: string;
  label: string;
  category: string;
  description: string | null;
  required: boolean;
  dueLabel: string | null;
  statusLabel: string;
  statusTone: PortalStatusTone;
  documentId: string | null;
  fileName: string | null;
  uploadTimeLabel: string | null;
  teamNote: string | null;
  needsReupload: boolean;
};

type MobileDocumentChecklistProps = {
  items: MobileChecklistItem[];
  token?: string | null;
  acceptedMimeTypes: string[];
  acceptedFormatsLabel: string;
  maxSizeMb: number;
  showUploadActions?: boolean;
};

export function MobileDocumentChecklist(props: MobileDocumentChecklistProps) {
  const [items, setItems] = useState(props.items);

  const grouped = useMemo(() => {
    return items.reduce<Record<string, MobileChecklistItem[]>>((acc, item) => {
      acc[item.category] = acc[item.category] ?? [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [items]);

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([category, categoryItems]) => (
        <section key={category} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-950">{category}</h3>
            <span className="text-xs font-medium text-slate-500">
              {categoryItems.length} item{categoryItems.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-4">
            {categoryItems.map((item) => (
              <div
                key={item.id}
                className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          item.required ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.required ? "Required" : "Recommended"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.category}
                      {item.dueLabel ? ` - Due ${item.dueLabel}` : ""}
                    </p>
                    {item.description ? (
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                    ) : null}
                  </div>
                  <PortalStatusBadge tone={item.statusTone}>{item.statusLabel}</PortalStatusBadge>
                </div>

                {item.fileName ? (
                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold text-slate-950">Uploaded file</p>
                    <p className="mt-2 break-words">{item.fileName}</p>
                    {item.uploadTimeLabel ? (
                      <p className="mt-2 text-xs text-slate-500">Uploaded {item.uploadTimeLabel}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      {item.teamNote || "Your migration team will review this before use."}
                    </p>
                  </div>
                ) : null}

                {props.showUploadActions && (!item.documentId || item.needsReupload) ? (
                  <MobileUploadCard
                    checklistItemId={item.id}
                    label={item.label}
                    token={props.token}
                    acceptedFormatsLabel={props.acceptedFormatsLabel}
                    maxSizeMb={props.maxSizeMb}
                    acceptedMimeTypes={props.acceptedMimeTypes}
                    allowReupload={item.needsReupload || Boolean(item.documentId)}
                    existingFileName={item.fileName}
                    existingUploadLabel={item.uploadTimeLabel ? `Uploaded ${item.uploadTimeLabel}` : null}
                    existingTeamNote={item.teamNote}
                    teamNote="Your migration team will review this before use."
                    onUploaded={(result) => {
                      setItems((current) =>
                        current.map((existing) =>
                          existing.id === item.id
                            ? {
                                ...existing,
                                documentId: "uploaded",
                                fileName: result.document.fileName,
                                uploadTimeLabel: result.checklist.uploadedAtLabel,
                                statusLabel: result.checklist.statusLabel,
                                statusTone: item.needsReupload ? "warning" : "info",
                                teamNote: result.checklist.teamNote,
                                needsReupload: false
                              }
                            : existing
                        )
                      );
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
