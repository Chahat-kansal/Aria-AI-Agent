import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceLoginForm } from "@/components/auth/workspace-login-form";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceLoginPage({ params }: { params: { workspaceSlug: string } }) {
  const workspace = await prisma.workspace.findUnique({ where: { slug: params.workspaceSlug } });
  if (!workspace) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Aria workspace portal</p>
        <h1 className="mt-2 text-2xl font-semibold">{workspace.name}</h1>
        <p className="mt-2 text-sm text-muted">Staff sign in for AI-assisted migration operations. Public company setup is separate from this workspace portal.</p>
        <WorkspaceLoginForm workspaceSlug={workspace.slug} />
        <p className="mt-4 text-sm text-muted">
          Need access? Ask your company owner or access administrator to invite you.
        </p>
        <Link href="/auth/sign-in" className="mt-3 inline-flex text-sm text-accent">Use general sign in instead</Link>
      </div>
    </div>
  );
}
