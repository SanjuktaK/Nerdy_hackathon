import { requestStem, type StemRequest } from "@/lib/content/server";
import type { Difficulty } from "@/lib/core/types";
import { hasSkill } from "@/lib/skills/registry";
import { sanitiseInterest } from "@/lib/theme";

export const dynamic = "force-dynamic";

/**
 * Surface A (§9.1). The browser never talks to a model: it posts the
 * structural task the policy already chose and gets back language.
 */
export async function POST(request: Request) {
  let body: Partial<StemRequest>;
  try {
    body = (await request.json()) as Partial<StemRequest>;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const { skillId, taskType, difficulty, targetNumber } = body;
  if (
    typeof skillId !== "string" ||
    !hasSkill(skillId) ||
    typeof taskType !== "string" ||
    typeof difficulty !== "number" ||
    difficulty < 1 ||
    difficulty > 5 ||
    typeof targetNumber !== "number"
  ) {
    return Response.json({ error: "invalid task" }, { status: 400 });
  }

  const interest = sanitiseInterest(String(body.interest ?? ""));
  if (!interest) return Response.json({ error: "missing interest" }, { status: 400 });

  const res = await requestStem({
    skillId,
    taskType,
    difficulty: difficulty as Difficulty,
    targetNumber,
    addend: typeof body.addend === "number" ? body.addend : undefined,
    interest,
    rotation: typeof body.rotation === "number" ? body.rotation : 0,
  });

  return Response.json(res);
}
