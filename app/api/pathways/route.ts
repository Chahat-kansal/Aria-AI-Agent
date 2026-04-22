import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { createPathwayAnalysis } from "@/lib/services/pathway-analysis";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().optional(),
  matterId: z.string().optional(),
  clientId: z.string().optional(),
  currentVisaStatus: z.string().optional(),
  age: z.coerce.number().int().min(0).max(100).optional(),
  occupation: z.string().optional(),
  anzscoCode: z.string().optional(),
  studyHistory: z.string().optional(),
  location: z.string().optional(),
  familyStatus: z.string().optional(),
  workExperience: z.string().optional(),
  englishLevel: z.string().optional(),
  employerSponsorship: z.string().optional(),
  residenceHistory: z.string().optional(),
  constraints: z.string().optional(),
  freeText: z.string().optional()
});

export async function POST(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  const parsed = schema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pathway analysis input." }, { status: 400 });
  }

  const input = parsed.data;
  let clientId = input.clientId;

  if (input.matterId) {
    const matter = await prisma.matter.findFirst({
      where: { id: input.matterId, workspaceId: context.workspace.id },
      select: { id: true, clientId: true }
    });
    if (!matter) return NextResponse.json({ error: "Matter not found for this workspace." }, { status: 404 });
    clientId = matter.clientId;
  } else if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, workspaceId: context.workspace.id }, select: { id: true } });
    if (!client) return NextResponse.json({ error: "Client not found for this workspace." }, { status: 404 });
  }

  const analysis = await createPathwayAnalysis({
    ...input,
    clientId,
    workspaceId: context.workspace.id,
    createdByUserId: context.user.id
  });

  return NextResponse.json({ analysis });
}
