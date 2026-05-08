const sections = [
  {
    title: "Security measures",
    body: [
      "Aria is designed to support private document storage, permission-checked downloads, workspace and matter scoping, audit logging, token hashing for portal and intake links, and application-level encryption for sensitive stored values where configured.",
      "These measures reduce risk, but they do not eliminate it."
    ]
  },
  {
    title: "Sensitive information handling",
    body: [
      "Migration matters may include identity, financial, relationship, health, and character information. Firms should verify that their deployment configuration, subprocessor choices, and staff access policies are appropriate before uploading real client material.",
      "Do not rely on marketing language or a checklist alone. Independent security and privacy review is still required before broad public launch."
    ]
  },
  {
    title: "Incident response and breach review",
    body: [
      "Aria includes an incident register and audit trail intended to support investigation, breach assessment, and operational follow-up.",
      "Firms should document their own incident response workflow, escalation contacts, and regulatory/professional obligations outside the software as well."
    ]
  },
  {
    title: "Commercial review notice",
    body: [
      "Review by a qualified Australian lawyer/privacy professional before commercial use."
    ]
  }
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Security</p>
        <h1 className="text-4xl font-semibold tracking-tight">Security overview</h1>
        <p className="text-sm text-slate-300">Review by a qualified Australian lawyer/privacy professional before commercial use.</p>
        {sections.map((section) => (
          <section key={section.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
