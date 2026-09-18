/**
 * Score .models/bench/results.json with the app's own validator and write
 * eval/llm-bench.md. Speed without the quality column would be a claim with
 * half its evidence missing.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { parseStemBatch } from "../../lib/ai/providers/ollama";
import { validateStem, type GenerationRequest } from "../../lib/ai/validate";

interface Row {
  ttftMs: number;
  totalMs: number;
  promptTokens: number;
  genTokens: number;
  genTps: number;
  peakGb: number;
  text: string;
}
interface Rung {
  name: string;
  mode: string;
  weightsGb: number;
  loadS: number;
  repeats?: number;
  sharedPrefixTokens?: number;
  prefixPrefillMs?: number;
  rows: Row[];
}

const root = resolve(import.meta.dirname, "../..");
const { prompts, results } = JSON.parse(
  readFileSync(resolve(root, ".models/bench/results.json"), "utf8")
) as { prompts: { req: GenerationRequest }[]; results: Rung[] };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function quality(r: Rung) {
  let candidates = 0;
  let accepted = 0;
  let parsed = 0;
  r.rows.forEach((row, i) => {
    const stems = parseStemBatch(row.text);
    if (stems.length) parsed++;
    candidates += stems.length;
    accepted += stems.filter((s) => validateStem(s, prompts[i].req).ok).length;
  });
  return { parsed, candidates, accepted };
}

const base = results.find((r) => r.name === "bf16") ?? results[0];
const q4 = results.find((r) => r.name === "4bit");
const baseTotal = median(base.rows.map((x) => x.totalMs));

const lines: string[] = [];
lines.push(
  "| Rung | Weights | Peak RAM | Load | TTFT p50 | Decode tok/s | Request p50 | Speed-up | Valid JSON | Stems accepted |",
  "|---|---|---|---|---|---|---|---|---|---|"
);
for (const r of results) {
  const q = quality(r);
  const total = median(r.rows.map((x) => x.totalMs));
  lines.push(
    [
      r.name,
      `${r.weightsGb.toFixed(2)} GB`,
      `${Math.max(...r.rows.map((x) => x.peakGb)).toFixed(2)} GB`,
      `${r.loadS.toFixed(1)} s`,
      `${median(r.rows.map((x) => x.ttftMs))} ms`,
      median(r.rows.map((x) => x.genTps)).toFixed(1),
      `${(total / 1000).toFixed(2)} s`,
      `${(baseTotal / total).toFixed(2)}×`,
      `${q.parsed}/${r.rows.length}`,
      `${q.accepted}/${q.candidates} (${Math.round((100 * q.accepted) / Math.max(q.candidates, 1))}%)`,
    ].join(" | ").replace(/^/, "| ").concat(" |")
  );
}

const notes: string[] = [];
const prefix = results.find((r) => r.mode === "prefix");
if (prefix) {
  notes.push(
    `- **Prefix cache**: the ${prefix.sharedPrefixTokens} tokens every request shares ` +
      `(system prompt + chat template) are prefilled once in ${prefix.prefixPrefillMs} ms, ` +
      `then the KV cache is trimmed back to that point after each request.`
  );
}
for (const r of results) {
  if (!q4 || r === q4 || !r.name.startsWith("4bit+")) continue;
  const same = r.rows.filter((row, i) => row.text === q4.rows[i].text).length;
  notes.push(
    `- **${r.name}** matches plain 4-bit token-for-token on ${same}/${r.rows.length} prompts. ` +
      `The rest differ because a different computation order shifts float rounding, ` +
      `which flips near-tied tokens in a 4-bit model; compare the accept rates, not the text.`
  );
}

const report = `# On-device inference benchmark

Qwen2.5-1.5B-Instruct, quantized on this machine with MLX (\`npm run llm:quantize\`),
measured on the app's real stem-generation prompts (${prompts.length} tasks, 5 stems each,
greedy decoding, fastest of ${results[0].repeats ?? 1} runs per prompt). "Stems accepted" is the app's own validator (\`lib/ai/validate.ts\`).

Machine: ${process.env.BENCH_MACHINE ?? "Apple M4, 16 GB"} · regenerate with \`npm run llm:bench\`

${lines.join("\n")}

${notes.join("\n")}
`;

mkdirSync(resolve(root, "eval"), { recursive: true });
writeFileSync(resolve(root, "eval/llm-bench.md"), report);
console.log(report);
