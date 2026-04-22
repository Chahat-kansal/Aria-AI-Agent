import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
  const session = cookies().get("aria_session")?.value;

  if (!demoMode && !session) {
    redirect("/auth/sign-in");
  }

  return children;
}
