export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.12),transparent_34%),linear-gradient(135deg,#0B1322,#10203A_45%,#172033)] px-6 py-14 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Privacy</p>
        <h1 className="text-4xl font-semibold tracking-tight">Privacy notice</h1>
        <p className="text-sm text-slate-300">Review by a qualified Australian lawyer/privacy professional before commercial use.</p>
        <div className="space-y-4 text-sm leading-7 text-slate-300">
          <p>Aria collects workspace account details, client records, matter workflow data, uploaded documents, extracted text, AI-assisted draft mappings, audit logs, portal submissions, and operational telemetry for migration practice management.</p>
          <p>Documents and form inputs may be processed by Aria and configured subprocessors to assist document review, extraction, drafting, scheduling, invoicing, and migration intelligence. Registered migration agent review remains required before use.</p>
          <p>Aria supports encrypted storage, private document access, scoped permissions, retention controls, access/correction workflows, and incident logging. Firms remain responsible for their legal, privacy, and professional obligations.</p>
        </div>
      </div>
    </main>
  );
}
