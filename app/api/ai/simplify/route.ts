import { adaptLanguage } from "@/lib/ai/surfaces";

export const dynamic = "force-dynamic";

/** Surface D (§9.4). Language only — a changed numeral is rejected. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: unknown; maxWords?: unknown };
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) return Response.json({ error: "missing text" }, { status: 400 });
    const maxWords = Math.max(4, Math.min(14, Number(body.maxWords) || 14));
    return Response.json(await adaptLanguage(text, maxWords));
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
}
