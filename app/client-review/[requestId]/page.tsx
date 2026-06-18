import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { ClientReviewActions } from "@/components/app/client-review-actions";
import { serverLog } from "@/lib/services/runtime-config";
import { decryptString } from "@/lib/security/encryption";
import { hashPortalToken } from "@/lib/security/hash";
import { AIReviewNotice } from "@/components/ui/ai-review-notice";

export default async function ClientReviewPage({ params }: { params: { requestId: string } }) {
  const request = await prisma.matterReviewRequest.findFirst({
    where: {
      expiresAt: { gt: new Date() },
      revokedAt: null,
      publicTokenHash: hashPortalToken(params.requestId)
    },
    include: {
      matter: { include: { client: true } },
      draft: { include: { fields: { include: { templateField: true } } } }
    }
  }).catch((error) => {
    serverLog("client.review.lookup_failed", {
      tokenPreview: params.requestId.slice(0, 6),
      reason: error instanceof Error ? error.message : "lookup_failed"
    });
    return null;
  });

  if (!request) {
    serverLog("client.review.invalid_or_expired", { tokenPreview: params.requestId.slice(0, 6) });
    return <main className="min-h-screen p-8 text-[#182033]">Review request not found.</main>;
  }

  if (request.status === "SENT_TO_CLIENT") {
    await prisma.matterReviewRequest.update({
      where: { id: request.id },
      data: { status: "VIEWED_BY_CLIENT", viewedAt: new Date() }
    });
    request.status = "VIEWED_BY_CLIENT";
  }

  return (
    <main className="min-h-screen p-6 text-[#182033]">
      <div className="mx-auto max-w-4xl space-y-4">
        <Card>
          <Badge className="border-accent/40 bg-accent/10 text-accent">Client review required</Badge>
          <h1 className="mt-4 text-3xl font-semibold">Review draft details</h1>
          <p className="mt-2 text-sm text-muted">
            This is a client confirmation workflow foundation. The draft remains AI-assisted and requires registered migration agent review before final submission preparation.
          </p>
          <div className="mt-4">
            <AIReviewNotice variant="client" />
          </div>
          <p className="mt-3 text-sm">{request.matter.client.firstName} {request.matter.client.lastName} - {request.matter.title}</p>
          <p className="mt-2 text-sm text-muted">Current status: {request.status.replaceAll("_", " ").toLowerCase()}</p>
        </Card>

        <Card>
          <h2 className="font-semibold">Two draft versions</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-white/50 p-3 text-sm">
              <p className="font-medium">Interactive review version</p>
              <p className="mt-1 text-muted">This page lets you review the fields and confirm information for the migration agent.</p>
            </div>
            <a href={`/api/client-review/${params.requestId}/draft-pdf`} className="rounded-lg border border-border bg-white/50 p-3 text-sm transition hover:bg-white">
              <p className="font-medium">PDF review version</p>
              <p className="mt-1 text-muted">Download a firm-branded PDF copy with company details, practitioner details, and review terms.</p>
            </a>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Draft fields for confirmation</h2>
          <div className="mt-3 space-y-2">
            {request.draft.fields.slice(0, 12).map((field) => (
              <div key={field.id} className="rounded-lg border border-border bg-white/50 p-3 text-sm">
                <p className="font-medium">{field.templateField.label}</p>
                <p className="text-muted">{decryptString(field.manualOverride || field.value || "") || "Missing / requires agent follow-up"}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Client confirmation</h2>
          <p className="mb-3 mt-2 text-sm text-muted">Confirming records client acknowledgement only. It is not a final legal decision and does not replace migration agent review.</p>
          <ClientReviewActions requestId={params.requestId} />
          <p className="mt-3 text-xs text-muted">External e-sign provider integration is pending; this records secure review workflow status inside Aria.</p>
        </Card>
      </div>
    </main>
  );
}
