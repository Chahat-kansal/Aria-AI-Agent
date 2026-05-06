export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Terms</p>
        <h1 className="text-4xl font-semibold tracking-tight">Terms of use</h1>
        <p className="text-sm text-slate-300">Review by a qualified Australian lawyer/privacy professional before commercial use.</p>
        <div className="space-y-4 text-sm leading-7 text-slate-300">
          <p>Aria is AI-assisted practice management, document review, drafting, and workflow software for registered migration agents. It is not a registered migration agent, does not provide final legal advice, does not guarantee visa outcomes, and does not lodge applications.</p>
          <p>Firms are responsible for supervising all staff access, reviewing AI-assisted output, maintaining lawful client records, and complying with professional, privacy, and retention obligations.</p>
        </div>
      </div>
    </main>
  );
}
