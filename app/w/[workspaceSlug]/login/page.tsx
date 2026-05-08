import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceLoginForm } from "@/components/auth/workspace-login-form";
import { AppPage } from "@/components/ui/app-page";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceLoginPage({ params }: { params: { workspaceSlug: string } }) {
  const workspace = await prisma.workspace.findUnique({ where: { slug: params.workspaceSlug } });
  if (!workspace) notFound();

  return (
    <AppPage contentClassName="flex min-h-full items-center justify-center py-10">
      <Card className="w-full max-w-md p-8 sm:p-10">
        <div className="themed-logo-mark flex h-12 w-12 items-center justify-center rounded-[1rem] text-white">A</div>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.24em] text-[color:var(--accent)]">Aria workspace portal</p>
        <h1 className="page-title-display mt-4 text-[3rem] leading-none text-[color:var(--text-strong)]">{workspace.name}</h1>
        <p className="mt-4 text-base leading-8 text-[color:var(--text-muted)]">Staff and agents sign in through your firm workspace portal. Public company owner signup stays separate from this workspace login.</p>
        <WorkspaceLoginForm workspaceSlug={workspace.slug} />
        <p className="mt-5 text-sm text-[color:var(--text-muted)]">
          Need access? Ask your company owner or access administrator to invite you.
        </p>
        <Link href="/auth/sign-in" className="mt-3 inline-flex text-sm text-[color:var(--accent)] hover:opacity-80">Use general sign in instead</Link>
      </Card>
    </AppPage>
  );
}
