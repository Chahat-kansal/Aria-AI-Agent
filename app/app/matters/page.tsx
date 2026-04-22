import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/blocks/page-header";
import { getOverview } from "@/lib/data/demo-repository";

export default function MattersPage() {
  const { matters } = getOverview();

  return (
    <AppShell title="Matters">
      <PageHeader title="Matter Register" subtitle="Track status, stage, ownership, and submission readiness across all active files." />
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#101a2e] text-muted"><tr><th className="p-3 text-left">Client</th><th className="p-3 text-left">Matter</th><th className="p-3">Subclass</th><th className="p-3">Stream</th><th className="p-3">Owner</th><th className="p-3">Stage</th><th className="p-3">Readiness</th></tr></thead>
          <tbody>
            {matters.map((m) => (
              <tr key={m.id} className="border-t border-border hover:bg-[#0f1727]">
                <td className="p-3"><Link href={`/app/matters/${m.id}`} className="text-accent">{m.client}</Link></td>
                <td className="p-3">{m.title}</td>
                <td className="p-3 text-center">{m.visaSubclass}</td>
                <td className="p-3 text-center">{m.visaStream}</td>
                <td className="p-3 text-center">Mia Patel</td>
                <td className="p-3 text-center">{m.stage}</td>
                <td className="p-3 text-center">{m.readiness}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
