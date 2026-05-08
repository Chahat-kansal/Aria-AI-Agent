const processors = [
  ["Vercel", "Application hosting, deployment, and server execution."],
  ["Supabase / Postgres", "Workspace database and structured application data."],
  ["Configured private storage provider", "Encrypted or private document/object storage depending on deployment configuration."],
  ["OpenAI", "AI-assisted drafting, extraction support, and matter-assistance features when enabled."],
  ["Configured OCR provider", "Document text extraction where enabled."],
  ["Resend or configured email provider", "Email delivery for invites, portal links, and workflow notifications."],
  ["Tavily / news sources / web research providers", "Migration intelligence and source-linked update collection where enabled."]
];

export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Subprocessors</p>
        <h1 className="text-4xl font-semibold tracking-tight">Configured and possible subprocessors</h1>
        <p className="text-sm text-slate-300">Review by a qualified Australian lawyer/privacy professional before commercial use.</p>
        <div className="space-y-4">
          {processors.map(([name, detail]) => (
            <section key={name} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-lg font-semibold text-white">{name}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{detail}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
