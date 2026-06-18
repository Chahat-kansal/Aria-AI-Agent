import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createPortalAcknowledgement, createPortalMessage, getClientPortalByToken } from "@/lib/services/client-workflows";
import { getWorkspaceOperationalSettingsView } from "@/lib/services/workspace-operational-settings";
import { getPortalAcknowledgementRequestsByToken } from "@/lib/services/esign/client-acknowledgement";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildMobilePortalGuidance, buildNotificationSafetyView } from "@/lib/services/mobile-notification-safety";
import {
  cleanClientDescription,
  documentStatus,
  dueLabel,
  formatPortalStatus,
  PortalActionLink,
  PortalCard,
  PortalSectionHeading,
  PortalShell,
  PortalStatusBadge
} from "@/components/client-portal/portal-ui";

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

function nextActionForMatter(matter: NonNullable<Awaited<ReturnType<typeof getClientPortalByToken>>>["matter"]) {
  if (!matter) return "Wait for your migration team to link an active matter.";
  const missing = matter.checklistItems.filter((item) => !item.documentId && item.required);
  if (missing.length) return `Upload ${missing.length} outstanding document${missing.length === 1 ? "" : "s"}.`;
  const pending = matter.checklistItems.filter((item) => item.documentId && item.document?.reviewStatus !== "VERIFIED");
  if (pending.length) return "Your migration team is reviewing uploaded documents.";
  if (matter.reviewRequests.some((request) => request.status === "SENT_TO_CLIENT" || request.status === "VIEWED_BY_CLIENT")) {
    return "Complete the latest confirmation request from your migration team.";
  }
  return "No client action is currently required. Your migration team will contact you after agent review.";
}

function actionItems(matter: NonNullable<Awaited<ReturnType<typeof getClientPortalByToken>>>["matter"], token: string, pendingAcknowledgementCount: number) {
  if (!matter) return [];
  const missing = matter.checklistItems.filter((item) => !item.documentId && item.required);
  const pendingDocs = matter.checklistItems.filter((item) => item.documentId && item.document?.reviewStatus !== "VERIFIED");
  const pendingReviews = matter.reviewRequests.filter((request) => request.status === "SENT_TO_CLIENT" || request.status === "VIEWED_BY_CLIENT");
  const hasAppointment = matter.appointments.some((appointment) => appointment.status === "REQUESTED" || appointment.status === "CONFIRMED");
  const items = [
    ...(missing.length ? [{ title: "Upload missing documents", detail: `${missing.length} required item${missing.length === 1 ? "" : "s"} still needed.`, href: `/client/documents/${token}`, tone: "warning" as const }] : []),
    ...(pendingDocs.length ? [{ title: "Wait for document review", detail: `${pendingDocs.length} uploaded item${pendingDocs.length === 1 ? " is" : "s are"} being checked by your migration team.`, href: `/client/checklist/${token}`, tone: "info" as const }] : []),
    ...(pendingReviews.length || pendingAcknowledgementCount ? [{ title: "Confirm requested details", detail: "Your migration team has sent details for confirmation.", href: `/client/portal/${token}#confirmations`, tone: "warning" as const }] : []),
    ...(!hasAppointment ? [{ title: "Request an appointment", detail: "Choose a preferred time for a consultation or follow-up.", href: `/client/book/${token}`, tone: "neutral" as const }] : [])
  ];
  return items.length ? items : [{ title: "No action needed right now", detail: "Your migration team will contact you after review.", href: `/client/checklist/${token}`, tone: "success" as const }];
}

