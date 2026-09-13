import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Link from "next/link";

import type { ArmSummary, EvalReport } from "@/lib/eval/types";

export const dynamic = "force-dynamic";

/**
 * §10, rendered. This page reads eval/results.json and shows nothing at
 * all when the file is absent — no placeholder numbers, no sample data.
 * A chart here is a claim, and a claim needs a run behind it.
 */
export default async function EvalPage() {
  let report: EvalReport | null = null;
  try {
    const raw = await readFile(resolve(process.cwd(), "eval/results.json"), "utf8");
    report = JSON.parse(raw) as EvalReport;
  } catch {
    report = null;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Generation eval</h1>
          <p className="max-w-prose text-sm text-[var(--ink-soft)]">
            Naive prompt against the constrained pipeline, over the same task space. Both arms ask
            the same model for the same numbers; only the prompt and the validator differ.
          </p>
        </div>
        <Link href="/caregiver" className="rounded-xl border-2 border-[var(--line)] px-4 py-2">
          Caregiver view
        </Link>
      </header>

      {!report ? (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <p className="text-lg">No run recorded yet.</p>
          <p className="mt-2 max-w-prose text-[var(--ink-soft)]">
            Start a model, then run <code className="font-mono">npm run eval</code>. The harness
            writes <code className="font-mono">eval/results.json</code> and this page reads it. There
            is deliberately no sample data here — a chart with no run behind it is a fabrication.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <dl className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[var(--ink-soft)]">Model</dt>
                <dd>{report.model}</dd>
              </div>
              <div>
                <dt className="text-[var(--ink-soft)]">Requests</dt>
                <dd className="tabular-nums">{report.requests}</dd>
              </div>
              <div>
                <dt className="text-[var(--ink-soft)]">Batch size</dt>
                <dd className="tabular-nums">{report.batchSize}</dd>
              </div>
              <div>
                <dt className="text-[var(--ink-soft)]">Run</dt>
                <dd>{new Date(report.ranAt).toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <MetricTable arms={report.arms} />
          <InterestSpread arms={report.arms} novel={report.novelInterests} />
          <Failures arms={report.arms} />
          <Samples report={report} />
        </>
      )}
    </main>
  );
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const METRICS: { key: keyof ArmSummary; label: string; note: string }[] = [
  { key: "schemaValidRate", label: "Schema validity", note: "parseable JSON with both fields" },
  { key: "structurePreservedRate", label: "Structure preserved", note: "correct numeral, no stray number, on the chosen rung" },
  { key: "literalCompliantRate", label: "Literal-language compliance", note: "zero banned patterns" },
  { key: "acceptRate", label: "Candidates accepted", note: "cleared every rule" },
];

function Bars({ arms, metric }: { arms: ArmSummary[]; metric: keyof ArmSummary }) {
  return (
    <div className="flex flex-col gap-1.5">
      {arms.map((a) => {
        const v = a[metric] as number;
        return (
          <div key={a.arm} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm text-[var(--ink-soft)]">{a.arm}</span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-[var(--bg)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(1, v * 100)}%`,
                  background: a.arm === "constrained" ? "var(--accent)" : "var(--line)",
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-sm tabular-nums">{pct(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetricTable({ arms }: { arms: ArmSummary[] }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="mb-5 text-xl font-semibold">Headline rates</h2>
      <div className="flex flex-col gap-6">
        {METRICS.map((m) => (
          <div key={m.key as string}>
            <p className="mb-1.5 font-medium">{m.label}</p>
            <p className="mb-2 text-sm text-[var(--ink-soft)]">{m.note}</p>
            <Bars arms={arms} metric={m.key} />
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-3">
        {arms.map((a) => (
          <div key={a.arm}>
            <p className="font-medium">{a.arm}</p>
            <p className="text-sm text-[var(--ink-soft)]">
              fell back to cache {pct(a.fallbackRate)} · {a.meanAttempts.toFixed(2)} attempts ·
              latency p50 {a.latencyMs.p50}ms, p90 {a.latencyMs.p90}ms
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InterestSpread({ arms, novel }: { arms: ArmSummary[]; novel: string[] }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="text-xl font-semibold">Spread across interests</h2>
      <p className="mb-5 mt-1 max-w-prose text-sm text-[var(--ink-soft)]">
        Does a novel interest degrade against a seed one? A pipeline that only holds for the
        interests it was tuned on is a catalogue with extra steps.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="text-[var(--ink-soft)]">
            <tr>
              <th className="py-2 pr-4 font-medium">Interest</th>
              <th className="py-2 pr-4 font-medium">In the seed bank</th>
              {arms.map((a) => (
                <th key={a.arm} className="py-2 pr-4 font-medium">
                  {a.arm} accepted
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(arms[0]?.byInterest ?? []).map((row) => (
              <tr key={row.interest} className="border-t border-[var(--line)]">
                <td className="py-2 pr-4">{row.interest}</td>
                <td className="py-2 pr-4 text-[var(--ink-soft)]">
                  {novel.includes(row.interest) ? "no — generated" : "yes"}
                </td>
                {arms.map((a) => (
                  <td key={a.arm} className="py-2 pr-4 tabular-nums">
                    {pct(a.byInterest.find((b) => b.interest === row.interest)?.acceptRate ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Failures({ arms }: { arms: ArmSummary[] }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="text-xl font-semibold">What the validator caught</h2>
      <p className="mb-5 mt-1 max-w-prose text-sm text-[var(--ink-soft)]">
        Counted per candidate, so one sentence can appear in more than one row.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        {arms.map((a) => (
          <div key={a.arm}>
            <p className="mb-2 font-medium">{a.arm}</p>
            {a.topFailures.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">Nothing was rejected.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {a.topFailures.map((f) => (
                  <li key={f.reason} className="flex justify-between gap-4">
                    <span>{f.reason}</span>
                    <span className="tabular-nums text-[var(--ink-soft)]">{f.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Samples({ report }: { report: EvalReport }) {
  const pickSome = (arm: string, accepted: boolean) =>
    report.rows.filter((r) => r.arm === arm && r.accepted === accepted && r.stem).slice(0, 4);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
      <h2 className="mb-5 text-xl font-semibold">Sentences, as written</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 font-medium">Naive prompt, rejected</p>
          <ul className="flex flex-col gap-3 text-sm">
            {pickSome("naive", false).map((r, i) => (
              <li key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3">
                <p>&ldquo;{r.stem}&rdquo;</p>
                <p className="mt-1.5 font-mono text-xs text-[var(--ink-soft)]">
                  {r.failures.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 font-medium">Constrained pipeline, accepted</p>
          <ul className="flex flex-col gap-3 text-sm">
            {pickSome("constrained", true).map((r, i) => (
              <li key={i} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3">
                <p>&ldquo;{r.stem}&rdquo;</p>
                <p className="mt-1.5 font-mono text-xs text-[var(--ink-soft)]">
                  {r.interest} · target {r.targetNumber} · {r.stemWords} words
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
