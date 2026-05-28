import { redirect } from "next/navigation";
import { buildClientLink } from "@/lib/services/client-workflows";
import { getClientPortalByToken } from "@/lib/services/client-workflows";
import { setClientPortalSessionFromToken } from "@/lib/services/client-portal-session";
import { PortalCard, PortalSectionHeading, PortalShell } from "@/components/client-portal/portal-ui";

async function activate(token: string) {
  "use server";
  const portal = await setClientPortalSessionFromToken(token);
  if (!portal) redirect(buildClientLink("/client/activate", token));
  redirect("/client/portal");
}

export default async function ClientActivatePage({ params }: { params: { token: string } }) {
  const portal = await getClientPortalByToken(params.token);
  if (!portal) {
    return (
      <PortalShell firmName="Aria Client Portal">
        <div className="mx-auto max-w-2xl">
          <PortalCard>
            <PortalSectionHeading title="Invite unavailable" description="This secure invite is invalid, expired, or has been replaced. Ask your migration team for a fresh invite." />
          </PortalCard>
        </div>
      </PortalShell>
    );
  }

  const activateAction = activate.bind(null, params.token);
  return (
    <PortalShell firmName={portal.workspace.name} clientName={`${portal.client.firstName} ${portal.client.lastName}`} matterTitle={portal.matter?.title} subclass={portal.matter?.visaSubclass}>
      <div className="mx-auto max-w-2xl space-y-6">
        <PortalCard>
          <PortalSectionHeading
            eyebrow="Secure invite"
            title="Activate your client portal"
            description="This secure portal gives you access only to your own matter, messages, appointments, and document requests."
          />
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p><span className="font-semibold text-slate-950">Client:</span> {portal.client.firstName} {portal.client.lastName}</p>
            <p className="mt-1"><span className="font-semibold text-slate-950">Matter:</span> {portal.matter?.title || "Linked matter"}</p>
            <p className="mt-1"><span className="font-semibold text-slate-950">Expires:</span> {portal.expiresAt.toLocaleString("en-AU")}</p>
          </div>
          <form action={activateAction} className="mt-6 space-y-4">
            <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <input type="checkbox" required className="mt-1" />
              <span>I understand that my migration team will review all information before use. This is not final lodgement.</span>
            </label>
            <button className="rounded-2xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white">Activate client portal</button>
          </form>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
