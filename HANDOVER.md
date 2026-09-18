# Handover

State of the project as of **18 Sep 2026**, the Nerdy AI Hackathon
submission day (deadline 11:59 PM CDT). Read this first, then `README.md`
and `architecture-v2.md`. The open work is in [TODO](#todo) at the end.

## What this is

A K–5 maths game built first for autistic learners, entered under the
hackathon's "K–5 Math Game" theme. Two ideas carry it:

1. **Diagnose, don't score.** A wrong answer is classified into a named
   mistake (e.g. building 34 as 2 tens + 14 ones is `NON_CANONICAL`, not
   "wrong") and that name decides the next task.
2. **Rules choose, the model writes.** The numbers, the answer check and
   the limits on progression are deterministic code. The language model
   writes the story around the numbers, in the child's own interest, and
   every sentence it writes passes a validator before a child sees it.

No timers, scores, streaks or confetti. Data is device-local
(`localStorage`); no accounts, no telemetry, no camera or microphone.

## Two apps live in this repo

The project changed direction in its last days, and the README still
describes the first version.

| Route | App | Code | Status |
|---|---|---|---|
| `/` | **Tally Tales**: the current app. Onboarding → a character the model designs → story-framed questions across K, G1, G2 | `app/page.tsx`, `components/learn/`, `lib/learn/`, `app/api/learn/*`, `app/api/speak` | Active. This is what the demo shows |
| `/grown-ups` | Caregiver view for Tally Tales: notes, progress, sensory and voice settings, reset | `app/grown-ups/page.tsx`, `lib/learn/notes.ts`, `lib/learn/sensory.ts` | Active |
| `/classic` | **Bead Frame v1**: the original architecture-v2 app. Bead-frame place value, CRA phases, mastery policy | `app/classic/page.tsx`, `components/{child,manipulatives}`, `lib/{core,policy,session,skills,content}` | Complete, frozen |
| `/caregiver` | Caregiver app for v1 | `app/caregiver/page.tsx`, `components/caregiver/` | Complete, frozen |
| `/eval` | Renders `eval/results.json` from `npm run eval` | `app/eval/page.tsx`, `scripts/eval.mts` | Page works; no run has been done |
| `/preview` | Every v1 screen at once (dev tool) | `app/preview/page.tsx` | Dev only |

Both apps share `lib/ai/` (providers, validator, banned-pattern lists).

### Tally Tales in one screen

- `lib/learn/curriculum.ts`: grades and skills. K, G1 and G2 are live.
  G3–G5 are listed with `available: false`.
- `lib/learn/generate.ts`: builds each question from a seeded RNG. **The
  numbers come from here, never from the model.**
- `lib/learn/diagnose.ts`: maps an answer to a `Mistake` (`off-by-one`,
  `digits-swapped`, `regrouping`, `place-value`, …).
- `lib/learn/policy.ts`: `rulePlan` is a complete deterministic planner.
  `guardPlan` fences the model's suggestion: clamped to the child's band,
  and after a wrong answer the level can only stay or drop.
- `lib/learn/ai.ts`: the model calls, each with a time budget and a rules
  fallback: `designCharacter` (onboarding), `planNext` (before each
  question), `sessionPremise` (story opening), `reviewSession` (after a
  session), `guessAnswer` (explains an unrecognised answer, adult only).
- `lib/learn/worlds.ts`: themes, characters and icons the UI can draw.
  The model chooses from these; it never draws.

**Design shift worth knowing:** in v1 the model never chose the next task.
In Tally Tales `planNext` may *suggest* the skill and level, and
`guardPlan` constrains it. Keep that guard and its tests if you change the
planner.

### Sound, as built

All sound is made on the device; there are no audio files.

- `lib/learn/sound.ts`: Web Audio effects (bead click, coin, count pop,
  tick), the two cheers, and `speak()`.
- `speak()` tries voices in this order:
  1. **natural**: Kokoro-82M served by `npm run tts:serve` on :8091,
     reached through `/api/speak` (`engine: "natural"`)
  2. **browser**: `speechSynthesis`
  3. **mac**: macOS `say` through `/api/speak` (`engine: "system"`)
- Voice styles `child` / `bear` / `grownup` (`lib/learn/sensory.ts`).
  Kokoro pitch-shifts for them (`scripts/tts/serve.py`); the browser path
  looks for the macOS voices "Junior" and "Grandpa" and pitch-shifts a
  default voice when they are missing.
- Caregiver controls on `/grown-ups`: read-aloud (`auto` / `tap` / `off`),
  volume, effects on/off, voice style, cheer style (`components/learn/Cheer.tsx`).
  A sound-sensitive profile starts at half volume.

## Run it

```bash
npm install
npm run dev                  # http://localhost:3000, no model needed
npm run check                # typecheck + tests + rebuild the v1 lesson bank
npx next build --webpack     # production build (see Known issues)
```

Everything works with no model: each AI call falls back to rules. To turn
the model and voices on (Apple silicon only):

```bash
npm run llm:quantize         # once: Qwen2.5-1.5B → 4-bit MLX, into .models/
npm run llm:serve            # :8080, picked up automatically
npm run tts:serve            # Kokoro voices on :8091
```

Provider order: `mlx` → `ollama` → `hosted` → `none`. See `.env.example`.
`.models/`, `.venv-mlx/` and `.venv-tts/` are gitignored and are rebuilt
by the scripts above.

## Where things stand

**Done**
- v1 Bead Frame: full architecture-v2 scope for two G1 skills, four AI
  surfaces, deterministic policy, offline lesson bank (`lib/content/stems.json`).
- Tally Tales: onboarding, model-designed character, K/G1/G2 question
  generation, diagnosis, guarded planner, session review, grown-ups page,
  sensory and voice settings, offline TTS.
- On-device model: own 4-bit quantization, benchmark in `eval/llm-bench.md`
  (4-bit + prefix cache ≈ 2× faster than bf16, 2.9 s per request on an M4).
- Tests in `tests/`, including determinism and "model hangs forever".

## Known issues

- `npm run build` uses Turbopack, which failed on the dev machine because
  Next's native SWC binary was missing. `next build --webpack` works.
- `AGENTS.md` / `CLAUDE.md` are rewritten by `next dev`; commit them as-is.

## Rules the code keeps (please keep them)

- The model never chooses a number, and never marks an answer right or wrong.
- Every model output is validated; on failure or timeout, the rules answer.
- The child never waits on the model beyond a fixed budget.
- Nothing shown to adults uses clinical or diagnostic vocabulary
  (`BANNED_CLINICAL` in `lib/ai/validate.ts`). A learning tool, not a
  therapeutic one.
- No affect detection, camera, microphone or analytics. That is a stated
  position, not a missing feature.
- No "wrong" sound or animation, in any cheer style.

## TODO

### Sound (next piece of work)

The voice chain was built on and for one Mac. Off a Mac, and in Safari,
parts of it go silent. Items marked `TODO(sound)` in the code point at the
exact lines.

- [ ] **Speech goes silent for good off a Mac.** In `speakBrowser`
      (`lib/learn/sound.ts`), any browser-voice error or a start slower
      than 1.2 s sets `preferMac = true` permanently. Every later line then
      goes to `/api/speak` `engine: "system"`, which returns 404 when the
      server is not macOS, so the child hears nothing for the rest of the
      visit. Only set `preferMac` after `/api/speak` has worked once, and
      otherwise keep retrying the browser voice.
- [ ] **Safari may drop speech.** `speak()` awaits a fetch to the natural
      voice before trying the browser voice, so the browser utterance
      starts outside the tap that Safari requires (see the note at the top
      of `sound.ts`). Check `/api/speak` health once at load (or via
      `/api/learn/health`), and skip the natural attempt when it is down
      instead of discovering it per line.
- [ ] **"Big cheer" ignores the read-aloud setting.** `playWoohoo` calls
      `speak("Woo hoo!")` even when read-aloud is `off`, and `speak()`
      calls `stopSpeaking()`, cutting off the line the child was hearing.
      Pass the read-aloud setting to `playCheerSound`, and play the cheer
      as a tone-only variant when voice is off.
- [ ] **Character voices depend on macOS.** The `child` and `bear` styles
      look for the macOS voices "Junior" and "Grandpa"; elsewhere a default
      voice is pitch-shifted, which sounds robotic. Options: pre-render the
      fixed lines (cheers, instructions) with Kokoro into small audio files
      shipped in `public/`, and use the browser voice only for generated
      story text.
- [ ] **Deploy path for voice.** Kokoro and `say` do not exist on a hosted
      server. Decide what a deployed build uses (browser voice only,
      pre-rendered clips, or a hosted TTS endpoint behind `/api/speak`)
      and make `/api/speak` return a clear "not available" the client
      remembers, rather than a failed request per line.
- [ ] **Sound tests.** Nothing covers `lib/learn/sound.ts`. At minimum,
      unit-test the fallback order and the read-aloud / volume / effects
      settings with `speechSynthesis`, `Audio` and `fetch` stubbed.
- [ ] **Check the settings in practice.** Try every combination of
      read-aloud × cheer style × sound-sensitive on `/grown-ups` in Safari
      and Chrome, and confirm a sound-sensitive profile never hears a sound
      louder than half volume (the cheers use their own gain levels).

### Everything else

- [ ] **README is stale.** It describes v1 as the app at `/`. Rewrite the
      top around Tally Tales and move v1 into a "Bead Frame (classic)"
      section. Its test count also needs updating.
- [ ] **Run the eval.** `npm run eval` with a provider up, then check
      `/eval`. `eval/results.json` is gitignored by design, so screenshot it
      or commit a summary.
- [ ] **Extend the eval to Tally Tales.** `planNext`, `reviewSession` and
      the story text have unit tests but no naive-vs-constrained eval.
- [ ] **Deployment.** No live URL yet. The hosted provider path exists
      (`lib/ai/providers/hosted.ts`); MLX and TTS do not run on a server.
- [ ] **Brand names in onboarding.** `components/learn/Onboarding.tsx`
      offers real TV shows as quick picks. Swap for generic interests
      before any public release; free text still accepts any show.
- [ ] **G3–G5** in `lib/learn/curriculum.ts`.
- [ ] **Real-user testing.** None done yet. Caregiver or teacher feedback is
      the biggest gap in the argument.
- [ ] Unused-variable lint warnings in `lib/learn/ai.ts` (`npx eslint`).
