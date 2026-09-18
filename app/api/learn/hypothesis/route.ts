import { guessAnswer } from "@/lib/learn/ai";
import { isSkill } from "@/lib/learn/curriculum";
import { generateQuestion } from "@/lib/learn/generate";
import { WORLDS } from "@/lib/learn/worlds";
import type { Level } from "@/lib/learn/types";

export const dynamic = "force-dynamic";

/**
 * The browser sends the question it showed; the server rebuilds it from
 * (skill, level, seed) rather than trusting the numbers it was sent.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const q = body?.question;
  const m = typeof q?.id === "string" ? q.id.match(/^(.*)-([a-zA-Z0-9]+)-([1-5])-([CRA])$/) : null;
  if (!m || !isSkill(m[2])) return Response.json({ hypothesis: null });
  const rebuilt = generateQuestion({ seed: m[1], skill: m[2], level: Number(m[3]) as Level, rep: m[4] as "C", world: WORLDS.honey, hero: "the child" });
  const given = String(body?.given ?? "").slice(0, 12);
  return Response.json({ hypothesis: await guessAnswer(rebuilt, given) });
}
