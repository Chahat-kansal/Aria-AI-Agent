import { UserRole, UserStatus, UserVisibilityScope, WorkspacePlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultPermissionsForRole } from "@/lib/services/roles";
import { ensureClientPortalToken, getClientPortalByToken } from "@/lib/services/client-workflows";
import { maskPortalLink, requestClientPortalLoginLink } from "@/lib/services/client-portal-session";

type Check = {
  name: string;
  pass: boolean;
  detail?: string;
};

const WORKSPACE_SLUG = "aria-client-portal-auth-readiness";

async function upsertWorkspace() {
  return prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: "Aria Client Portal Auth Readiness", plan: WorkspacePlan.PRO },
    create: { name: "Aria Client Portal Auth Readiness", slug: WORKSPACE_SLUG, plan: WorkspacePlan.PRO }
  });
}

async function upsertAgent(workspaceId: string) {
  return prisma.user.upsert({
    where: { email: "portal-auth-agent@example.com" },
    update: {
      workspaceId,
      name: "Portal Auth Agent",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    },
    create: {
      workspaceId,
      name: "Portal Auth Agent",
      email: "portal-auth-agent@example.com",
      role: UserRole.MIGRATION_AGENT,
      status: UserStatus.ACTIVE,
      visibilityScope: UserVisibilityScope.ASSIGNED_ONLY,
      permissionsJson: defaultPermissionsForRole(UserRole.MIGRATION_AGENT),
      inviteAcceptedAt: new Date()
    }
  });
}

async function ensureClientAndMatter(workspaceId: string, assignedToUserId: string) {
  const client = await prisma.client.upsert({
    where: { clientReference: "PORTAL-AUTH-CLIENT" },
    update: {
      workspaceId,
      firstName: "Noah",
      lastName: "Rivera",
      email: "noah.rivera@example.com",
      phone: "0400000000",
      assignedToUserId
    },
    create: {
      workspaceId,
      clientReference: "PORTAL-AUTH-CLIENT",
      firstName: "Noah",
      lastName: "Rivera",
      email: "noah.rivera@example.com",
      phone: "0400000000",
      dob: new Date("1998-04-22T00:00:00.000Z"),
      nationality: "Test",
      assignedToUserId
    }
  });

  const matter = await prisma.matter.findFirst({
    where: { workspaceId, title: "Portal Auth Readiness Matter" }
  }) ?? await prisma.matter.create({
    data: {
      workspaceId,
      clientId: client.id,
      assignedToUserId,
      title: "Portal Auth Readiness Matter",
      visaSubclass: "500",
      visaStream: "Student",
      status: "IN_PROGRESS",
      stage: "EVIDENCE",
      readinessScore: 25
    }
  });

  return { client, matter };
}

async function main() {
  const checks: Check[] = [];
  const workspace = await upsertWorkspace();
  const agent = await upsertAgent(workspace.id);
  const { client, matter } = await ensureClientAndMatter(workspace.id, agent.id);

  const invite = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Client portal invite",
    createdByUserId: agent.id,
    requestOrigin: "https://aria.test"
  });

  const storedToken = await prisma.clientPortalAccessToken.findUniqueOrThrow({
    where: { id: invite.record.id }
  });
  checks.push({
    name: "Token is stored hashed only",
    pass: storedToken.tokenHash !== invite.token && storedToken.tokenHash.length > 20
  });
  checks.push({
    name: "Invite link uses activation route",
    pass: invite.url.includes("/client/activate/")
  });

  const maskedLink = maskPortalLink(invite.url);
  checks.push({
    name: "Masked link hides the raw token",
    pass: maskedLink !== invite.url && !maskedLink.includes(invite.token)
  });

  const portalView = await getClientPortalByToken(invite.token);
  checks.push({
    name: "Portal token opens only its scoped client and matter",
    pass: portalView?.clientId === client.id && portalView?.matterId === matter.id
  });
  checks.push({
    name: "Portal payload excludes token hash and raw storage URLs",
    pass: !/tokenHash|storageKey|signedUrl|publicUrl/i.test(JSON.stringify(portalView))
  });

  await prisma.clientPortalAccessToken.update({
    where: { id: invite.record.id },
    data: { revokedAt: new Date() }
  });
  const revokedView = await getClientPortalByToken(invite.token);
  checks.push({
    name: "Revoked invite fails cleanly",
    pass: revokedView === null
  });

  const expiredInvite = await ensureClientPortalToken({
    workspaceId: workspace.id,
    clientId: client.id,
    matterId: matter.id,
    label: "Expired portal invite",
    createdByUserId: agent.id,
    requestOrigin: "https://aria.test"
  });
  await prisma.clientPortalAccessToken.update({
    where: { id: expiredInvite.record.id },
    data: { expiresAt: new Date(Date.now() - 60_000) }
  });
  const expiredView = await getClientPortalByToken(expiredInvite.token);
  checks.push({
    name: "Expired invite fails cleanly",
    pass: expiredView === null
  });

  const loginResult = await requestClientPortalLoginLink({
    email: client.email!,
    requestOrigin: "https://aria.test"
  });
  checks.push({
    name: "Separate client login flow exists",
    pass: typeof loginResult.reason === "string" && typeof loginResult.emailConfigured === "boolean"
  });

  const missingEmailResult = await requestClientPortalLoginLink({
    email: "missing-client@example.com",
    requestOrigin: "https://aria.test"
  });
  checks.push({
    name: "Unknown email response is generic and safe",
    pass: /active client portal|secure sign-in link/i.test(missingEmailResult.reason)
  });

  const failed = checks.filter((check) => !check.pass);
  console.log(JSON.stringify({
    pass: failed.length === 0,
    workspace: workspace.slug,
    matterId: matter.id,
    checks,
    failed: failed.map((check) => check.name)
  }, null, 2));
  if (failed.length) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
