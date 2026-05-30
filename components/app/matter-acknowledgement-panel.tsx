import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { decryptJson } from "@/lib/security/encryption";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { createAcknowledgementRequest, listMatterAcknowledgementRequests, resendAcknowledgementRequest, revokeAcknowledgementRequest } from "@/lib/services/esign/client-acknowledgement";
import { buildAcknowledgementDefinition, type AcknowledgementDefinition, type AcknowledgementRequestType, type SubmittedAcknowledgementPayload } from "@/lib/services/esign/esign-safety";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";

const requestTypes: Array<{ value: AcknowledgementRequestType; label: string }> = [
  { value: "PERSONAL_DETAILS", label: "Personal details" },
  { value: "HEALTH_CHARACTER", label: "Health / character" },
  { value: "RELATIONSHIP_INFORMATION", label: "Relationship information" },
  { value: "FINANCIAL_SUPPORT", label: "Financial / support" },
  { value: "DOCUMENT_REQUEST_DETAILS", label: "Document request details" },
  { value: "RETAINER_ACKNOWLEDGEMENT", label: "Retainer acknowledgement" },
  { value: "GENERAL_CONFIRMATION", label: "General confirmation" }
];

function requestTone(status: string) {
  if (status === "SUBMITTED") return "success";
  if (status === "REVOKED" || status === "EXPIRED" || status === "FAILED") return "danger";
  if (status === "VIEWED") return "info";
  return "warning";
}

