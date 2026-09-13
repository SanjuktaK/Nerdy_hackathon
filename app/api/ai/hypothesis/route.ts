import { unclassifiedHypothesis } from "@/lib/ai/surfaces";

export const dynamic = "force-dynamic";

/**
 * Surface C (§9.3). Reached only after the deterministic classifier has
 * already returned UNCLASSIFIED and the policy has already chosen the next
 * task. Nothing here can change that choice.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const tens = Number(body.tens);
    const ones = Number(body.ones);
    const targetNumber = Number(body.targetNumber);
    if ([tens, ones, targetNumber].some((n) => !Number.isFinite(n))) {
      return Response.json({ error: "invalid state" }, { status: 400 });
    }
    const result = await unclassifiedHypothesis({
      tens,
      ones,
      targetNumber,
      taskType: String(body.taskType ?? "REPRESENT"),
      addend: typeof body.addend === "number" ? body.addend : undefined,
      startState:
        body.startState && typeof body.startState === "object"
          ? (body.startState as { tens: number; ones: number })
          : undefined,
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
}
