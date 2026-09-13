"use client";

export function Panel({
  title,
  note,
  children,
  action,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {note && <p className="mt-1 max-w-prose text-sm text-[var(--ink-soft)]">{note}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  tone = "quiet",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "primary" | "quiet" | "danger";
  disabled?: boolean;
}) {
  const styles =
    tone === "primary"
      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
      : tone === "danger"
        ? "border-[#b08080] bg-[var(--surface)] text-[#7a3c3c]"
        : "border-[var(--line)] bg-[var(--bg)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border-2 px-4 py-2 text-base disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      {children}
      {hint && <span className="text-sm text-[var(--ink-soft)]">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "rounded-xl border-2 border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-base text-[var(--ink)]";

/** A bar with no colour coding — red/green pairs are the wrong signal here. */
export function Bar({ value }: { value: number | null }) {
  return (
    <div
      className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg)]"
      role="img"
      aria-label={value === null ? "no data yet" : `${Math.round(value * 100)} percent`}
    >
      {value !== null && (
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.max(3, Math.round(value * 100))}%` }}
        />
      )}
    </div>
  );
}
