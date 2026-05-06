export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Subprocessors</p>
        <h1 className="text-4xl font-semibold tracking-tight">Configured and possible subprocessors</h1>
        <p className="text-sm text-slate-300">Review by a qualified Australian lawyer/privacy professional before commercial use.</p>
        <ul className="space-y-3 text-sm text-slate-300">
          <li>Vercel</li>
          <li>Supabase / Postgres</li>
          <li>OpenAI</li>
          <li>Resend</li>
          <li>Tavily / Google News RSS</li>
          <li>Configured storage provider</li>
          <li>Configured OCR provider</li>
        </ul>
      </div>
    </main>
  );
}
