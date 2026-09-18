# Tally Tales

Maths stories for K–2, built first for autistic learners.

A child meets a character built around the show they love, and every puzzle
is a short story in that world: counting honey pots, adding train
carriages, counting coins, reading a clock. The numbers and the answer check are
deterministic code. The language model only writes the story, and every
sentence it writes is validated before a child sees it.

The diagnostic engine is deterministic by design — a child's next problem
should not depend on a sampling temperature. The content engine is generative
by necessity — no catalogue can cover every child's interests, which is
exactly why every existing product is built for a median autistic child who
does not exist.

Built for the Nerdy AI Hackathon (K–5 Math Game). Design:
[`architecture-v2.md`](architecture-v2.md). Current state and open work:
[`HANDOVER.md`](HANDOVER.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No model is required. Every model call has a rules fallback, so the whole
app runs offline with zero model calls.

| Route | What it is |
|---|---|
| `/` | **Tally Tales**, the child app: onboarding, then story sessions |
| `/grown-ups` | Caregiver page: notes, progress, sensory and voice settings, reset |
| `/classic` | Bead Frame, the first version: bead-frame place value (see below) |
| `/caregiver` | Caregiver app for Bead Frame |
| `/eval` | Generation eval results, when a run exists |
| `/preview` | Every Bead Frame screen at once (dev tool) |

## How Tally Tales works

**Onboarding asks the grown-up, not the child.** Name, age, grade, how much
support the child usually needs, how they communicate, whether colour or
sound is upsetting, and their favourite show as free text. The model turns
that into a character; it chooses from bodies, colours and items the app can
draw, and never draws anything itself.

**The numbers never come from the model.** `lib/learn/generate.ts` builds each
question from a seeded random generator, across K (counting, more and less,
adding and taking away within 10, shapes), G1 (within 20, tens and ones, time)
and G2 (within 1000 with carrying, place value, money, measuring). G3–G5 are
listed in `lib/learn/curriculum.ts` but not built.

**Wrong answers are diagnosed, not scored.** `lib/learn/diagnose.ts` names the
mistake (off by one, digits swapped, forgot to carry, wrong operation, beads
in the wrong column) and that name shapes the next question. An answer the
rules cannot explain goes to the model for a guess that is shown only to the
grown-up.

**The model steers; the rules hold the wheel.** Before each question the model
may suggest the skill and level (`planNext` in `lib/learn/ai.ts`).
`guardPlan` in `lib/learn/policy.ts` clamps that suggestion to the child's
grade band, and after a wrong answer the level can only stay or drop.
`rulePlan` is a complete planner on its own and runs whenever the model is
slow or absent.

**Every model call has a budget and a fallback.** Character design, the next
plan, the story line, the session review: each is parsed as JSON, validated
field by field, and replaced by the rules answer on failure or timeout. A
child never waits on the model past a fixed budget.

**Sensory settings belong to the grown-up.** Monochrome mode with a choice of
calm tone, reduced motion, a still or plain background, read-aloud
(automatic, on tap, or off), volume, sound effects, voice style, session
length, and four ways to mark a right answer, from a big cheer to a quiet
tick. There is no "wrong" sound or animation in any of them.

**Voices are made on the device.** `speak()` in `lib/learn/sound.ts` uses
Kokoro-82M when `npm run tts:serve` is running, then the browser's own
voice, then macOS `say`. Effects are synthesised with Web Audio; there are
no audio files. Known gaps off a Mac and in Safari are listed in
`HANDOVER.md`.

```
app/page.tsx, app/grown-ups/   child app and caregiver page
app/api/learn/*                model calls: character, plan, premise, review, hypothesis
app/api/speak/                 on-device voices
components/learn/              scenes, questions, abacus, character, cheers
lib/learn/                     curriculum, generator, diagnosis, planner, model calls, sound
lib/ai/                        providers and validator, shared with Bead Frame
```

## Commands

```bash
npm run check            # typecheck + tests + rebuild the Bead Frame lesson bank
npm test                 # tests only
npm run tts:serve        # Kokoro voices on http://localhost:8091 (Apple silicon)
npm run llm:quantize     # download Qwen2.5-1.5B bf16, quantize to 4-bit with MLX
npm run llm:serve        # serve it on http://localhost:8080
npm run llm:bench        # bf16 vs 8-bit vs 4-bit vs optimized → eval/llm-bench.md
npm run try:model        # one-shot check that the resolved provider works
npm run eval             # naive prompt vs constrained pipeline (needs a provider)
npm run stems:seed       # rebuild lib/content/stems.json from the templates
npm run stems:generate   # widen the bank with a model (needs a provider)
```

For a production build use `npx next build --webpack`; the default Turbopack
build needs Next's native binary, which is not installed on every machine.

`npm run try:model -- --interest "elevators" --target 62` prints every
candidate the model produced and, for each rejection, exactly which rule it
broke. It is the fastest way to see whether a given model is usable.

## Bead Frame (classic)

The first version, still in the app at `/classic`. It implements
[`architecture-v2.md`](architecture-v2.md) in full for two G1 skills, and is
where the ideas above were first worked out: a named misconception taxonomy,
a deterministic mastery policy, and fenced generation over a warm cache.

### Layers

```
app/                       L1  child app, caregiver app, /eval, API routes
components/                L1  CRA renderers, phase screens, caregiver panels
lib/session/               L2  phase machine + the hook that drives it
lib/policy/                L3  mastery · selection · component profile · flags
lib/skills/                L4  plug-in skill modules + registry
lib/content/               L5  warm cache, request paths, seed lexicon
lib/persistence/           L6  device-local store
lib/ai/                    L9  providers, prompts, validator, four surfaces
lib/core/                  —   shared vocabulary, bead-frame and ten-frame domains
```

### What ships

| Band | Skill | Manipulative | Status |
|---|---|---|---|
| K | Counting & cardinality to 20 | Ten-frame | Stub, reachable |
| **G1** | **Place value to 99** | **Bead frame** | **Ships** |
| **G1** | **Compose / decompose tens** | **Bead frame** | **Ships** |
| G1 | Add/subtract within 20 | Ten-frame | Stub, reachable |
| G2–G5 | — | — | Listed in the registry, not built |

Adding a band means adding a module to `lib/skills/` and one line in
`lib/skills/registry.ts`. Nothing above L4 names a skill.

### The parts that carry the argument

**The misconception taxonomy** (`lib/skills/bead-common.ts`). A child who
builds 34 as two tens and fourteen ones is marked wrong by every product on
the market. Here it is `NON_CANONICAL` — place-value understanding intact, a
named gap in exchange — and it routes to a completely different next lesson
than `COLUMN_SWAP` does. Classifier ordering is load-bearing and tested.

**The policy is rules, not a model** (`lib/policy/`). Mastery is a 5-task
window with three stated rules. Selection is a pure function. There is no
`Math.random` anywhere in L3: `tests/integration.test.ts` asserts that the
same child run twice produces a byte-identical trajectory.

**Generation is fenced** (`lib/ai/`). The model never picks a number, a
difficulty, or a next task. It writes language, and every sentence clears
`validateStem` first: target numeral present, no stray numeral, on the rung
the policy chose, ≤14 words, zero banned patterns — negation, vagueness,
idiom, ambiguous pronoun, multiple questions, exclamation. Two failed
attempts or a dead provider falls through to the nearest cached theme,
deterministically and silently.

**The beads are dragged, not clicked.** A tap-to-toggle bead is a checkbox
wearing a circle. Sweep along a rod and the beads come with you; the rod is
also a real `role="slider"`, so arrow keys and switch access do the same job.
The reason manipulatives work at all is that the hand does the arithmetic
before the head does, and that needs a continuous gesture.

**The exchange is performed, not narrated.** When ten ones are on the rod a
trade control appears — press it and ten ones gather, leave, and arrive as
one ten on the other rod. That single animation is what the whole app is
about, and it is the one moment worth putting motion into.

**Materials are vivid; the room is calm.** `lib/theme/materials.ts` holds bead
colours that are deliberately *not* the palette. §8's muted rule is about the
chrome — the cards, the background, the things a child is not looking at.
Applied to the materials as well it produces a screen with no focal point,
where the maths is the quietest thing present. Physical Montessori materials
are the opposite: calm wooden trays, vividly coloured beads, green for a
unit and blue for a ten, because colour is carrying the value. Saturated is
not the same as overstimulating — what the literature warns about is
flashing, churn and unpredictable change, and these sit still. Sensory level
0 swaps in a desaturated set that still distinguishes a ten from a one.

**Play without gamification.** A session is a path; each finished task lays
a stone and the character moves along it. A stone is laid for a task that was
*finished*, not one that was finished correctly — there is nothing to lose,
nothing to beat, and no way to fall behind. No timer, no score, no streak, no
confetti, and no sad face for an unexpected answer: an unexpected build is
information, and a character reacting badly to one would undo the premise.

**Latency is never the child's problem.** A cache miss waits at most 1.5 s for
the model; past that the nearest cached theme is served and the generation
finishes in the background, landing in the cache so the *next* task with that
interest is instant and personalised. `tests/mount.test.tsx` hangs the model
forever and asserts the child can still start.

**The four surfaces**: A novel-interest stems (§9.1, the headline),
B caregiver narrative (§9.2), C `UNCLASSIFIED` hypothesis (§9.3, shown to the
adult, never fed to the policy), D language-load adaptation (§9.4). Each has
a deterministic fallback, so `none` is a fully working configuration.

## Providers

Resolution order: `mlx` → `ollama` → `hosted` → `none`. See `.env.example`.

Set `OLLAMA_MODEL` to a model you actually have (`ollama list`) — the
provider reports itself unavailable rather than failing at request time if
the named model is missing. Measured here on `llama3` (8B): a batch of five
takes 13–16 s and two to three candidates survive the validator, which is
enough, since the app serves the first one that passes. The architecture
calls for a 3B (`llama3.2:3b`) and that is the better demo: faster, and
better at holding a 14-word limit.

### On-device: our own 4-bit Qwen (MLX)

`npm run llm:quantize` downloads Qwen2.5-1.5B-Instruct in full precision and
quantizes it on the Mac with MLX (3.1 GB → 0.87 GB, 4.5 bits per weight with
group-wise scales). `npm run llm:serve` serves it OpenAI-style on :8080 and the
`mlx` provider picks it up. The weights live in `.models/`, hidden and
read-only, because macOS Storage's "Large Files" clean-up lists them otherwise.

`npm run llm:bench` measures each rung on the app's real prompts and scores
the output with the app's own validator. Apple M4, 16 GB, fastest of 3 runs:

| Rung | Weights | Peak RAM | TTFT p50 | Decode tok/s | Request p50 | Speed-up | Stems accepted |
|---|---|---|---|---|---|---|---|
| bf16 | 3.09 GB | 3.40 GB | 897 ms | 25.0 | 5.97 s | 1.00× | 30/35 (86%) |
| 8-bit | 1.64 GB | 2.18 GB | 1943 ms | 36.3 | 5.43 s | 1.10× | 33/35 (94%) |
| 4-bit | 0.87 GB | 1.52 GB | 2053 ms | 65.0 | 3.91 s | 1.53× | 27/35 (77%) |
| **4-bit + prefix cache** | 0.87 GB | 1.50 GB | 864 ms | 58.0 | **2.93 s** | **2.04×** | 27/35 (77%) |
| 4-bit + speculative | 0.87 GB | 1.77 GB | 2602 ms | 55.7 | 4.86 s | 1.23× | 26/35 (74%) |

What the numbers say:

- **Quantization speeds up decoding, not prefill.** Generating tokens is
  memory-bound, so 4-bit weights decode 2.6× faster than bf16. Reading the
  prompt is compute-bound, and there the quantized matmuls are *slower*:
  time to first token doubles.
- **The prefix cache wins that back.** 388 of each prompt's tokens (system
  prompt + chat template) are identical on every request. They are prefilled
  once and the KV cache is trimmed back to them after each request, so only
  the task-specific tail is read. The result is 2× end to end, inside the
  architecture's 2–5 s budget. `mlx_lm.server` does the same with its LRU
  prompt cache (`cached_tokens` in its responses).
