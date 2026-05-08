const sections = [
  {
    title: "What Aria collects",
    body: [
      "Aria may collect workspace account details, staff roles, client profiles, matter records, uploaded documents, extracted fields, source snippets, AI-assisted draft outputs, portal submissions, appointment data, invoice records, and audit events.",
      "Migration matters can contain sensitive information, including identity records, passport details, visa history, relationship evidence, health or insurance details, financial records, and client-supplied statements."
    ]
  },
  {
    title: "How information is handled",
    body: [
      "Uploaded documents are intended to be stored privately and accessed through permission-checked application routes rather than public URLs.",
      "Sensitive extracted values and related draft data may be encrypted at rest where configured. Firms remain responsible for deciding what to upload and whether the platform configuration is appropriate for their legal and privacy obligations."
    ]
  },
  {
    title: "AI processing and migration work",
    body: [
      "Aria may use configured AI and OCR providers to classify documents, extract structured evidence, prepare draft fields, summarise migration updates, and assist with draft generation. AI-assisted output remains review required before use.",
      "Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications."
    ]
  },
  {
    title: "Access, correction, retention, and deletion",
    body: [
      "Firms should provide clear client-facing processes for access, correction, export, archive, and deletion/de-identification requests where appropriate.",
      "Do not delete records that must be retained for law, professional obligations, disputes, audits, or client engagement requirements."
    ]
  },
  {
    title: "Breach and incident response",
    body: [
      "Aria includes an incident register and audit trail intended to support breach assessment and response workflows. Those controls reduce risk but do not eliminate it.",
      "Review by a qualified Australian lawyer/privacy professional before commercial use."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Privacy</p>
        <h1 className="text-4xl font-semibold tracking-tight">Privacy notice</h1>
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
