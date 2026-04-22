import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Access your workspace to continue AI-assisted review workflows.</p>
        <div className="mt-6 space-y-3">
          <input className="w-full rounded-lg border border-border bg-[#0d1728] p-2" placeholder="Email" />
          <input className="w-full rounded-lg border border-border bg-[#0d1728] p-2" placeholder="Password" type="password" />
          <Link href="/app/overview"><Button className="w-full">Sign in</Button></Link>
        </div>
        <p className="mt-4 text-sm text-muted">No account? <Link href="/auth/sign-up" className="text-accent">Create one</Link></p>
      </div>
    </div>
  );
}
