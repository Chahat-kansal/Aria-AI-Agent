import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { createPortalAcknowledgement, createPortalMessage, getClientPortalByToken } from "@/lib/services/client-workflows";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildMobilePortalGuidance, buildNotificationSafetyView } from "@/lib/services/mobile-notification-safety";

const visibleClientTimelineEvents = new Set([
  "matter.created",
  "intake.sent",
  "intake.viewed",
  "intake.submitted",
  "documents.requested",
  "document.uploaded",
  "documents.reminder_sent",
  "appointment.booked",
  "appointment.requested",
  "generated_document.created",
  "client.review.sent",
  "client.review.returned",
  "client.review.confirmed",
  "portal.client_message",
  "portal.client_acknowledgement"
]);

function prettyStatus(value: string) {
  return value.replace(/_/g, " ").toLowerCase();
}

function checklistKind(required: boolean) {
  return required ? "Required" : "Recommended";
}

function checklistClientStatus(item: { documentId: string | null; reviewedAt: Date | null; status: string; document?: { reviewStatus: string; extractionStatus: string } | null }) {
  if (!item.documentId) return "Missing";
  if (item.document?.reviewStatus === "VERIFIED" || item.reviewedAt) return "Approved";
  if (item.document?.extractionStatus === "NEEDS_REVIEW" || item.document?.reviewStatus === "FLAGGED") return "Review pending";
  return "Uploaded";
}

function nextActionForMatter(matter: NonNullable<Awaited<ReturnType<typeof getClientPortalByToken>>>["matter"]) {
  if (!matter) return "Wait for your migration team to link an active matter.";
  const missing = matter.checklistItems.filter((item) => !item.documentId);
  if (missing.length) return `Upload ${missing.length} outstanding document${missing.length === 1 ? "" : "s"}.`;
  const pending = matter.checklistItems.filter((item) => item.documentId && item.document?.reviewStatus !== "VERIFIED");
  if (pending.length) return "Your migration team is reviewing uploaded evidence.";
  if (matter.reviewRequests.some((request) => request.status === "SENT_TO_CLIENT" || request.status === "VIEWED_BY_CLIENT")) {
    return "Complete the latest secure review request from your migration team.";
  }
  return "No client action is currently required. Your migration team will contact you after agent review.";
}

