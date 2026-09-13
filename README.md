# Bead Frame

A manipulative-first maths engine for autistic K–5 learners.

The diagnostic engine is deterministic by design — a child's next problem
should not depend on a sampling temperature. The content engine is generative
by necessity — no catalogue can cover every child's interests, which is
exactly why every existing product is built for a median autistic child who
does not exist.

Implements [`architecture-v2.md`](../architecture-v2.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No model is required. The committed lesson bank covers every shipped skill,
rung and seed interest, so a full session runs offline with zero model calls.

| Route | What it is |
|---|---|
| `/` | The child app — the session (§4) |
| `/caregiver` | Profile, progress, flags, theme, export and delete (§12) |
| `/eval` | Generation eval results, when a run exists (§10) |
| `/preview` | Every screen at once, across palettes and CRA levels (dev tool) |

## Commands

```bash
npm run check            # typecheck + 84 tests + rebuild the lesson bank
npm test                 # tests only
npm run stems:seed       # rebuild lib/content/stems.json from the templates
npm run stems:generate   # widen the bank with a model (needs a provider)
npm run eval             # naive prompt vs constrained pipeline (needs a provider)
npm run try:model        # one-shot check that the resolved provider works
```

`npm run try:model -- --interest "elevators" --target 62` prints every
candidate the model produced and, for each rejection, exactly which rule it
broke. It is the fastest way to see whether a given model is usable.

## Layers

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

## The parts that carry the argument

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

Resolution order: `ollama` → `hosted` → `none`. See `.env.example`.

Set `OLLAMA_MODEL` to a model you actually have (`ollama list`) — the
provider reports itself unavailable rather than failing at request time if
the named model is missing. Measured here on `llama3` (8B): a batch of five
takes 13–16 s and two to three candidates survive the validator, which is
enough, since the app serves the first one that passes. The architecture
calls for a 3B (`llama3.2:3b`) and that is the better demo: faster, and
better at holding a 14-word limit.

With `none` resolved the caregiver app hides the free-text interest field
and offers the eight seed interests instead — the app degrades to a
catalogue rather than pretending a model is there.

## The lesson bank

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

With the Ollama path, child data stays on-device end to end.

## Eval

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
