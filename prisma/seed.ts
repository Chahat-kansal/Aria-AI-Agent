import { PrismaClient, WorkspacePlan, UserRole, MatterStatus, MatterStage, ExtractionStatus, ReviewStatus, FieldStatus, IssueSeverity, ResolutionStatus, ImpactLevel, ImpactStatus, TaskStatus, TaskPriority, ChatRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { ensureSubclass500Template } from "../lib/services/subclass-templates";
import { createOrGetSubclass500Draft, mapDocumentsToDraft } from "../lib/services/application-draft";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.aiChatMessage.deleteMany();
  await prisma.aiChatThread.deleteMany();
  await prisma.matterReviewRequest.deleteMany();
  await prisma.matterDraftFieldEvidenceLink.deleteMany();
  await prisma.matterDraftField.deleteMany();
  await prisma.matterApplicationDraft.deleteMany();
  await prisma.documentExtractionResult.deleteMany();
  await prisma.visaTemplateChecklistItem.deleteMany();
  await prisma.visaTemplateRequirement.deleteMany();
  await prisma.visaTemplateField.deleteMany();
  await prisma.visaTemplateSection.deleteMany();
  await prisma.visaSubclassTemplate.deleteMany();
  await prisma.task.deleteMany();
  await prisma.matterImpact.deleteMany();
  await prisma.officialUpdate.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.validationIssue.deleteMany();
  await prisma.extractedField.deleteMany();
  await prisma.document.deleteMany();
  await prisma.matter.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();

  const workspace = await prisma.workspace.create({ data: { name: "Southern Cross Migration", slug: "southern-cross", plan: WorkspacePlan.GROWTH } });
  const seededPassword = await hash("Password123!", 12);

  const users = await Promise.all([
    prisma.user.create({ data: { name: "Mia Patel", email: "mia@southerncross.example", hashedPassword: seededPassword, role: UserRole.ADMIN, workspaceId: workspace.id } }),
    prisma.user.create({ data: { name: "Arun Iyer", email: "arun@southerncross.example", hashedPassword: seededPassword, role: UserRole.AGENT, workspaceId: workspace.id } }),
    prisma.user.create({ data: { name: "Sofia Tran", email: "sofia@southerncross.example", hashedPassword: seededPassword, role: UserRole.REVIEWER, workspaceId: workspace.id } })
  ]);

  const clients = await Promise.all(Array.from({ length: 10 }).map((_, i) => prisma.client.create({ data: {
    workspaceId: workspace.id, firstName: ["Aisha", "Luca", "Priya", "Daniel", "Maria", "Wei", "Fatima", "Noah", "Elena", "Ravi"][i],
    lastName: ["Rahman", "Rossi", "Menon", "Kim", "Santos", "Zhang", "Hassan", "Reed", "Popov", "Nair"][i],
    dob: new Date(1990 + i % 8, i % 12, 10 + i), nationality: ["Indian", "Brazilian", "Italian", "Korean", "Filipino"][i % 5],
    email: `client${i + 1}@example.com`, phone: `+61 400 000 ${String(i).padStart(3, "0")}`, notes: "Development seed client profile"
  }})));

  const matters = await Promise.all(clients.map((client, i) => prisma.matter.create({ data: {
    workspaceId: workspace.id, clientId: client.id, title: `Visa matter ${i + 1}`,
    visaSubclass: ["189", "190", "482", "500", "820"][i % 5], visaStream: ["Points-tested", "State nominated", "Medium-term", "Higher Education", "Onshore"][i % 5],
    status: [MatterStatus.IN_PROGRESS, MatterStatus.AWAITING_DOCS, MatterStatus.READY_FOR_REVIEW, MatterStatus.DRAFT][i % 4],
    stage: [MatterStage.INTAKE, MatterStage.EVIDENCE, MatterStage.FIELD_REVIEW, MatterStage.VALIDATION, MatterStage.SUBMISSION_PREP][i % 5],
    lodgementTargetDate: new Date(2026, 5, i + 1), assignedToUserId: users[i % users.length].id, readinessScore: 55 + i * 4,
    lastReviewedAt: new Date(2026, 3, 10 + i)
  }})));

  for (let i = 0; i < 32; i++) {
    const matter = matters[i % matters.length];
    const client = clients[i % clients.length];
    const uploader = users[i % users.length];
    const document = await prisma.document.create({ data: {
      workspaceId: workspace.id, clientId: client.id, matterId: matter.id, fileName: `evidence-${i + 1}.pdf`, storageKey: `dev-seed/${matter.id}/evidence-${i + 1}.pdf`,
      mimeType: "application/pdf", category: ["Identity", "Travel", "Employment", "Education", "Financial", "Relationship", "Health / Police", "Forms", "Other Evidence"][i % 9],
      subcategory: "Primary", uploadedByUserId: uploader.id, extractionStatus: [ExtractionStatus.QUEUED, ExtractionStatus.EXTRACTED, ExtractionStatus.NEEDS_REVIEW][i % 3],
      reviewStatus: [ReviewStatus.PENDING, ReviewStatus.VERIFIED, ReviewStatus.FLAGGED][i % 3]
    }});

    await prisma.extractedField.create({ data: {
      matterId: matter.id, documentId: document.id, fieldKey: `field_${i + 1}`, fieldLabel: "Sample extracted field", fieldValue: `Value ${i + 1}`,
      confidence: ((60 + (i % 40)) / 100), sourceSnippet: "Seeded source snippet with evidence text.", sourcePageRef: "p.1",
      status: [FieldStatus.HIGH_CONFIDENCE, FieldStatus.SUPPORTED, FieldStatus.NEEDS_REVIEW, FieldStatus.CONFLICTING, FieldStatus.MISSING][i % 5], needsReview: i % 2 === 0
    }});
  }

  for (const [idx, matter] of matters.entries()) {
    await prisma.validationIssue.create({ data: {
      matterId: matter.id, severity: [IssueSeverity.CRITICAL, IssueSeverity.HIGH, IssueSeverity.MEDIUM, IssueSeverity.LOW][idx % 4],
      type: "Data consistency", title: ["Missing passport expiry", "Name mismatch", "Address mismatch", "Employment dates conflict"][idx % 4],
      description: "Generated issue for development seed validation workflow.", relatedFieldKey: "passport_expiry", resolutionStatus: ResolutionStatus.OPEN
    }});

    await prisma.checklistItem.create({ data: { matterId: matter.id, category: "Evidence", label: "Identity documents verified", status: idx % 2 ? "complete" : "pending", required: true, notes: "Review required" } });

    await prisma.task.create({ data: {
      workspaceId: workspace.id, matterId: matter.id, assignedToUserId: users[idx % users.length].id,
      title: `Task for matter ${idx + 1}`, description: "Follow up evidence and confirm readiness", dueDate: new Date(2026, 4, 10 + idx),
      status: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.DONE][idx % 3], priority: [TaskPriority.HIGH, TaskPriority.MEDIUM, TaskPriority.LOW, TaskPriority.URGENT][idx % 4]
    }});
  }

  const updates = await Promise.all(Array.from({ length: 7 }).map((_, i) => prisma.officialUpdate.create({ data: {
    source: ["Department of Home Affairs", "Federal Register of Legislation", "OMARA/MARA notices"][i % 3], sourceUrl: `https://example.gov.au/updates/${i + 1}`,
    title: `Official update ${i + 1}`, summary: "Seeded official update summary for review workflows.", updateType: ["Policy", "Procedure", "Notice"][i % 3],
    effectiveDate: new Date(2026, 2, i + 1), publishedAt: new Date(2026, 1, i + 10), rawContentHash: `hash-${i + 1}`
  }})));

  for (let i = 0; i < 12; i++) {
    await prisma.matterImpact.create({ data: {
      officialUpdateId: updates[i % updates.length].id, matterId: matters[i % matters.length].id,
      impactLevel: [ImpactLevel.HIGH, ImpactLevel.MEDIUM, ImpactLevel.LOW][i % 3], reason: "Matched by visa subclass and stage criteria.",
      status: [ImpactStatus.NEW, ImpactStatus.REVIEWING, ImpactStatus.ACTIONED][i % 3]
    }});
  }

  for (const [i, matter] of matters.slice(0, 4).entries()) {
    const thread = await prisma.aiChatThread.create({ data: { workspaceId: workspace.id, matterId: matter.id, title: `Matter ${i + 1} review thread`, createdByUserId: users[0].id } });
    await prisma.aiChatMessage.createMany({ data: [
      { threadId: thread.id, role: ChatRole.USER, content: "What is missing from this matter?" },
      { threadId: thread.id, role: ChatRole.ASSISTANT, content: "AI-assisted summary: missing police check and passport expiry. Review required.", citationsJson: [{ label: "Validation", href: "/app/validation" }] }
    ]});
  }

  await prisma.auditEvent.create({ data: { workspaceId: workspace.id, userId: users[0].id, entityType: "Matter", entityId: matters[0].id, action: "created", metadataJson: { source: "seed" } } });

  const template = await ensureSubclass500Template(workspace.id);
  const subclass500Matter = matters.find((matter) => matter.visaSubclass === "500");
  if (subclass500Matter) {
    await createOrGetSubclass500Draft(subclass500Matter.id);
    await mapDocumentsToDraft(subclass500Matter.id);
    console.log(`Seeded ${template.name} workflow for matter ${subclass500Matter.id}`);
  }
}

main().finally(() => prisma.$disconnect());
