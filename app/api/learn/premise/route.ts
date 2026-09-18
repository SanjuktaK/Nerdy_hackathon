import { sessionPremise } from "@/lib/learn/ai";
import { sanitiseProfile, sanitiseWorld } from "@/lib/learn/input";

export const dynamic = "force-dynamic";

/** The opening line of a session's story, written while the schedule is on screen. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const profile = sanitiseProfile(body?.profile);
  if (!profile) return Response.json({ error: "invalid profile" }, { status: 400 });
  const hero = String(body?.hero ?? "").replace(/[^\p{L} '-]/gu, "").slice(0, 30) || "Pooh";
  return Response.json({ premise: await sessionPremise(profile, sanitiseWorld(body?.world), hero) });
}
