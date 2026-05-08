const sections = [
  {
    title: "Nature of the service",
    body: [
      "Aria is AI-assisted migration practice management, document handling, workflow coordination, and drafting software for registered migration agents and their teams.",
      "Aria is not a registered migration agent, does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications."
    ]
  },
  {
    title: "Firm responsibilities",
    body: [
      "Each firm remains responsible for supervising users, controlling permissions, reviewing AI-assisted output, checking source evidence, and deciding whether any material is accurate enough for client use or final migration-agent review.",
      "Firms are also responsible for their own legal, privacy, records-management, retention, and professional obligations."
    ]
  },
  {
    title: "Client-facing workflows",
    body: [
      "Portal links, intake requests, document requests, and generated outputs should only be shared with the intended client or authorised recipient.",
      "Client confirmations and AI-assisted outputs do not replace migration-agent judgement or any independent legal review your firm requires."
    ]
  },
  {
    title: "Commercial review notice",
    body: [
      "Review by a qualified Australian lawyer/privacy professional before commercial use."
    ]
  }
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Terms</p>
        <h1 className="text-4xl font-semibold tracking-tight">Terms of use</h1>
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
