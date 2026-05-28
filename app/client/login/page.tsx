import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { requestClientPortalLoginLink } from "@/lib/services/client-portal-session";
import { PortalCard, PortalSectionHeading, PortalShell } from "@/components/client-portal/portal-ui";

async function requestLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "");
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "unknown-ip";
  const limited = checkRateLimit({ key: `client.portal.login:${ip}:${email.toLowerCase()}`, limit: 6, windowMs: 10 * 60 * 1000 });
  if (!limited.allowed) redirect("/client/login?status=rate-limited");
  const result = await requestClientPortalLoginLink({ email, requestOrigin: headerStore.get("origin") || undefined });
  if (!result.emailConfigured) {
    redirect("/client/login?status=email-unavailable");
  }
  redirect("/client/login?status=sent");
}

export default function ClientLoginPage({ searchParams }: { searchParams?: { status?: string } }) {
  const status = searchParams?.status;
  return (
    <PortalShell firmName="Aria Client Portal">
      <div className="mx-auto max-w-2xl space-y-6">
        <PortalCard>
          <PortalSectionHeading
            eyebrow="Client access"
            title="Client portal login"
            description="Use your email address to request a secure sign-in link. Your migration team will review all information before use."
          />
          {status === "sent" ? <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">If that email matches an active client portal, a secure sign-in link has been sent.</p> : null}
          {status === "email-unavailable" ? <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Email is not configured. Contact your migration team for a secure invite link.</p> : null}
          {status === "rate-limited" ? <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Please wait before requesting another sign-in link.</p> : null}
          <form action={requestLink} className="mt-6 space-y-4">
            <label className="space-y-2 block">
              <span className="text-sm font-medium text-slate-800">Email address</span>
              <input name="email" type="email" required className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-cyan-300/30" placeholder="you@example.com" />
            </label>
            <button className="rounded-2xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white">Send secure sign-in link</button>
          </form>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
