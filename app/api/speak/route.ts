import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";

const run = promisify(execFile);

/**
 * The fallback voice: macOS's own text-to-speech, for browsers whose speech
 * does not work (or embedded views with none). Runs on this computer only.
 * The text goes through a file, never the command line, so nothing a child
 * or a model wrote can be read as a command option.
 */
const VOICE_SERVER = process.env.TTS_BASE_URL ?? "http://127.0.0.1:8091";

/** Is the natural voice running? The browser asks once at load and every 30 s. */
export async function GET() {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 1500);
    const r = await fetch(`${VOICE_SERVER}/health`, { signal: ac.signal });
    clearTimeout(t);
    return new Response(null, { status: r.ok ? 204 : 503 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

/**
 * Voices, best first:
 *   stream  — the child's voice, Qwen3-TTS on this Mac (npm run tts:serve), sent as it is made
 *   natural — the same voice as a whole file, for preparing lines ahead
 *   system  — macOS `say`: always there, but it sounds like a machine
 * The browser asks for "natural" first and falls back to its own voice,
 * then to "system", so a child always hears something.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = String(body?.text ?? "").replace(/[^\p{L}\p{N} ,.'?!¢:-]/gu, " ").trim().slice(0, 300);
  if (!text) return new Response("empty", { status: 400 });
  const style = ["child", "bear", "cartoon", "grownup"].includes(body?.style) ? body.style : "child";

  if (body?.engine === "stream") {
    // Pass the voice through as it is made. If the child moves on, the
    // browser cancels, and that cancel reaches the voice server so it stops too.
    try {
      const r = await fetch(`${VOICE_SERVER}/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        signal: request.signal,
      });
      if (!r.ok || !r.body) throw new Error(String(r.status));
      return new Response(r.body, { headers: { "content-type": "audio/L16; rate=24000; channels=1", "cache-control": "no-store" } });
    } catch {
      return new Response("natural voice not running", { status: 503 });
    }
  }

  if (body?.engine === "natural") {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 20000);
      const r = await fetch(`${VOICE_SERVER}/tts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, style }),
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!r.ok) throw new Error(String(r.status));
      return new Response(await r.arrayBuffer(), { headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
    } catch {
      return new Response("natural voice not running", { status: 503 });
    }
  }

  if (process.platform !== "darwin") return new Response("no local voice", { status: 404 });
  const rate = Math.round(Math.max(0.5, Math.min(1.5, Number(body?.rate) || 0.9)) * 190);
  // Junior is a child's voice, Grandpa a deep warm one for a cuddly animal.
  const voice = style === "child" || style === "cartoon" ? "Junior" : style === "bear" ? "Grandpa" : "Samantha";

  const dir = await mkdtemp(join(tmpdir(), "tally-say-"));
  try {
    const src = join(dir, "line.txt");
    const out = join(dir, "line.wav");
    await writeFile(src, text, "utf8");
    await run("/usr/bin/say", ["-v", voice, "-r", String(rate), "-f", src, "-o", out, "--file-format=WAVE", "--data-format=LEI16@22050"], {
      timeout: 8000,
    }).catch(() => run("/usr/bin/say", ["-r", String(rate), "-f", src, "-o", out, "--file-format=WAVE", "--data-format=LEI16@22050"], { timeout: 8000 }));
    const wav = await readFile(out);
    return new Response(wav, { headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
  } catch {
    return new Response("voice failed", { status: 500 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
