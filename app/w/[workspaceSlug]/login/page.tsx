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
    <AppPage contentClassName="flex min-h-screen items-center justify-center py-10">
      <Card className="w-full max-w-md p-8 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">Aria workspace portal</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">{workspace.name}</h1>
        <p className="mt-3 text-base leading-7 text-slate-400">Staff and agents sign in through your firm workspace portal. Public company owner signup stays separate from this workspace login.</p>
        <WorkspaceLoginForm workspaceSlug={workspace.slug} />
        <p className="mt-5 text-sm text-slate-400">
          Need access? Ask your company owner or access administrator to invite you.
        </p>
        <Link href="/auth/sign-in" className="mt-3 inline-flex text-sm text-cyan-300 hover:text-cyan-200">Use general sign in instead</Link>
      </Card>
    </AppPage>
  );
}
