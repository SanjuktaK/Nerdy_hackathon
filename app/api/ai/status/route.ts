import { providerStatus } from "@/lib/ai/provider";
import { bankMeta } from "@/lib/content/cache";

export const dynamic = "force-dynamic";

/** Drives the §9.0 rule: with `none` resolved, the UI hides free-text interest. */
export async function GET() {
  const status = await providerStatus();
  return Response.json({ provider: status, cache: bankMeta() });
}
