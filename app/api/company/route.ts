import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { prisma } from "@/lib/prisma";

const optionalText = z.string().trim().max(240).optional().transform((value) => value || null);

const companySchema = z.object({
  name: z.string().trim().min(1).max(160),
  legalName: optionalText,
  businessType: optionalText,
  registrationNumber: optionalText,
  contactEmail: z.string().trim().email().optional().or(z.literal("")).transform((value) => value || null),
  contactPhone: optionalText,
  website: z.string().trim().url().optional().or(z.literal("")).transform((value) => value || null),
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  state: optionalText,
  postalCode: optionalText,
  country: optionalText,
  timezone: z.string().trim().min(1).max(80),
  logoUrl: z.string().trim().url().optional().or(z.literal("")).transform((value) => value || null),
  brandColor: optionalText
});

export async function PATCH(req: Request) {
  const context = await requireCurrentWorkspaceContext();
  const parsed = companySchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Check the company profile fields and try again." }, { status: 400 });
  }

  const workspace = await prisma.workspace.update({
    where: { id: context.workspace.id },
    data: parsed.data
  });

  return NextResponse.json({ workspace });
}
