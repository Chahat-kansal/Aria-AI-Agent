const sections = [
  {
    title: "What AI can help with",
    body: [
      "Aria may assist with document extraction, evidence summarisation, draft autofill, checklist generation, template/PDF filling, migration updates, pathway analysis, and workflow suggestions.",
      "AI-assisted output is intended to support a migration practice workbench, not replace practitioner judgement."
    ]
  },
  {
    title: "What AI does not do",
    body: [
      "Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications.",
      "Aria should not be treated as a substitute for client confirmation, source-document checking, or registered migration agent review."
    ]
  },
  {
    title: "Review-required notice",
    body: [
      "AI-assisted output. Registered migration agent review required before use.",
      "Review by a qualified Australian lawyer/privacy professional before commercial use."
    ]
  }
];

export default function AiDisclaimerPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">AI disclaimer</p>
        <h1 className="text-4xl font-semibold tracking-tight">AI-assisted output notice</h1>
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
