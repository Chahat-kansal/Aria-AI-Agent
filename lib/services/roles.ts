import { UserRole, UserStatus, UserVisibilityScope, type Prisma, type User } from "@prisma/client";

export type RoleDefinition = {
  role: UserRole;
  label: string;
  category: "Business leadership" | "Access administration" | "Migration practice" | "Operations support";
  description: string;
};

export type PermissionKey =
  | "can_manage_team"
  | "can_access_ai"
  | "can_access_visa_knowledge"
  | "can_run_pathway_analysis"
  | "can_view_all_matters"
  | "can_edit_matters"
  | "can_run_cross_check"
  | "can_view_financial_data"
  | "can_access_update_monitor";

export type PermissionMap = Record<PermissionKey, boolean>;

export const permissionDefinitions: Array<{ key: PermissionKey; label: string; description: string }> = [
  { key: "can_manage_team", label: "Manage team", description: "Create, edit, deactivate, and configure staff access." },
  { key: "can_access_ai", label: "Access Aria AI", description: "Use the AI assistant, draft analysis, and AI-grounded workspace answers." },
  { key: "can_access_visa_knowledge", label: "Access visa knowledge", description: "Search and view source-linked visa knowledge records." },
  { key: "can_run_pathway_analysis", label: "Run pathway analysis", description: "Create AI-assisted PR/citizenship pathway analysis records." },
  { key: "can_view_all_matters", label: "View all matters", description: "See all matters and clients in the company workspace." },
  { key: "can_edit_matters", label: "Edit matters", description: "Create matters, upload documents, and update assigned matter workflows." },
  { key: "can_run_cross_check", label: "Run cross-checks", description: "Run final submission-readiness checks on accessible matters." },
  { key: "can_view_financial_data", label: "View financial data", description: "Access financial evidence and future financial/billing views." },
  { key: "can_access_update_monitor", label: "Access update monitor", description: "View official update monitoring and affected-matter alerts." }
];

const allPermissions: PermissionMap = permissionDefinitions.reduce((acc, item) => ({ ...acc, [item.key]: true }), {} as PermissionMap);

function falsePermissions(): PermissionMap {
  return permissionDefinitions.reduce((acc, item) => ({ ...acc, [item.key]: false }), {} as PermissionMap);
}

export const roleDefinitions: RoleDefinition[] = [
  { role: UserRole.COMPANY_OWNER, label: "Company Owner", category: "Business leadership", description: "Owns the company workspace, subscription, team access, and all migration operations." },
  { role: UserRole.COMPANY_ADMIN, label: "Company Admin", category: "Business leadership", description: "Manages firm operations and company-wide workflows, excluding owner-only decisions." },
  { role: UserRole.ORGANISATION_ACCESS_ADMIN, label: "Access Administrator", category: "Access administration", description: "Manages staff access, roles, activation, deactivation, and account support tasks." },
  { role: UserRole.PRINCIPAL_REGISTERED_MIGRATION_AGENT, label: "Principal Migration Agent", category: "Migration practice", description: "Provides senior practitioner oversight across migration workflows and team review queues." },
  { role: UserRole.SENIOR_MIGRATION_AGENT, label: "Senior Migration Agent", category: "Migration practice", description: "Handles assigned matters and can be granted team oversight or firm-wide visibility." },
  { role: UserRole.MIGRATION_AGENT, label: "Migration Agent", category: "Migration practice", description: "Works on assigned clients, matters, documents, draft applications, and review actions." },
  { role: UserRole.CASE_MANAGER, label: "Case Manager", category: "Operations support", description: "Coordinates assigned case preparation, document collection, and workflow follow-up." },
  { role: UserRole.ADMIN_ASSISTANT, label: "Admin Assistant", category: "Operations support", description: "Supports onboarding, file collection, scheduling, and assigned operational data." },
  { role: UserRole.CLIENT_REVIEW_COORDINATOR, label: "Client Review Coordinator", category: "Operations support", description: "Manages client review requests, returned items, and follow-up queues on assigned cases." }
];

export function roleLabel(role: UserRole) {
  return roleDefinitions.find((item) => item.role === role)?.label ?? role.replaceAll("_", " ").toLowerCase();
}

export function roleDescription(role: UserRole) {
  return roleDefinitions.find((item) => item.role === role)?.description ?? "Workspace user.";
}

export function defaultVisibilityScope(role: UserRole): UserVisibilityScope {
  const firmWideRoles: UserRole[] = [UserRole.COMPANY_OWNER, UserRole.COMPANY_ADMIN, UserRole.PRINCIPAL_REGISTERED_MIGRATION_AGENT];
  if (firmWideRoles.includes(role)) return UserVisibilityScope.FIRM_WIDE;
  if (role === UserRole.ORGANISATION_ACCESS_ADMIN) return UserVisibilityScope.TEAM_OVERSIGHT;
  return UserVisibilityScope.ASSIGNED_ONLY;
}