async function submitPortalMessage(token: string, formData: FormData) {
  "use server";
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const limit = checkRateLimit({ key: `portal.message:${ip}:${token.slice(0, 12)}`, limit: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) redirect(`/client/portal/${token}?message=rate-limited#messages`);
  const message = String(formData.get("message") || "");
  await createPortalMessage({ token, message });
  redirect(`/client/portal/${token}?message=sent#messages`);
}

async function submitPortalAcknowledgement(token: string, formData: FormData) {
  "use server";
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const limit = checkRateLimit({ key: `portal.acknowledgement:${ip}:${token.slice(0, 12)}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) redirect(`/client/portal/${token}?ack=rate-limited#confirmations`);
  const accepted = String(formData.get("acknowledgement") || "") === "on";
  const acknowledgementType = String(formData.get("acknowledgementType") || "Client portal acknowledgement");
  if (accepted) await createPortalAcknowledgement({ token, acknowledgementType });
  redirect(`/client/portal/${token}?ack=recorded#confirmations`);
}

function unavailable(title: string, description: string) {
  return (
    <PortalShell firmName="Aria Client Portal">
      <PortalCard className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Aria Client Portal</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      </PortalCard>
    </PortalShell>
  );
}

export default async function ClientPortalPage({ params, searchParams }: { params: { token: string }; searchParams?: { message?: string; ack?: string } }) {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const portalLimit = checkRateLimit({ key: `portal.open:${ip}:${params.token.slice(0, 12)}`, limit: 40, windowMs: 60_000 });
  if (!portalLimit.allowed) {
    return unavailable("Please wait and try again", "Too many portal attempts were made from this connection. Ask your migration team for help if this continues.");
  }

  const portal = await getClientPortalByToken(params.token);
  if (!portal) {
    return unavailable("Portal link unavailable", "This client portal link is invalid, expired, or has been replaced. Ask your migration team to send a fresh secure link.");
  }

  const settings = await getWorkspaceOperationalSettingsView(portal.workspaceId);
  const matter = portal.matter;
  const visibleTimelineEvents = (matter?.timelineEvents ?? []).filter((event) => visibleClientTimelineEvents.has(event.eventType));
  const missingItems = matter?.checklistItems.filter((item) => !item.documentId && item.required) ?? [];
  const uploadedItems = matter?.checklistItems.filter((item) => item.documentId) ?? [];
  const approvedItems = matter?.checklistItems.filter((item) => item.document?.reviewStatus === "VERIFIED" || item.reviewedAt) ?? [];
  const latestAppointment = matter?.appointments[0] ?? null;
  const confirmationEvents = visibleTimelineEvents.filter((event) => event.eventType === "portal.client_acknowledgement" || event.eventType.startsWith("client.review"));
  const acknowledgementRequests = await getPortalAcknowledgementRequestsByToken(params.token) ?? [];
  const pendingAcknowledgements = acknowledgementRequests.filter((item) => item.status !== "SUBMITTED" && item.status !== "REVOKED" && item.status !== "EXPIRED");
  const completedAcknowledgements = acknowledgementRequests.filter((item) => item.status === "SUBMITTED");
  const messageEvents = visibleTimelineEvents.filter((event) => event.eventType === "portal.client_message" || event.eventType === "documents.reminder_sent");
  const nextActions = actionItems(matter, params.token, pendingAcknowledgements.length);
  const handleMessage = submitPortalMessage.bind(null, params.token);
  const handleAck = submitPortalAcknowledgement.bind(null, params.token);
  const notificationChannels = buildNotificationSafetyView({
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
    smsConfigured: false,
    pushConfigured: false
  });
  const mobileGuidance = buildMobilePortalGuidance(missingItems.length);

  return (
    <PortalShell
      firmName={portal.workspace.name}
      clientName={`${portal.client.firstName} ${portal.client.lastName}`}
      matterTitle={matter?.title}
      subclass={matter?.visaSubclass}
    >
      {matter ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_390px]">
          <div className="space-y-6">
            <PortalCard>
              <PortalSectionHeading eyebrow="Next steps" title="What you need to do next" description="A simple list of the actions your migration team needs from you." />
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {nextActions.map((item) => (
                  <Link key={item.title} href={item.href as any} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-cyan-300/50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-600">{item.detail}</p>
                      </div>
                      <PortalStatusBadge tone={item.tone}>Open</PortalStatusBadge>
                    </div>
                  </Link>
                ))}
              </div>
            </PortalCard>

            <PortalCard>
              <PortalSectionHeading eyebrow="Documents" title="Document checklist" description="Upload clear copies only. Your migration team will review each document before use." />
              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">Mobile upload tip</p>
                <p className="mt-2 leading-6">
                  Use the upload page to take a photo, choose a file, see progress, and re-upload if your migration team asks for a clearer copy.
                </p>
              </div>
              <div className="mt-5 space-y-3">
                {matter.checklistItems.slice(0, 6).map((item) => {
                  const status = documentStatus(item);
                  return (
                    <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">{item.label}</p>
                          <p className="mt-1 text-xs text-slate-600">{item.category} - {item.required ? "Required" : "Recommended"}{item.dueDate ? ` - Due ${dueLabel(item.dueDate)}` : ""}</p>
                          {cleanClientDescription(item.description) ? <p className="mt-2 text-sm leading-5 text-slate-600">{cleanClientDescription(item.description)}</p> : null}
                          {item.document ? <p className="mt-2 text-xs text-slate-600">Uploaded: {item.document.fileName}</p> : null}
                        </div>
                        <PortalStatusBadge tone={status.tone}>{status.label}</PortalStatusBadge>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/client/documents/${params.token}` as any} className="rounded-2xl bg-violet-700 px-4 py-2 text-sm font-semibold text-[#fff]">Open mobile upload</Link>
                <Link href={`/client/checklist/${params.token}` as any} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-950">View full checklist</Link>
              </div>
            </PortalCard>

            <PortalCard id="messages">
              <PortalSectionHeading eyebrow="Messages" title="Message your migration team" description="Use this for short updates and questions. Upload attachments through the document area." />
              {searchParams?.message === "sent" ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Message sent.</p> : null}
              {searchParams?.message === "rate-limited" ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Please wait before sending another message.</p> : null}
              <div className="mt-5 space-y-3">
                {messageEvents.length ? messageEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className={`max-w-[92%] rounded-3xl border p-4 ${event.eventType === "portal.client_message" ? "ml-auto border-cyan-200/20 bg-cyan-200/10" : "border-slate-200 bg-slate-50"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">{event.eventType === "portal.client_message" ? "You" : "Migration team"}</p>
                      <p className="text-xs text-slate-500">{event.createdAt.toLocaleString("en-AU")}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-900">{event.description || event.title}</p>
                  </div>
                )) : <p className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No messages yet. Send an update if your migration team needs to know something.</p>}
              </div>
              <form action={handleMessage} className="mt-5 space-y-3">
                <textarea name="message" required maxLength={1200} placeholder="Write your update or question" className="min-h-28 w-full rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-950 placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600">Upload documents from the Documents section.</p>
                  <button className="rounded-2xl bg-violet-700 px-5 py-2 text-sm font-semibold text-[#fff]">Send message</button>
                </div>
              </form>
            </PortalCard>

            <PortalCard id="confirmations">
              <PortalSectionHeading eyebrow="Confirmations" title="Client acknowledgement / confirmation" description="Confirmations help your migration team check facts. They are reviewed before use." />
              {searchParams?.ack === "recorded" ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Acknowledgement recorded.</p> : null}
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">Portal information acknowledgement</p>
                    <PortalStatusBadge tone={confirmationEvents.length ? "success" : "warning"}>{confirmationEvents.length ? "Completed" : "Pending"}</PortalStatusBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Confirm that you understand uploaded information is checked by your migration agent before it is used.</p>
                  {confirmationEvents[0] ? <p className="mt-2 text-xs text-slate-500">Submitted {confirmationEvents[0].createdAt.toLocaleString("en-AU")}</p> : null}
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-950">Confirm contact and study details</p>
                    <PortalStatusBadge tone={pendingAcknowledgements.length ? "warning" : completedAcknowledgements.length ? "success" : "neutral"}>
                      {pendingAcknowledgements.length ? "Pending" : completedAcknowledgements.length ? "Completed" : "Not requested"}
                    </PortalStatusBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{pendingAcknowledgements.length ? "Your migration team has details waiting for confirmation." : completedAcknowledgements.length ? "You have already submitted a recent acknowledgement / confirmation." : "No separate confirmation is waiting right now."}</p>
                </div>
              </div>
              {pendingAcknowledgements.length ? (
                <div className="mt-5 space-y-3">
                  {pendingAcknowledgements.map((request) => (
                    <Link key={request.id} href={`/client/acknowledgements/token/${params.token}/${request.id}` as any} className="block rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-violet-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{request.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{request.definition?.clientNotice || request.safeSummary || "Client acknowledgement / confirmation request"}</p>
                        </div>
                        <PortalStatusBadge tone="warning">{request.status.replaceAll("_", " ")}</PortalStatusBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
              <form action={handleAck} className="mt-5 space-y-3">
                <input type="hidden" name="acknowledgementType" value="Portal information and document review acknowledgement" />
                <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <input type="checkbox" name="acknowledgement" required className="mt-1" />
                  <span>I understand that my migration agent will review this before use. This is not final lodgement.</span>
                </label>
                <button className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white/[0.12]">Record acknowledgement</button>
              </form>
            </PortalCard>

            <PortalCard>
              <PortalSectionHeading eyebrow="Timeline" title="Matter timeline" description="Client-facing milestones only. Internal notes and audit records are not shown here." />
              <div className="mt-5 space-y-3">
                {visibleTimelineEvents.length ? visibleTimelineEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <p className="text-xs text-slate-500">{event.createdAt.toLocaleString("en-AU")}</p>
                    <div>
                      <p className="font-semibold text-slate-950">{event.title}</p>
                      {event.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{event.description}</p> : null}
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-600">No client-facing timeline items have been recorded yet.</p>}
              </div>
            </PortalCard>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <PortalCard>
              <PortalSectionHeading title="Matter status" description={nextActionForMatter(matter)} />
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Progress</span>
                    <span className="font-semibold text-slate-950">{matter.readinessScore}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.max(0, Math.min(100, matter.readinessScore))}%` }} />
                  </div>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-600">Stage</dt>
                    <dd className="text-right font-medium text-slate-950">{formatPortalStatus(matter.stage)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-600">Documents</dt>
                    <dd className="text-right font-medium text-slate-950">{uploadedItems.length}/{matter.checklistItems.length} uploaded</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-600">Accepted</dt>
                    <dd className="text-right font-medium text-slate-950">{approvedItems.length}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-600">Appointment</dt>
                    <dd className="text-right font-medium text-slate-950">{latestAppointment ? formatPortalStatus(latestAppointment.status) : "Not requested"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-600">Assigned agent</dt>
                    <dd className="text-right font-medium text-slate-950">{matter.assignedToUser.name}</dd>
                  </div>
                </dl>
              </div>
            </PortalCard>

            <PortalCard>
              <PortalSectionHeading title="Open an area" />
              <div className="mt-4 space-y-3">
                <PortalActionLink href={`/client/documents/${params.token}`} title="Upload documents" description="Send clear scans or photos to your migration team." />
                <PortalActionLink href="#messages" title="Messages" description="Send a secure matter update." />
                <PortalActionLink href="#confirmations" title="Confirm details" description="Record client acknowledgement / confirmation." />
                <PortalActionLink href={`/client/book/${params.token}`} title="Book appointment" description="Request a consultation or follow-up." />
                <PortalActionLink href={`/client/checklist/${params.token}`} title="View requests" description="See the full document checklist." />
              </div>
            </PortalCard>

            <PortalCard>
              <PortalSectionHeading title="Reminders" description={mobileGuidance} />
              <div className="mt-4 space-y-3">
                {notificationChannels.map((channel) => (
                  <div key={channel.channel} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-950">{channel.label}</p>
                      <PortalStatusBadge tone={channel.status === "configured" ? "success" : "neutral"}>{channel.status}</PortalStatusBadge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{channel.messageRule}</p>
                  </div>
                ))}
              </div>
            </PortalCard>
          </aside>
        </div>
      ) : (
        <PortalCard>
          <PortalSectionHeading title="No matter linked yet" description="Your migration team has not linked an active matter to this portal yet." />
        </PortalCard>
      )}
    </PortalShell>
  );
}

