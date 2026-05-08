import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getLaunchReadinessReport } from "@/lib/services/launch-readiness";
import { legalReviewStatusLabel, updateWorkspaceLaunchControls } from "@/lib/services/launch-controls";
import { listSubclassSupport, supportLevelLabel } from "@/lib/services/subclass-support";

function ReadinessItem({ label, configured, detail }: { label: string; configured: boolean; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-white">{label}</p>
        <StatusPill tone={configured ? "success" : "warning"}>{configured ? "Complete" : "Needs review"}</StatusPill>
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

export default async function LaunchReadinessPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Launch readiness">
        <PageHeader title="Launch readiness unavailable" description="Your company administrator controls launch-readiness settings and review states." />
      </AppShell>
    );
  }

  const report = await getLaunchReadinessReport(context.workspace.id);
  const subclasses = listSubclassSupport();

  async function saveControls(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await updateWorkspaceLaunchControls(context.workspace.id, {
      betaModeEnabled: formData.get("betaModeEnabled") === "on",
      allowRealClientUploads: formData.get("allowRealClientUploads") === "on",
      restrictBetaToSelectedUsers: formData.get("restrictBetaToSelectedUsers") === "on",
      restrictedUserEmails: String(formData.get("restrictedUserEmails") || "").split(/[,\n]+/).map((item) => item.trim()).filter(Boolean),
      allowedSubclasses: formData.getAll("allowedSubclasses").map(String).filter(Boolean),
      clientPortalEnabled: formData.get("clientPortalEnabled") === "on",
      aiDraftAutofillEnabled: formData.get("aiDraftAutofillEnabled") === "on",
      pdfFormFillingEnabled: formData.get("pdfFormFillingEnabled") === "on",
      exportEnabled: formData.get("exportEnabled") === "on",
      publicSignupEnabled: formData.get("publicSignupEnabled") === "on",
      maxFileSizeMb: Math.max(1, Number(formData.get("maxFileSizeMb") || report.controls.maxFileSizeMb)),
      allowedFileTypes: String(formData.get("allowedFileTypes") || "").split(/[,\n]+/).map((item) => item.trim()).filter(Boolean),
      legalReviewStatuses: {
        privacy: String(formData.get("privacyStatus") || report.controls.legalReviewStatuses.privacy) as any,
        terms: String(formData.get("termsStatus") || report.controls.legalReviewStatuses.terms) as any,
        security: String(formData.get("securityStatus") || report.controls.legalReviewStatuses.security) as any,
        aiDisclaimer: String(formData.get("aiDisclaimerStatus") || report.controls.legalReviewStatuses.aiDisclaimer) as any,
        subprocessors: String(formData.get("subprocessorsStatus") || report.controls.legalReviewStatuses.subprocessors) as any
      }
    });
    revalidatePath("/app/settings/security/launch-readiness");
    revalidatePath("/app/settings/security");
  }

  const legalStatuses = report.controls.legalReviewStatuses;
  const statusOptions = ["draft", "under_legal_review", "approved_for_beta", "approved_for_production"] as const;

  return (
    <AppShell title="Launch readiness">
      <div className="space-y-8">
        <PageHeader
          eyebrow="LAUNCH READINESS"
          title="Production launch candidate review"
          description="This page never claims that Aria is fully secure or legally compliant. Use it to track whether the product is a production launch candidate after independent legal/privacy/security review."
          action={<StatusPill tone="warning">Independent review required</StatusPill>}
        />

        <Card>
          <p className="text-lg font-semibold text-white">{report.headline}</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Security, legal/privacy, product, and operations are tracked separately so unsupported or partially supported workflows stay explicit.
          </p>
        </Card>

        <form action={saveControls} className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Launch controls</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Beta and production safeguards</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["betaModeEnabled", "Beta mode"],
                ["allowRealClientUploads", "Allow real client uploads"],
                ["restrictBetaToSelectedUsers", "Restrict beta to selected users"],
                ["clientPortalEnabled", "Client portal enabled"],
                ["aiDraftAutofillEnabled", "AI draft autofill enabled"],
                ["pdfFormFillingEnabled", "PDF form filling enabled"],
                ["exportEnabled", "Export enabled"],
                ["publicSignupEnabled", "Public signup enabled"]
              ].map(([key, label]) => (
                <label key={key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">
                  <span className="flex items-center gap-3">
                    <input type="checkbox" name={key} defaultChecked={Boolean((report.controls as any)[key])} />
                    {label}
                  </span>
                </label>
              ))}
            </div>

            <label className="block text-sm text-slate-300">
              Restricted beta users (comma or newline separated emails)
              <textarea name="restrictedUserEmails" defaultValue={report.controls.restrictedUserEmails.join("\n")} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
            </label>

            <div>
              <p className="text-sm text-slate-300">Allowed subclasses for live beta/production use</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {subclasses.map((item) => (
                  <label key={item.subclassCode} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200">
                    <span className="flex items-center gap-3">
                      <input type="checkbox" name="allowedSubclasses" value={item.subclassCode} defaultChecked={report.controls.allowedSubclasses.includes(item.subclassCode)} />
                      <span>{item.subclassCode} · {supportLevelLabel(item.supportLevel)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Max file size (MB)
                <input name="maxFileSizeMb" type="number" min={1} defaultValue={report.controls.maxFileSizeMb} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white" />
              </label>
              <label className="text-sm text-slate-300">
                Allowed file types
                <textarea name="allowedFileTypes" defaultValue={report.controls.allowedFileTypes.join("\n")} className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
            </div>

            <div>
              <p className="text-sm text-slate-300">Legal/public page review status</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {[
                  ["privacyStatus", "Privacy", legalStatuses.privacy],
                  ["termsStatus", "Terms", legalStatuses.terms],
                  ["securityStatus", "Security", legalStatuses.security],
                  ["aiDisclaimerStatus", "AI disclaimer", legalStatuses.aiDisclaimer],
                  ["subprocessorsStatus", "Subprocessors", legalStatuses.subprocessors]
                ].map(([name, label, current]) => (
                  <label key={name} className="text-sm text-slate-300">
                    {label}
                    <select name={name} defaultValue={String(current)} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white">
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{legalReviewStatusLabel(status)}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
              Save launch controls
            </button>
          </Card>

          <div className="space-y-6">
            <Card>
              <p className="text-sm font-semibold text-white">Launch posture</p>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Production launch candidate after independent legal/privacy/security review.
              </p>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                This page must never be interpreted as a legal-compliance certificate or a security guarantee.
              </p>
            </Card>

            <Card>
              <p className="text-sm font-semibold text-white">Honest subclass support</p>
              <div className="mt-3 space-y-2">
                {subclasses.map((item) => (
                  <div key={item.subclassCode} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <StatusPill tone={item.supportLevel === "FULL_FIELD_AUTOFILL" ? "success" : item.supportLevel === "NOT_CONFIGURED" ? "danger" : "warning"}>
                        {supportLevelLabel(item.supportLevel)}
                      </StatusPill>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-slate-400">{item.notes}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </form>

        <section className="grid gap-6 xl:grid-cols-2">
          {([
            ["Security", report.security],
            ["Legal / privacy", report.legalPrivacy],
            ["Product", report.product],
            ["Operations", report.operations]
          ] as const).map(([title, items]) => (
            <Card key={title}>
              <p className="text-lg font-semibold text-white">{title}</p>
              <div className="mt-4 space-y-3">
                {(items as typeof report.security).map((item) => (
                  <ReadinessItem key={item.key} label={item.label} configured={item.configured} detail={item.detail} />
                ))}
              </div>
            </Card>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
