export function AIReviewNotice({
  variant = "internal",
  className = ""
}: {
  variant?: "internal" | "client" | "intel";
  className?: string;
}) {
  const message = variant === "client"
    ? "Your migration agent will review all information before it is used. Aria does not lodge applications."
    : variant === "intel"
      ? "Migration intelligence may include news/reporting and is not a substitute for checking official Department sources."
      : "AI-assisted output. Registered migration agent review required before use. Aria does not provide final migration advice, does not guarantee visa outcomes, and does not lodge applications.";

  return (
    <div className={`rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm leading-6 text-amber-200 ${className}`}>
      {message}
    </div>
  );
}
