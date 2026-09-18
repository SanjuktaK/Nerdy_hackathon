import { designCharacter } from "@/lib/learn/ai";
import { sanitiseProfile } from "@/lib/learn/input";

export const dynamic = "force-dynamic";

/** Called once, at the end of onboarding. The result is stored and reused. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const profile = sanitiseProfile(body?.profile);
  if (!profile) return Response.json({ error: "invalid profile" }, { status: 400 });
  return Response.json({ character: await designCharacter(profile) });
}