export async function MatterAcknowledgementPanel({ matterId }: { matterId: string }) {
  const context = await requireCurrentWorkspaceContext();
  const workspace = await listMatterAcknowledgementRequests({
    workspaceId: context.workspace.id,
    matterId,
    user: context.user
  });
  if (!workspace) {
    return <p className="text-sm text-slate-400">You do not have permission to manage client acknowledgements for this matter.</p>;
  }

  const previewDefinitions = await Promise.all(
    requestTypes.map((item) => buildAcknowledgementDefinition({ matterId, requestType: item.value }))
  );

  async function createRequest(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    const requestType = String(formData.get("requestType") || "GENERAL_CONFIRMATION") as AcknowledgementRequestType;
    const title = String(formData.get("title") || "").trim();
    const customStatement = String(formData.get("customStatement") || "").trim();
    const notifyClient = String(formData.get("notifyClient") || "") === "on";
    const requestOrigin = (await headers()).get("origin");
    await createAcknowledgementRequest({
      workspaceId: context.workspace.id,
      matterId,
      requestedByUserId: context.user.id,
      requestType,
      title,
      customStatement,
      notifyClient,
      requestOrigin
    });
    revalidatePath(`/app/matters/${matterId}`);
    revalidatePath("/app/settings/integrations/esign");
    revalidatePath("/app/settings/integrations");
  }

  async function resendRequest(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    const requestId = String(formData.get("requestId") || "");
    const requestOrigin = (await headers()).get("origin");
    if (!requestId) return;
    await resendAcknowledgementRequest({
      workspaceId: context.workspace.id,
      requestId,
      userId: context.user.id,
      requestOrigin
    });
    revalidatePath(`/app/matters/${matterId}`);
    revalidatePath("/app/settings/integrations/esign");
  }

  async function revokeRequest(formData: FormData) {
    "use server";
    const context = await requireCurrentWorkspaceContext();
    const requestId = String(formData.get("requestId") || "");
    if (!requestId) return;
    await revokeAcknowledgementRequest({
      workspaceId: context.workspace.id,
      requestId,
      userId: context.user.id
    });
    revalidatePath(`/app/matters/${matterId}`);
    revalidatePath("/app/settings/integrations/esign");
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Create client acknowledgement / confirmation</h3>
            <p className="mt-1 text-sm text-slate-400">Clients confirm facts here. Your migration team reviews every response before it is used.</p>
          </div>
          <StatusPill tone={workspace.retainerTemplateConfigured ? "success" : "warning"}>
            {workspace.retainerTemplateConfigured ? "Retainer template available" : "Retainer template not configured"}
          </StatusPill>
        </div>
        <form action={createRequest} className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Request type</span>
            <select name="requestType" defaultValue="GENERAL_CONFIRMATION" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white">
              {requestTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Request title</span>
            <input name="title" placeholder="Optional custom title" className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white placeholder:text-slate-500" />
          </label>
          <label className="space-y-2 text-sm text-slate-300 lg:col-span-2">
            <span>Client-facing note</span>
            <textarea name="customStatement" rows={4} placeholder="Optional custom client-facing note. Keep it privacy-safe and factual." className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500" />
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300 lg:col-span-2">
            <input type="checkbox" name="notifyClient" className="mt-1" />
            <span>Send a secure portal reminder if email is configured. No sensitive declaration details are included in the notification.</span>
          </label>
          <div className="lg:col-span-2">
            <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 text-sm font-semibold text-white">
              Create request
            </button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {previewDefinitions.map((definition) => (
          <Card key={definition.requestType} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-white">{definition.title}</h4>
              <StatusPill tone={definition.requiresRetainerTemplate && !workspace.retainerTemplateConfigured ? "warning" : "info"}>
                {definition.requiresRetainerTemplate && !workspace.retainerTemplateConfigured ? "Not configured" : "Preview"}
              </StatusPill>
            </div>
            <p className="text-sm text-slate-300">{definition.clientNotice}</p>
            <ul className="space-y-2 text-xs leading-6 text-slate-400">
              {definition.prompts.slice(0, 3).map((prompt) => <li key={prompt.key}>{prompt.title}: {prompt.detail}</li>)}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Matter acknowledgement requests</h3>
            <p className="mt-1 text-sm text-slate-400">Responses stay review-required. High-impact answers create visible follow-up flags.</p>
          </div>
          <StatusPill tone={workspace.requests.length ? "info" : "neutral"}>{workspace.requests.length} request(s)</StatusPill>
        </div>
        <div className="space-y-3">
          {workspace.requests.length ? workspace.requests.map((request) => {
            const responsePayload = request.response?.responseJson
              ? decryptJson<SubmittedAcknowledgementPayload>(request.response.responseJson)
              : null;
            return (
              <div key={request.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{request.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{request.safeSummary || "Client acknowledgement / confirmation"}</p>
                    <p className="mt-2 text-xs text-slate-500">Requested by {request.requestedByUser.name || request.requestedByUser.email} on {request.createdAt.toLocaleString("en-AU")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone={requestTone(request.status)}>{request.status.replaceAll("_", " ")}</StatusPill>
                    <StatusPill tone={request.response?.reviewStatus === "FLAGGED" ? "warning" : "info"}>
                      {request.response?.reviewStatus?.replaceAll("_", " ") || "AGENT REVIEW REQUIRED"}
                    </StatusPill>
                  </div>
                </div>
                {responsePayload ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300">
                    <p className="font-medium text-white">Client response</p>
                    <p className="mt-2 text-xs text-slate-400">
                      Submitted {request.response?.submittedAt?.toLocaleString("en-AU")} · {responsePayload.answers.filter((item) => item.response === "needs_agent_follow_up").length} item(s) need follow-up
                    </p>
                    <ul className="mt-3 space-y-2">
                      {responsePayload.answers.slice(0, 4).map((answer) => (
                        <li key={answer.key}>
                          <span className="font-medium text-white">{answer.title}</span>: {answer.response === "confirmed" ? "Confirmed" : "Needs agent follow-up"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  {request.record ? (
                    <Link href={`/api/acknowledgements/${request.id}/record` as any} className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white">
                      Download record
                    </Link>
                  ) : null}
                  {request.status !== "REVOKED" ? (
                    <form action={revokeRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <button className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white">
                        Revoke
                      </button>
                    </form>
                  ) : null}
                  <form action={resendRequest}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <button className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white">
                      Resend
                    </button>
                  </form>
                </div>
              </div>
            );
          }) : <p className="text-sm text-slate-400">No acknowledgement requests have been created for this matter yet.</p>}
        </div>
      </Card>
    </div>
  );
}
