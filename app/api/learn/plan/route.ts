import { planNext } from "@/lib/learn/ai";
import { sanitiseAttempts, sanitiseModel, sanitiseProfile, sanitiseWorld } from "@/lib/learn/input";
import { initialModel } from "@/lib/learn/policy";

export const dynamic = "force-dynamic";

/** Before every question: the model proposes, the rules fence it. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const profile = sanitiseProfile(body?.profile);
  if (!profile) return Response.json({ error: "invalid profile" }, { status: 400 });
  const model = sanitiseModel(body?.model) ?? initialModel(profile);
  const hero = String(body?.hero ?? "").replace(/[^\p{L} '-]/gu, "").slice(0, 30) || "Pooh";
  const seed = String(body?.seed ?? "").replace(/[^\w-]/g, "").slice(0, 40) || `s${Date.now()}`;
  return Response.json(await planNext(profile, model, sanitiseAttempts(body?.history), hero, seed, sanitiseWorld(body?.world), premiseOf(body?.premise)));
}

function premiseOf(x: unknown): string | undefined {
  const s = String(x ?? "").replace(/[^\p{L}\p{N} ,.'-]/gu, "").trim().slice(0, 140);
  return s || undefined;
}
