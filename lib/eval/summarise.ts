import type { Arm, ArmSummary, EvalRow } from "./types";

const rate = (n: number, d: number) => (d === 0 ? 0 : n / d);

const quantile = (xs: number[], q: number): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

export function summariseArm(
  arm: Arm,
  rows: EvalRow[],
  requests: { key: string; accepted: boolean; attempts: number; latencyMs: number }[]
): ArmSummary {
  const mine = rows.filter((r) => r.arm === arm);
  const n = mine.length;

  const interests = [...new Set(mine.map((r) => r.interest))];

  const failureCounts = new Map<string, number>();
  for (const r of mine) {
    for (const f of r.failures) {
      // Collapse "stray numeral: 12" into one bucket — the count is the point.
      const key = f.replace(/:.*$/, "");
      failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1);
    }
  }

  return {
    arm,
    candidates: n,
    schemaValidRate: rate(mine.filter((r) => r.schemaValid).length, n),
    structurePreservedRate: rate(mine.filter((r) => r.structurePreserved).length, n),
    literalCompliantRate: rate(mine.filter((r) => r.literalCompliant).length, n),
    acceptRate: rate(mine.filter((r) => r.accepted).length, n),
    fallbackRate: rate(requests.filter((r) => !r.accepted).length, requests.length),
    meanAttempts: rate(
      requests.reduce((a, r) => a + r.attempts, 0),
      requests.length
    ),
    latencyMs: {
      p50: quantile(requests.map((r) => r.latencyMs), 0.5),
      p90: quantile(requests.map((r) => r.latencyMs), 0.9),
      max: requests.length ? Math.max(...requests.map((r) => r.latencyMs)) : 0,
    },
    byInterest: interests.map((interest) => {
      const rs = mine.filter((r) => r.interest === interest);
      return {
        interest,
        novel: rs[0]?.novel ?? false,
        acceptRate: rate(rs.filter((r) => r.accepted).length, rs.length),
        literalRate: rate(rs.filter((r) => r.literalCompliant).length, rs.length),
      };
    }),
    topFailures: [...failureCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}
