import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import { auditAccessDenied } from "@/lib/services/audit";
import { hasFirmWideAccess, hasPermission, scopedMatterWhere } from "@/lib/services/roles";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const canViewUpdates =
    context.user.role === "COMPANY_OWNER" ||
    context.user.role === "COMPANY_ADMIN" ||
    hasPermission(context.user, "can_access_update_monitor");
  const canViewAllIntel = hasFirmWideAccess(context.user);

  if (!canViewUpdates) {
    await auditAccessDenied({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      entityType: "OfficialUpdate",
      reason: "Migration intelligence listing denied by permission."
    });
    return NextResponse.json({ error: "You do not have permission to view migration intelligence." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get("severity");
  const sourceType = searchParams.get("sourceType");
  const reviewed = searchParams.get("reviewed");
  const subclass = searchParams.get("subclass");
  const q = searchParams.get("q");

  const visibleWhere: Prisma.OfficialUpdateWhereInput = {
    AND: [
      {
        isArchived: false,
        OR: [{ workspaceId: null }, { workspaceId: context.workspace.id }]
      },
      {
        OR: canViewAllIntel
          ? [{ workspaceId: context.workspace.id }, { workspaceId: null }]
          : [
              { workspaceId: context.workspace.id },
              { workspaceId: null, impacts: { some: { matter: scopedMatterWhere(context.user) } } },
              { workspaceId: null, sourceType: "OFFICIAL" as any }
            ]
      },
      severity && severity !== "ALL" ? { severity: severity as any } : {},
      sourceType && sourceType !== "ALL" ? { sourceType: sourceType as any } : {},
      reviewed === "true" ? { reviewedAt: { not: null } } : {},
      reviewed === "false" ? { reviewedAt: null } : {},
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
              { source: { contains: q, mode: "insensitive" } }
            ]
          }
        : {}
    ]
  };

  const items = await prisma.officialUpdate.findMany({
    where: visibleWhere,
    include: {
      reviewedByUser: true,
      impacts: {
        where: { matter: scopedMatterWhere(context.user) },
        include: { matter: { include: { client: true } } }
      }
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 100
  });

  const filteredItems = subclass
    ? items.filter((item) =>
        Array.isArray(item.affectedSubclassesJson)
          ? item.affectedSubclassesJson.map(String).some((value) => value.toLowerCase().includes(subclass.toLowerCase()))
          : false
      )
    : items;

  return NextResponse.json({ ok: true, items: filteredItems });
}
