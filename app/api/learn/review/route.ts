import { reviewSession } from "@/lib/learn/ai";
import { sanitiseAttempts, sanitiseModel, sanitiseProfile } from "@/lib/learn/input";
import { initialModel } from "@/lib/learn/policy";

export const dynamic = "force-dynamic";

/** After every session: rewrite the learner model (only with consent). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const profile = sanitiseProfile(body?.profile);
  if (!profile) return Response.json({ error: "invalid profile" }, { status: 400 });
  const model = sanitiseModel(body?.model) ?? initialModel(profile);
  return Response.json({ model: await reviewSession(profile, model, sanitiseAttempts(body?.attempts)) });
}
