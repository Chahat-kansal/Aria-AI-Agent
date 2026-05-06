import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { PageSection } from "@/components/ui/page-section";
import { SectionCard } from "@/components/ui/section-card";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { canManageTeam } from "@/lib/services/roles";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { prisma } from "@/lib/prisma";

export default async function AppointmentSettingsPage() {
  const context = await requireCurrentWorkspaceContext();
  if (!canManageTeam(context.user)) {
    return (
      <AppShell title="Appointment settings">
        <PageHeader title="Appointment settings unavailable" description="Your company administrator controls appointment configuration." />
      </AppShell>
    );
  }

  const settings = await getWorkspaceOperationalSettingsView(context.workspace.id);

  async function saveSettings(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    if (!canManageTeam(context.user)) return;
    await prisma.workspaceOperationalSettings.update({
      where: { workspaceId: context.workspace.id },
      data: {
        appointmentTimezone: String(formData.get("appointmentTimezone") || settings.appointmentTimezone),
        appointmentMinNoticeHours: Number(formData.get("appointmentMinNoticeHours") || settings.appointmentMinNoticeHours),
        appointmentCutoffHours: Number(formData.get("appointmentCutoffHours") || settings.appointmentCutoffHours),
        appointmentBufferBeforeMinutes: Number(formData.get("appointmentBufferBeforeMinutes") || settings.appointmentBufferBeforeMinutes),
        appointmentBufferAfterMinutes: Number(formData.get("appointmentBufferAfterMinutes") || settings.appointmentBufferAfterMinutes),
        appointmentRequestFallback: String(formData.get("appointmentRequestFallback") || "") === "on",
        appointmentTypesJson: JSON.parse(String(formData.get("appointmentTypesJson") || "[]")),
        appointmentMeetingMethodsJson: String(formData.get("appointmentMeetingMethods") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        appointmentAvailabilityJson: JSON.parse(String(formData.get("appointmentAvailabilityJson") || "[]"))
      }
    });
    revalidatePath("/app/settings/appointments");
    revalidatePath("/client/book/[token]", "page");
  }

  return (
    <AppShell title="Appointment settings">
      <div className="space-y-8">
        <PageHeader
          eyebrow="APPOINTMENT SETTINGS"
          title="Client booking controls"
          description="These settings drive real internal appointment scheduling only. Aria does not pretend external Google or Outlook calendar sync exists."
        />

        <form action={saveSettings} className="space-y-6">
          <PageSection title="Availability and notice">
            <SectionCard className="grid gap-4 md:grid-cols-2 p-5">
              <label className="text-sm text-slate-300">Timezone
                <input name="appointmentTimezone" defaultValue={settings.appointmentTimezone} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white" />
              </label>
              <label className="text-sm text-slate-300">Minimum notice hours
                <input name="appointmentMinNoticeHours" type="number" min={0} defaultValue={settings.appointmentMinNoticeHours} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white" />
              </label>
              <label className="text-sm text-slate-300">Reschedule/cancel cutoff hours
                <input name="appointmentCutoffHours" type="number" min={0} defaultValue={settings.appointmentCutoffHours} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white" />
              </label>
              <label className="text-sm text-slate-300">Fallback to request mode
                <span className="mt-2 flex h-11 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white">
                  <input name="appointmentRequestFallback" type="checkbox" defaultChecked={settings.appointmentRequestFallback} className="mr-3" />
                  Allow clients to request preferred times when slots are unavailable
                </span>
              </label>
            </SectionCard>
          </PageSection>

          <PageSection title="Types, methods, and windows" description="JSON is stored directly so real booking behavior matches what you configure here.">
            <SectionCard className="grid gap-4 p-5">
              <label className="text-sm text-slate-300">Appointment types JSON
                <textarea name="appointmentTypesJson" defaultValue={JSON.stringify(settings.appointmentTypes, null, 2)} className="mt-2 min-h-40 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
              <label className="text-sm text-slate-300">Meeting methods (comma separated)
                <input name="appointmentMeetingMethods" defaultValue={settings.appointmentMeetingMethods.join(", ")} className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white" />
              </label>
              <label className="text-sm text-slate-300">Availability windows JSON
                <textarea name="appointmentAvailabilityJson" defaultValue={JSON.stringify(settings.appointmentAvailability, null, 2)} className="mt-2 min-h-40 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white" />
              </label>
            </SectionCard>
          </PageSection>

          <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
            Save appointment settings
          </button>
        </form>
      </div>
    </AppShell>
  );
}

