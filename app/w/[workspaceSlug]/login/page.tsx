import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceLoginForm } from "@/components/auth/workspace-login-form";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceLoginPage({ params }: { params: { workspaceSlug: string } }) {
  const workspace = await prisma.workspace.findUnique({ where: { slug: params.workspaceSlug } });
  if (!workspace) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.16),transparent_32%),linear-gradient(135deg,#08111F,#0D1B2E_45%,#111827)] p-6">
      <div className="w-full max-w-md rounded-4xl border border-white/10 bg-slate-950/65 p-8 shadow-glass backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Aria workspace portal</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">{workspace.name}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Staff sign in for AI-assisted migration operations. Public company setup is separate from this workspace portal.</p>
        <WorkspaceLoginForm workspaceSlug={workspace.slug} />
        <p className="mt-4 text-sm text-slate-400">
          Need access? Ask your company owner or access administrator to invite you.
        </p>
        <Link href="/auth/sign-in" className="mt-3 inline-flex text-sm text-cyan-300 hover:text-cyan-200">Use general sign in instead</Link>
      </div>
    </div>
  );
}