export function defaultPermissionsForRole(role: UserRole): PermissionMap {
  if (role === UserRole.COMPANY_OWNER) return { ...allPermissions };
  const base = { ...falsePermissions(), can_access_ai: true };

  const fullOperationalRoles: UserRole[] = [UserRole.COMPANY_ADMIN, UserRole.ORGANISATION_ACCESS_ADMIN];
  if (fullOperationalRoles.includes(role)) {
    return { ...allPermissions };
  }

  if (role === UserRole.PRINCIPAL_REGISTERED_MIGRATION_AGENT) {
    return { ...allPermissions, can_manage_team: false, can_view_financial_data: false };
  }

  if (role === UserRole.SENIOR_MIGRATION_AGENT) {
    return {
      ...base,
      can_access_visa_knowledge: true,
      can_run_pathway_analysis: true,
      can_edit_matters: true,
      can_run_cross_check: true,
      can_access_update_monitor: true
    };
  }

  if (role === UserRole.MIGRATION_AGENT) {
    return {
      ...base,
      can_access_visa_knowledge: true,
      can_run_pathway_analysis: true,
      can_edit_matters: true,
      can_run_cross_check: true,
      can_access_update_monitor: true
    };
  }

  if (role === UserRole.CASE_MANAGER) {
    return { ...base, can_edit_matters: true, can_access_update_monitor: true };
  }

  if (role === UserRole.CLIENT_REVIEW_COORDINATOR) {
    return { ...base, can_edit_matters: true };
  }

  if (role === UserRole.ADMIN_ASSISTANT) {
    return { ...base, can_edit_matters: true };
  }

  return base;
}

function parseStoredPermissions(value: Prisma.JsonValue | null | undefined): Partial<PermissionMap> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return permissionDefinitions.reduce((acc, permission) => {
    const explicit = record[permission.key];
    if (typeof explicit === "boolean") acc[permission.key] = explicit;
    return acc;
  }, {} as Partial<PermissionMap>);
}

export function getUserPermissions(user: Pick<User, "role" | "status" | "permissionsJson">): PermissionMap {
  if (user.status === UserStatus.DISABLED) return falsePermissions();
  if (user.role === UserRole.COMPANY_OWNER) return { ...allPermissions };
  return { ...defaultPermissionsForRole(user.role), ...parseStoredPermissions(user.permissionsJson) };
}

export function hasPermission(user: Pick<User, "role" | "status" | "permissionsJson">, permission: PermissionKey) {
  if (user.status !== UserStatus.DISABLED && user.role === UserRole.COMPANY_OWNER) return true;
  return getUserPermissions(user)[permission] === true;
}

export function serializePermissions(input: Partial<Record<string, unknown>>, role: UserRole): PermissionMap {
  const defaults = defaultPermissionsForRole(role);
  if (role === UserRole.COMPANY_OWNER) return { ...allPermissions };
  return permissionDefinitions.reduce((acc, permission) => {
    const value = input[permission.key];
    acc[permission.key] = typeof value === "boolean" ? value : defaults[permission.key];
    return acc;
  }, {} as PermissionMap);
}

export function canManageTeam(user: Pick<User, "role" | "status" | "permissionsJson">) {
  if (user.status === UserStatus.DISABLED) return false;
  if (user.role === UserRole.COMPANY_OWNER) return true;
  return hasPermission(user, "can_manage_team");
}

export function hasFirmWideAccess(user: Pick<User, "role" | "visibilityScope" | "status" | "permissionsJson">) {
  if (user.status === UserStatus.DISABLED) return false;
  if (user.role === UserRole.COMPANY_OWNER) return true;
  if (!hasPermission(user, "can_view_all_matters")) return false;
  const firmWideRoles: UserRole[] = [UserRole.COMPANY_OWNER, UserRole.COMPANY_ADMIN, UserRole.PRINCIPAL_REGISTERED_MIGRATION_AGENT];
  return user.visibilityScope === UserVisibilityScope.FIRM_WIDE || firmWideRoles.includes(user.role);
}

export function hasTeamOversight(user: Pick<User, "role" | "visibilityScope" | "status" | "permissionsJson">) {
  if (user.status === UserStatus.DISABLED) return false;
  return hasFirmWideAccess(user) || user.visibilityScope === UserVisibilityScope.TEAM_OVERSIGHT || user.role === UserRole.ORGANISATION_ACCESS_ADMIN;
}

export function scopedMatterWhere(user: Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">) {
  if (hasFirmWideAccess(user)) return { workspaceId: user.workspaceId };
  if (hasTeamOversight(user)) {
    return {
      workspaceId: user.workspaceId,
      OR: [{ assignedToUserId: user.id }, { assignedToUser: { supervisorId: user.id } }]
    };
  }
  return { workspaceId: user.workspaceId, assignedToUserId: user.id };
}

export function scopedClientWhere(user: Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">) {
  if (hasFirmWideAccess(user)) return { workspaceId: user.workspaceId };
  if (hasTeamOversight(user)) {
    return {
      workspaceId: user.workspaceId,
      OR: [{ assignedToUserId: user.id }, { assignedToUser: { supervisorId: user.id } }, { matters: { some: scopedMatterWhere(user) } }]
    };
  }
  return {
    workspaceId: user.workspaceId,
    OR: [{ assignedToUserId: user.id }, { matters: { some: { assignedToUserId: user.id } } }]
  };
}

export function canAccessMatter(user: Pick<User, "id" | "workspaceId" | "role" | "visibilityScope" | "status" | "permissionsJson">, matter: { workspaceId: string; assignedToUserId: string; assignedToUser?: { supervisorId: string | null } | null }) {
  if (matter.workspaceId !== user.workspaceId || user.status === UserStatus.DISABLED) return false;
  if (hasFirmWideAccess(user)) return true;
  if (matter.assignedToUserId === user.id) return true;
  return hasTeamOversight(user) && matter.assignedToUser?.supervisorId === user.id;
}
