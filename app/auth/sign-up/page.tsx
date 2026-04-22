import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-muted">Set up your migration practice workspace.</p>
        <div className="mt-6 space-y-3">
          <input className="w-full rounded-lg border border-border bg-[#0d1728] p-2" placeholder="Full name" />
          <input className="w-full rounded-lg border border-border bg-[#0d1728] p-2" placeholder="Work email" />
          <input className="w-full rounded-lg border border-border bg-[#0d1728] p-2" placeholder="Password" type="password" />
          <Link href="/app/overview"><Button className="w-full">Create workspace</Button></Link>
        </div>
      </div>
    </div>
  );
}
