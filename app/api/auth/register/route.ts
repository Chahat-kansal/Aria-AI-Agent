import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Valid work email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  workspaceName: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(2).optional()
  ),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().optional(),
  timezone: z.string().trim().optional(),
  businessType: z.string().trim().optional(),
  addressLine1: z.string().trim().optional()
});

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  return slug || "workspace";
}

async function uniqueWorkspaceSlug(name: string) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;

  while (await prisma.workspace.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid registration details" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (existingUser) {
    return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
  }

  const workspaceName = parsed.data.workspaceName?.trim() || `${parsed.data.name}'s practice`;
  const workspaceSlug = await uniqueWorkspaceSlug(workspaceName);
  const hashedPassword = await hash(parsed.data.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: workspaceName,
        legalName: workspaceName,
        slug: workspaceSlug,
        plan: WorkspacePlan.STARTER,
        contactEmail: parsed.data.contactEmail || email,
        contactPhone: parsed.data.contactPhone || null,
        timezone: parsed.data.timezone || "Australia/Sydney",
        businessType: parsed.data.businessType || "Migration firm",
        addressLine1: parsed.data.addressLine1 || null
      }
    });

    return tx.user.create({
      data: {
        name: parsed.data.name,
        email,
        hashedPassword,
        role: UserRole.COMPANY_OWNER,
        visibilityScope: UserVisibilityScope.FIRM_WIDE,
        permissionsJson: defaultPermissionsForRole(UserRole.COMPANY_OWNER),
        workspaceId: workspace.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        workspaceId: true
      }
    });
  });

  return NextResponse.json({ user }, { status: 201 });
}