function dueLabel(date?: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

async function submitPortalMessage(token: string, formData: FormData) {
  "use server";
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const limit = checkRateLimit({ key: `portal.message:${ip}:${token.slice(0, 12)}`, limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) redirect(`/client/portal/${token}?message=rate-limited`);
  const message = String(formData.get("message") || "");
  await createPortalMessage({ token, message });
  redirect(`/client/portal/${token}?message=sent`);
}

async function submitPortalAcknowledgement(token: string, formData: FormData) {
  "use server";
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const limit = checkRateLimit({ key: `portal.acknowledgement:${ip}:${token.slice(0, 12)}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) redirect(`/client/portal/${token}?ack=rate-limited`);
  const accepted = String(formData.get("acknowledgement") || "") === "on";
  const acknowledgementType = String(formData.get("acknowledgementType") || "Client portal acknowledgement");
  if (accepted) await createPortalAcknowledgement({ token, acknowledgementType });
  redirect(`/client/portal/${token}?ack=recorded`);
}

export default async function ClientPortalPage({ params, searchParams }: { params: { token: string }; searchParams?: { message?: string; ack?: string } }) {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const portalLimit = checkRateLimit({ key: `portal.open:${ip}:${params.token.slice(0, 12)}`, limit: 40, windowMs: 60_000 });
  if (!portalLimit.allowed) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-4 py-10 text-slate-50">
        <div className="mx-auto max-w-2xl">
          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Aria Client Portal</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Please wait and try again</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Too many portal attempts were made from this connection. Ask your migration team for help if this continues.</p>
          </Card>
        </div>
      </div>
    );
  }

  const portal = await getClientPortalByToken(params.token);
  if (!portal) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-4 py-10 text-slate-50">
        <div className="mx-auto max-w-2xl">
          <Card className="p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Aria Client Portal</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Portal link unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">This client portal link is invalid, expired, or has been replaced. Ask your migration team to send a fresh secure link.</p>
          </Card>
        </div>
      </div>
    );
  }

  const settings = await getWorkspaceOperationalSettingsView(portal.workspaceId);
  const matter = portal.matter;
  const visibleTimelineEvents = (matter?.timelineEvents ?? []).filter((event) => visibleClientTimelineEvents.has(event.eventType));
  const missingItems = matter?.checklistItems.filter((item) => !item.documentId) ?? [];
  const dueOrRequestedMissing = missingItems.filter((item) => item.dueDate || item.requestedAt);
  const notificationChannels = buildNotificationSafetyView({
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
    smsConfigured: false,
    pushConfigured: false
  });
  const mobileGuidance = buildMobilePortalGuidance(missingItems.length);
  const handleMessage = submitPortalMessage.bind(null, params.token);
  const handleAck = submitPortalAcknowledgement.bind(null, params.token);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-4 py-10 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Aria Client Portal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{portal.client.firstName} {portal.client.lastName}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">This secure portal shows your matter status, requested evidence, messages, appointment requests, and confirmations. All outputs remain subject to registered migration agent review.</p>
          <p className="mt-2 text-xs text-slate-500">{settings.clientPortalHelpText}</p>
          <AIReviewNotice variant="client" className="mt-4" />

          {matter ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm">
                  <p className="text-slate-400">Matter</p>
                  <p className="mt-1 font-medium text-white">{matter.title}</p>
                  <p className="text-xs text-slate-500">Subclass {matter.visaSubclass} · {prettyStatus(matter.stage)}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm">
                  <p className="text-slate-400">Current stage</p>
                  <p className="mt-1 font-medium text-white">{prettyStatus(matter.status)}</p>
                  <p className="text-xs text-slate-500">Agent review required before use</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm">
                  <p className="text-slate-400">Next action</p>
                  <p className="mt-1 font-medium text-white">{nextActionForMatter(matter)}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-sm">
                  <p className="text-slate-400">Assigned team member</p>
                  <p className="mt-1 font-medium text-white">{matter.assignedToUser.name}</p>
                  <p className="text-xs text-slate-500">{matter.assignedToUser.email}</p>
                </div>
              </div>

              {dueOrRequestedMissing.length ? (
                <Card className="mt-6 border border-amber-300/20 bg-amber-500/10">
                  <h3 className="text-sm font-semibold text-amber-100">Still waiting on...</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {dueOrRequestedMissing.slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-amber-300/20 bg-black/10 p-3 text-sm">
                        <p className="font-medium text-white">{item.label}</p>
                        <p className="mt-1 text-xs text-amber-100/80">{item.dueDate ? `Due ${dueLabel(item.dueDate)}` : "Requested by your migration team"}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-amber-100/80">If email reminders are configured, your migration team can send a minimal reminder with the secure portal link. No document contents are included in reminder emails.</p>
                </Card>
              ) : null}

              <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <Card>
                  <h3 className="text-sm font-semibold text-slate-100">Document checklist</h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    {matter.checklistItems.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">{item.label}</p>
                            <p className="text-xs text-slate-500">{item.category} · {checklistKind(item.required)}</p>
                            {item.description ? <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p> : null}
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-200">{checklistClientStatus(item)}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {item.document ? `Uploaded for review: ${item.document.fileName}` : item.dueDate ? `Due ${dueLabel(item.dueDate)}` : "Awaiting upload"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/client/documents/${params.token}` as any} className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01] hover:opacity-95">Upload documents</Link>
                    <Link href={`/client/checklist/${params.token}` as any} className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.08]">Open full checklist</Link>
                  </div>
                </Card>

                <Card>
                  <h3 className="text-sm font-semibold text-slate-100">Case timeline</h3>
                  <div className="mt-4 space-y-3">
                    {visibleTimelineEvents.length ? visibleTimelineEvents.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                        <p className="font-medium text-white">{event.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{event.createdAt.toLocaleString("en-AU")}</p>
                        {event.description ? <p className="mt-2 text-slate-300">{event.description}</p> : null}
                      </div>
                    )) : <p className="text-sm text-slate-400">No client-visible timeline events are recorded yet.</p>}
                  </div>
                </Card>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <Card>
                  <h3 className="text-sm font-semibold text-slate-100">Secure message</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">Send a matter-scoped message to your migration team. Upload attachments only through the secure document upload area.</p>
                  {searchParams?.message === "sent" ? <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">Message recorded for your migration team.</p> : null}
                  {searchParams?.message === "rate-limited" ? <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">Please wait before sending another message.</p> : null}
                  <form action={handleMessage} className="mt-4 space-y-3">
                    <textarea name="message" required maxLength={1200} placeholder="Write your update or question for this matter" className="min-h-32 w-full rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/50" />
                    <button className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950">Send secure message</button>
                  </form>
                </Card>

                <Card>
                  <h3 className="text-sm font-semibold text-slate-100">Client acknowledgement / confirmation</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">This records that you understand uploads and confirmations are reviewed by your registered migration agent before use. It is not a standalone legal e-signature.</p>
                  {searchParams?.ack === "recorded" ? <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">Acknowledgement recorded.</p> : null}
                  <form action={handleAck} className="mt-4 space-y-3">
                    <input type="hidden" name="acknowledgementType" value="Portal information and document review acknowledgement" />
                    <label className="flex items-start gap-2 text-sm text-slate-300">
                      <input type="checkbox" name="acknowledgement" required className="mt-1" />
                      <span>I understand that information in this portal is for agent review and that Aria does not lodge applications or guarantee visa outcomes.</span>
                    </label>
                    <button className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white">Record acknowledgement</button>
                  </form>
                </Card>
              </div>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-slate-100">Next secure actions</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-slate-300">
                  <Link href={`/client/documents/${params.token}` as any} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
                    <p className="font-medium text-white">Upload documents</p>
                    <p className="mt-1 text-xs text-slate-500">Securely upload requested documents for this matter.</p>
                  </Link>
                  <Link href={`/client/intake/${params.token}` as any} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
                    <p className="font-medium text-white">Complete intake</p>
                    <p className="mt-1 text-xs text-slate-500">Update your details for agent review before use.</p>
                  </Link>
                  <Link href={`/client/book/${params.token}` as any} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]">
                    <p className="font-medium text-white">Request appointment</p>
                    <p className="mt-1 text-xs text-slate-500">Request a consultation or use configured appointment availability.</p>
                  </Link>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <p className="font-medium text-white">Review requests</p>
                    <p className="mt-1 text-xs text-slate-500">{matter.reviewRequests[0] ? `Latest review status: ${prettyStatus(matter.reviewRequests[0].status)}` : "Your migration team will send separate secure review links when confirmation is needed."}</p>
                  </div>
                </div>
              </Card>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-slate-100">Mobile reminders and notifications</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{mobileGuidance}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {notificationChannels.map((channel) => (
                    <div key={channel.channel} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{channel.label}</p>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300">{channel.status}</span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{channel.messageRule}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {matter.officialFormDrafts.length ? (
                <Card className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-100">Approved forms</h3>
                  <div className="mt-4 space-y-3">
                    {matter.officialFormDrafts.map((draft) => (
                      <a
                        key={draft.id}
                        href={`/api/forms/drafts/${draft.id}/download?portalToken=${params.token}`}
                        className="block rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:bg-white/[0.07]"
                      >
                        <p className="font-medium text-white">{draft.generatedFileName ?? "Approved PDF draft"}</p>
                        <p className="mt-1 text-xs text-slate-500">Approved by agent for client record/review. This system does not lodge applications.</p>
                      </a>
                    ))}
                  </div>
                </Card>
              ) : null}
            </>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No matter linked yet"
                description="Your migration team has not linked an active matter to this portal yet. Once it is linked, you will see checklist items, document requests, and review milestones here."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
