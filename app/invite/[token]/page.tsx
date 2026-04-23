import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { getInviteByToken } from "@/lib/services/invites";

export default async function AcceptInvitePage({ params }: { params: { token: string } }) {
  const invite = await getInviteByToken(params.token);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-lg p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria staff invite</p>
        {invite ? (
          <>
            <h1 className="mt-2 text-2xl font-semibold">Join {invite.workspace.name}</h1>
            <p className="mt-2 text-sm text-muted">
              {invite.name}, set your password to activate your staff account. Aria is AI-assisted and all migration outputs remain review required.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-white/55 p-3 text-sm">
              <p><span className="text-muted">Email:</span> {invite.email}</p>
              <p><span className="text-muted">Role:</span> {invite.role.replaceAll("_", " ").toLowerCase()}</p>
              <p><span className="text-muted">Workspace:</span> {invite.workspace.name}</p>
            </div>
            <AcceptInviteForm token={params.token} workspaceSlug={invite.workspace.slug} />
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-semibold">Invite unavailable</h1>
            <p className="mt-2 text-sm text-muted">This invite link is invalid, expired, or has already been accepted. Ask your company owner or access administrator for a new invite.</p>
            <Link href="/auth/sign-in" className="mt-5 inline-flex rounded-lg border border-border px-4 py-2 text-sm text-accent">Back to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
