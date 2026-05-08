"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GradientButton } from "@/components/ui/gradient-button";
import { SubtleButton } from "@/components/ui/subtle-button";
import { groupTemplateFieldOptions, type FormTemplateFieldOption } from "@/lib/services/form-template-catalog";

type MappingSuggestion = {
  fieldName: string;
  fieldType: string;
  mappedFieldKey: string | null;
  options: string[];
};

export function FormTemplateMappingEditor({
  templateId,
  suggestions,
  canEdit
}: {
  templateId: string;
  suggestions: MappingSuggestion[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>(
    Object.fromEntries(
      suggestions
        .filter((item) => item.mappedFieldKey)
        .map((item) => [item.fieldName, item.mappedFieldKey as string])
    )
  );

  const groups = useMemo(() => groupTemplateFieldOptions(), []);
  const mappedCount = Object.values(mappings).filter(Boolean).length;

  async function saveMappings() {
    setMessage(null);
    const payload = Object.fromEntries(Object.entries(mappings).filter(([, value]) => value));
    const response = await fetch(`/api/forms/${templateId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings: payload })
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setMessage(body?.error ?? "Unable to save template mappings.");
      return;
    }
    setMessage("Template mapping saved. Aria can now reuse these field bindings when generating matter PDFs.");
    startTransition(() => router.refresh());
  }

  function fieldLabelFor(key: string) {
    for (const group of groups) {
      const option = group.options.find((item) => item.key === key);
      if (option) return option.label;
    }
    return key;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Company field mapping</p>
          <p className="mt-1 text-xs text-slate-400">
            Map each detected PDF field to Aria matter evidence. Generated PDFs stay review-required.
          </p>
        </div>
        <div className="rounded-2xl bg-white/[0.04] px-4 py-2 text-xs text-slate-300">
          {mappedCount}/{suggestions.length} fields mapped
        </div>
      </div>

      <div className="space-y-3">
        {suggestions.map((field) => (
          <div key={field.fieldName} className="grid gap-3 rounded-[1.25rem] bg-white/[0.04] p-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)] md:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{field.fieldName}</p>
              <p className="mt-1 text-xs text-slate-500">{field.fieldType}</p>
              {field.mappedFieldKey ? (
                <p className="mt-2 text-xs text-violet-300">Suggested: {fieldLabelFor(field.mappedFieldKey)}</p>
              ) : (
                <p className="mt-2 text-xs text-amber-300">No confident mapping suggestion yet.</p>
              )}
            </div>
            <select
              value={mappings[field.fieldName] ?? ""}
              disabled={!canEdit || isPending}
              onChange={(event) => {
                const value = event.target.value;
                setMappings((current) => {
                  if (!value) {
                    const next = { ...current };
                    delete next[field.fieldName];
                    return next;
                  }
                  return { ...current, [field.fieldName]: value };
                });
              }}
              className="h-11 rounded-2xl bg-white/[0.08] px-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-violet-400"
            >
              <option value="">No mapping selected</option>
              {groups.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map((option: FormTemplateFieldOption) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <GradientButton type="button" onClick={saveMappings} disabled={!canEdit || isPending}>
          Save template mapping
        </GradientButton>
        <SubtleButton
          type="button"
          onClick={() => setMappings({})}
          disabled={!canEdit || isPending}
        >
          Clear mappings
        </SubtleButton>
      </div>

      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}
