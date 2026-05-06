export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Security</p>
        <h1 className="text-4xl font-semibold tracking-tight">Security overview</h1>
        <p className="text-sm text-slate-300">Review by a qualified Australian lawyer/privacy professional before commercial use.</p>
        <div className="space-y-4 text-sm leading-7 text-slate-300">
          <p>Aria uses application-level encryption for sensitive values where configured, private document downloads through permission-checked routes, workspace and matter-scoped access control, audit logging, and secure client portal token handling.</p>
          <p>Security measures reduce risk but do not eliminate it. Firms should complete independent security, privacy, and incident response review before production use with real clients.</p>
        </div>
      </div>
    </main>
  );
}
