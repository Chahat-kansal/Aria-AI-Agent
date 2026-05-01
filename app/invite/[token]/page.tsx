import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AppPage } from "@/components/ui/app-page";
import { Card } from "@/components/ui/card";
import { getInviteByToken } from "@/lib/services/invites";

export default async function AcceptInvitePage({ params }: { params: { token: string } }) {
  const invite = await getInviteByToken(params.token);

  return (
    <AppPage contentClassName="flex min-h-screen items-center justify-center py-10">
      <Card className="w-full max-w-lg p-8 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">Aria staff invite</p>
        {invite ? (
          <>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">Join {invite.workspace.name}</h1>
            <p className="mt-3 text-base leading-7 text-slate-400">
              {invite.name}, set your password to activate your staff account. Aria is AI-assisted and all migration outputs remain review required.
            </p>
            <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              <p><span className="text-slate-500">Email:</span> {invite.email}</p>
              <p><span className="text-slate-500">Role:</span> {invite.role.replaceAll("_", " ").toLowerCase()}</p>
              <p><span className="text-slate-500">Workspace:</span> {invite.workspace.name}</p>
            </div>
            <AcceptInviteForm token={params.token} workspaceSlug={invite.workspace.slug} />
          </>
        ) : (
          <>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">Invite unavailable</h1>
            <p className="mt-3 text-base leading-7 text-slate-400">This invite link is invalid, expired, or has already been accepted. Ask your company owner or access administrator for a new invite.</p>
            <Link href="/auth/sign-in" className="mt-5 inline-flex h-10 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-100 transition hover:bg-white/[0.08]">
              Back to sign in
            </Link>
          </>
        )}
      </Card>
    </AppPage>
  );
}
