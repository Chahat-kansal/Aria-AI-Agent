import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientPortalByToken } from "@/lib/services/client-workflows";
import { getPortalAcknowledgementRequestByToken, markAcknowledgementViewed, submitAcknowledgementByToken } from "@/lib/services/esign/client-acknowledgement";
import { PortalCard, PortalSectionHeading, PortalShell, PortalStatusBadge } from "@/components/client-portal/portal-ui";

async function submitRequest(token: string, requestId: string, formData: FormData) {
  "use server";
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const userAgent = headerStore.get("user-agent");
  const limit = checkRateLimit({ key: `portal.acknowledgement.request:${ip}:${requestId}:${token.slice(0, 12)}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) redirect(`/client/acknowledgements/token/${token}/${requestId}?error=rate-limited`);
  try {
    await submitAcknowledgementByToken({
      token,
      requestId,
      formData,
      clientIp: ip,
      userAgent
    });
    redirect(`/client/acknowledgements/token/${token}/${requestId}?submitted=1`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit acknowledgement.";
    redirect(`/client/acknowledgements/token/${token}/${requestId}?error=${encodeURIComponent(message)}`);
  }
}

export default async function ClientAcknowledgementTokenPage({
  params,
  searchParams
}: {
  params: { token: string; requestId: string };
  searchParams?: { submitted?: string; error?: string };
}) {
  const portal = await getClientPortalByToken(params.token);
  if (!portal) notFound();
  const request = await getPortalAcknowledgementRequestByToken(params.token, params.requestId);
  if (!request?.definition) notFound();
  await markAcknowledgementViewed({ token: params.token, requestId: request.id }).catch(() => null);
  const handleSubmit = submitRequest.bind(null, params.token, request.id);

  return (
    <PortalShell firmName={portal.workspace.name} clientName={`${portal.client.firstName} ${portal.client.lastName}`} matterTitle={portal.matter?.title} subclass={portal.matter?.visaSubclass}>
      <div className="mx-auto max-w-4xl space-y-6">
        <PortalCard>
          <PortalSectionHeading eyebrow="Acknowledgement" title={request.title} description="Your migration team will review this before use. This confirmation does not lodge an application." />
          <div className="mt-5 flex flex-wrap gap-3">
            <PortalStatusBadge tone={request.status === "SUBMITTED" ? "success" : request.status === "VIEWED" ? "info" : "warning"}>{request.status.replaceAll("_", " ")}</PortalStatusBadge>
            <PortalStatusBadge tone="info">Agent review required</PortalStatusBadge>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{request.definition.clientNotice}</p>
          {searchParams?.submitted === "1" ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Acknowledgement submitted. Your migration team will review this before use.</p> : null}
          {searchParams?.error ? <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{decodeURIComponent(searchParams.error)}</p> : null}
        </PortalCard>

        <PortalCard>
          <form action={handleSubmit} className="space-y-5">
            {request.definition.prompts.map((prompt) => (
              <div key={prompt.key} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{prompt.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{prompt.detail}</p>
                  </div>
                  <PortalStatusBadge tone={prompt.highImpact ? "warning" : "info"}>{prompt.highImpact ? "Review-sensitive" : "Confirmation"}</PortalStatusBadge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <input type="radio" name={`response__${prompt.key}`} value="confirmed" defaultChecked className="mt-1" />
                    <span>Confirmed. Please tell your migration team if anything changes.</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <input type="radio" name={`response__${prompt.key}`} value="needs_agent_follow_up" className="mt-1" />
                    <span>This needs migration agent follow-up before use.</span>
                  </label>
                </div>
                <textarea name={`detail__${prompt.key}`} rows={3} placeholder="Add any correction or clarification for your migration team." className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-500" />
              </div>
            ))}

            <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <input type="checkbox" name="statementAccepted" required className="mt-1" />
              <span>I understand that my migration team will review this before use. This confirmation does not lodge an application. I will contact my migration agent if anything is incorrect.</span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href={`/client/portal/${params.token}` as any} className="text-sm font-medium text-violet-700 hover:text-violet-900">Back to portal</Link>
              <button className="rounded-2xl bg-violet-700 px-5 py-2 text-sm font-semibold text-white">Submit acknowledgement</button>
            </div>
          </form>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
