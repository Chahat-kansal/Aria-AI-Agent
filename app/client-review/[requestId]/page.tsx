import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { ClientReviewActions } from "@/components/app/client-review-actions";

export default async function ClientReviewPage({ params }: { params: { requestId: string } }) {
  const request = await prisma.matterReviewRequest.findUnique({
    where: { id: params.requestId },
    include: {
      matter: { include: { client: true } },
      draft: { include: { fields: { include: { templateField: true } } } }
    }
  });

  if (!request) {
    return <main className="min-h-screen bg-[#040912] p-8 text-white">Review request not found.</main>;
  }

  if (request.status === "SENT_TO_CLIENT") {
    await prisma.matterReviewRequest.update({
      where: { id: request.id },
      data: { status: "VIEWED_BY_CLIENT", viewedAt: new Date() }
    });
    request.status = "VIEWED_BY_CLIENT";
  }

  return (
    <main className="min-h-screen bg-[#040912] p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-4">
        <Card>
          <Badge className="border-accent/40 bg-accent/10 text-accent">Client review required</Badge>
          <h1 className="mt-4 text-3xl font-semibold">Review draft details</h1>
          <p className="mt-2 text-sm text-muted">
            This is a client confirmation workflow foundation. The draft remains AI-assisted and requires registered migration agent review before final submission preparation.
          </p>
          <p className="mt-3 text-sm">{request.matter.client.firstName} {request.matter.client.lastName} · {request.matter.title}</p>
          <p className="mt-2 text-sm text-muted">Current status: {request.status.replaceAll("_", " ").toLowerCase()}</p>
        </Card>

        <Card>
          <h2 className="font-semibold">Draft fields for confirmation</h2>
          <div className="mt-3 space-y-2">
            {request.draft.fields.slice(0, 12).map((field) => (
              <div key={field.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{field.templateField.label}</p>
                <p className="text-muted">{field.manualOverride || field.value || "Missing / requires agent follow-up"}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Client confirmation</h2>
          <p className="mb-3 mt-2 text-sm text-muted">Confirming records client acknowledgement only. It is not a final legal decision and does not replace migration agent review.</p>
          <ClientReviewActions requestId={request.id} />
          <p className="mt-3 text-xs text-muted">External e-sign provider integration is pending; this records secure review workflow status inside Aria.</p>
        </Card>
      </div>
    </main>
  );
}