- **Speculative decoding was measured and rejected.** A 0.5B draft for a
  1.5B target is too close in cost to pay for its misses here.
- **Quality holds where it matters.** 4-bit accepts fewer candidates per
  batch, but every 4-bit request still produced 2–5 valid stems on the first
  attempt. bf16 produced none on one request and would have needed a retry.
  The app serves the first stem that passes.

With `none` resolved the Bead Frame caregiver app hides the free-text
interest field and offers the eight seed interests instead — the app
degrades to a catalogue rather than pretending a model is there. Tally Tales
falls back to its rules planner and built-in characters.

## The Bead Frame lesson bank

`lib/content/stems.json` — 296 sentences across 2 skills × their rungs ×
8 interests. Built deterministically from templates by `npm run stems:seed`,
with every entry put through `validateStem` before it is written; the seed
script fails the build rather than emitting a non-compliant sentence.

`npm run stems:generate` is the §13 day-14 path: it runs the same request
pipeline against a live model and merges accepted stems into the same file.
The committed bank is template-built, because a bank should be reproducible
from the repo alone.

## Data

Device-local `localStorage`. No account, no server, no telemetry. Export
writes a JSON file; delete removes everything and cannot be undone.

Deliberately absent: camera, microphone, affect inference, analytics SDKs,
third-party identifiers. Affect detection for this population is immature
and ethically fraught; not building it is a stated position.

With the MLX or Ollama path, child data stays on-device end to end.

## Eval

The eval covers Bead Frame's stem generation; extending it to Tally Tales'
model calls is open work (see `HANDOVER.md`).

`npm run eval` runs the naive prompt and the constrained pipeline over the
same task space and writes `eval/results.json`, which `/eval` renders:
schema validity, structure preservation, literal-language compliance, accept
and fallback rates, spread across seed vs. novel interests, retry counts and
latency distribution.

With no provider reachable the harness stops and says so. There is no sample
data and no simulated arm — a chart with no run behind it is a fabrication.

## Not a clinical tool

A learning tool, not a therapeutic intervention. No clinical claim. The
attention flags in the caregiver app are observations about sessions phrased
as such, and the narrative surface is validated against a clinical-vocabulary
blocklist before it is shown.
