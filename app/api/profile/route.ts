import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export async function PATCH(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  const parsed = profileSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid profile name." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: context.user.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true, role: true }
  });

  return NextResponse.json({ user });
}
