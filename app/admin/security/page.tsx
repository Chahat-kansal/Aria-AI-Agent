import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusPill } from "@/components/ui/status-pill";
import { getPlatformRuntimeStatus } from "@/lib/services/platform-admin-data";

export default function AdminSecurityPage() {
  const status = getPlatformRuntimeStatus();
  const rows = [
    ["Encryption", status.encryption],
    ["NextAuth", status.auth],
    ["Database", status.database],
    ["Direct database URL", status.directDatabase],
    ["AI provider", status.ai],
    ["Email provider", status.email],
    ["Cron secret", status.cron],
    ["Storage", status.storage],
    ["Document protection", status.documentProtection],
    ["Audit logging", status.auditLogging],
    ["Client portal token hashing", status.clientPortalTokenHashing],
    ["OCR", status.ocr],
    ["Migration intel", status.webResearch]
  ] as const;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="SECURITY" title="Platform security status" description="Configured/not-configured only. Secret values, connection strings, keys, and tokens are never displayed." />
      <SectionCard>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(([label, item]) => (
            <div key={label} className="rounded-2xl bg-[color:var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{label}</p>
                <StatusPill tone={item.configured ? "success" : label === "Encryption" ? "danger" : "warning"}>{item.configured ? "configured" : "not configured"}</StatusPill>
              </div>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{"provider" in item ? item.provider : "configured check"}</p>
              {!item.configured ? <p className="mt-2 text-xs text-amber-500">Missing: {item.missing.join(", ")}</p> : null}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
