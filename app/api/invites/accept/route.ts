import { NextResponse } from "next/server";
import { z } from "zod";
import { acceptInvite } from "@/lib/services/invites";
import { serverLog } from "@/lib/services/runtime-config";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Valid invite token and password are required." }, { status: 400 });

    const user = await acceptInvite(parsed.data);
    if (!user) return NextResponse.json({ error: "Invite is invalid, expired, or already accepted." }, { status: 400 });

    return NextResponse.json({ status: "accepted", workspaceSlug: user.workspace.slug });
  } catch (error) {
    serverLog("invite.accept_error", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Invite could not be accepted right now." }, { status: 500 });
  }
}
