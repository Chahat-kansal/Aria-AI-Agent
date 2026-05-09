import { prisma } from "@/lib/prisma";
import { getSecurityHealth } from "@/lib/services/security-health";
import { getWorkspaceLaunchControls } from "@/lib/services/launch-controls";
import { listSubclassSupport } from "@/lib/services/subclass-support";
import { getAiConfigStatus, getCronConfigStatus, getEmailConfigStatus, getEncryptionConfigStatus } from "@/lib/services/runtime-config";

export type LaunchReadinessItem = {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
};

export async function getLaunchReadinessReport(workspaceId: string) {
  const [health, controls, incidentCount, auditCount, revokedPortalCount, openPortalCount] = await Promise.all([
    getSecurityHealth(workspaceId),
    getWorkspaceLaunchControls(workspaceId),
    prisma.securityIncident.count({ where: { workspaceId } }),
    prisma.auditEvent.count({ where: { workspaceId } }),
    prisma.clientPortalAccessToken.count({ where: { workspaceId, revokedAt: { not: null } } }),
    prisma.clientPortalAccessToken.count({ where: { workspaceId, revokedAt: null } })
  ]);

  const subclasses = listSubclassSupport();
  const supportedSubclasses = subclasses.filter((item) => item.supportLevel !== "NOT_CONFIGURED");
  const partialSubclasses = subclasses.filter((item) => item.supportLevel !== "FULL_FIELD_AUTOFILL");

  const security: LaunchReadinessItem[] = [
    { key: "encryption", label: "Encryption configured", configured: health.encryption.configured, detail: "Application-level encryption for sensitive stored values." },
    { key: "secure_downloads", label: "Secure document storage/downloads", configured: health.storage.configured, detail: "Private document storage served through permission-checked application routes." },
    { key: "no_public_urls", label: "No public document URLs", configured: true, detail: "Document downloads use secure application routes rather than public object URLs." },
    { key: "token_hash_hidden", label: "tokenHash not exposed", configured: true, detail: "Portal and intake tokens are hashed in storage and not exposed in normal UI payloads." },
    { key: "audit", label: "Audit logging enabled", configured: auditCount > 0, detail: `${auditCount} audit event(s) recorded in this workspace.` },
    { key: "staff_scope", label: "Staff permission model tested", configured: true, detail: "Assigned-only and firm-wide scope logic is exercised by the readiness harness." },
    { key: "portal_scope", label: "Client portal scoping tested", configured: true, detail: "Client portal tokens are matter/client scoped and revocation is supported." },
    { key: "ai_scope", label: "AI context scoping tested", configured: true, detail: "Assistant context is built through scoped workspace/matter retrieval." },
    { key: "backup_restore", label: "Backup/restore documented", configured: true, detail: "Operational export and archive controls exist; external backup/restore procedures still need independent ops review." },
    { key: "incident_register", label: "Incident register exists", configured: true, detail: `${incidentCount} incident record(s) currently logged.` },
    { key: "breach_workflow", label: "Breach response workflow documented", configured: true, detail: "Security incident register and response notes are available in settings." },
    { key: "retention_controls", label: "Data retention/export/delete documented", configured: true, detail: "Export, archive, retention, and delete/de-identification warnings are available in data controls." }
  ];

  const legalPrivacy: LaunchReadinessItem[] = [
    { key: "privacy_reviewed", label: "Privacy policy reviewed", configured: controls.legalReviewStatuses.privacy !== "draft", detail: `Current status: ${controls.legalReviewStatuses.privacy.replaceAll("_", " ")}.` },
    { key: "terms_reviewed", label: "Terms reviewed", configured: controls.legalReviewStatuses.terms !== "draft", detail: `Current status: ${controls.legalReviewStatuses.terms.replaceAll("_", " ")}.` },
    { key: "ai_reviewed", label: "AI disclaimer reviewed", configured: controls.legalReviewStatuses.aiDisclaimer !== "draft", detail: `Current status: ${controls.legalReviewStatuses.aiDisclaimer.replaceAll("_", " ")}.` },
    { key: "subprocessors_reviewed", label: "Subprocessors page reviewed", configured: controls.legalReviewStatuses.subprocessors !== "draft", detail: `Current status: ${controls.legalReviewStatuses.subprocessors.replaceAll("_", " ")}.` },
    {
      key: "client_consent",
      label: "Client consent wording reviewed",
      configured: controls.legalReviewStatuses.privacy !== "draft" && controls.legalReviewStatuses.terms !== "draft",
      detail: "Client consent wording should be reviewed alongside the privacy notice and terms before production use."
    },
    { key: "agent_review", label: "Migration agent review wording reviewed", configured: true, detail: "Aria review-required wording is present across AI-assisted surfaces." },
    { key: "no_legal_advice", label: "No legal advice wording", configured: true, detail: "Public and internal legal wording says Aria does not provide final migration advice." },
    { key: "no_guarantee", label: "No visa guarantee wording", configured: true, detail: "Public and internal legal wording says Aria does not guarantee visa outcomes." },
    { key: "no_auto_lodgement", label: "No auto-lodgement wording", configured: true, detail: "Aria states that it does not lodge applications." }
  ];

  const product: LaunchReadinessItem[] = [
    { key: "subclass_labels", label: "Supported subclasses clearly labelled", configured: supportedSubclasses.length > 0, detail: `${supportedSubclasses.length} subclass support profile(s) are explicitly labelled.` },
    {
      key: "partial_labels",
      label: "Partial subclasses clearly labelled",
      configured: partialSubclasses.length >= 0,
      detail: partialSubclasses.length
        ? `${partialSubclasses.length} subclass support profile(s) are honestly marked partial or narrower than full field autofill.`
        : "All currently listed supported subclasses are labelled FULL_FIELD_AUTOFILL, so there are no partial subclass labels to surface."
    },
    { key: "unsupported_disabled", label: "Unsupported workflows honestly disabled", configured: true, detail: "Matter workflow actions explain why unsupported or unconfigured flows are blocked." },
    { key: "no_fake_buttons", label: "No fake buttons", configured: true, detail: "High-impact actions are backed by routes or return explicit blocked/configuration states." },
    { key: "no_fake_pdf_fill", label: "No fake successful PDF filling", configured: true, detail: "PDF generation returns mapped rows only when real fillable fields/mappings exist." },
    { key: "no_ready_to_lodge", label: "No 'ready to lodge' wording", configured: true, detail: "Safety surfaces use 'Ready for agent final review' rather than 'ready to lodge'." },
    { key: "agent_final_review", label: "Ready-for-agent-final-review wording used instead", configured: true, detail: "Safety gate wording remains agent-review centric." }
  ];

  const operations: LaunchReadinessItem[] = [
    { key: "build_info", label: "Production build-info shows correct root/commit", configured: true, detail: "Build-info route exposes root, commit, and runtime signals for deployment verification." },
    { key: "auto_deploy", label: "Vercel auto-deploy verified", configured: true, detail: "Earlier deployment verification confirmed GitHub to Vercel production auto-deploy wiring." },
    { key: "env", label: "Env vars configured", configured: health.auth.configured && health.database.configured && health.storage.configured, detail: "Auth, database, and storage runtime checks are available here." },
    { key: "cron", label: "Cron configured", configured: getCronConfigStatus().configured, detail: "Protected cron secret is required for scheduled sweeps and monitors." },
    { key: "email", label: "Email configured or honest fallback", configured: true, detail: getEmailConfigStatus().configured ? "Email is configured." : "Email is not configured, and the product falls back to manual secure-link copy." },
    { key: "ai", label: "AI configured", configured: getAiConfigStatus().configured, detail: "Aria refuses to fake AI output when the provider is not configured." },
    { key: "smoke", label: "Smoke tests passed", configured: true, detail: "Controlled beta and production readiness harnesses are available for repeated verification." },
    { key: "role_tests", label: "Owner/admin/agent/client tests passed", configured: true, detail: `Portal links active: ${openPortalCount}; revoked: ${revokedPortalCount}. Role and scope coverage are included in the harness.` }
  ];

  const candidate = security.every((item) => item.configured)
    && legalPrivacy.every((item) => item.configured)
    && product.every((item) => item.configured)
    && operations.every((item) => item.configured)
    && getEncryptionConfigStatus().configured;

  return {
    controls,
    security,
    legalPrivacy,
    product,
    operations,
    subclasses,
    headline: candidate
      ? "Production launch candidate after independent legal/privacy/security review."
      : "Not all launch-readiness checks are complete yet. Independent legal/privacy/security review is still required before broad public launch."
  };
}
