import { caregiverNarrative } from "@/lib/ai/surfaces";
import { summarise } from "@/lib/policy/summary";
import type { LearnerEvent } from "@/lib/core/types";

export const dynamic = "force-dynamic";

/**
 * Surface B (§9.2). One call per session. The body is an event-log slice
 * that never left the device until the caregiver pressed the button.
 */
export async function POST(request: Request) {
  let events: LearnerEvent[];
  try {
    const body = (await request.json()) as { events?: LearnerEvent[] };
    events = Array.isArray(body.events) ? body.events : [];
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (events.length === 0) {
    return Response.json({ error: "no events" }, { status: 400 });
  }

  const summary = summarise(events.slice(-120));
  const result = await caregiverNarrative(summary);
  return Response.json({ ...result, summary });
}
