import { providerStatus } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/** Which model is answering, for the grown-ups page. */
export async function GET() {
  return Response.json({ provider: await providerStatus() });
}
