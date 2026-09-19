# Tally Tales

**Maths stories for Kindergarten to 2nd grade, built first for autistic learners.**
Submitted to the Nerdy AI Hackathon, *K–5 Math Game* theme.

A child meets a friend built around the show they love, and every puzzle is a
short story in that friend's world: Pooh counting honey pots, a train
picking up carriages, Shinchan sharing cookies. An on-device AI model plans
each next puzzle and writes its story. The numbers, the answer check and the
safety limits are plain code the model cannot override.

Autistic children are served badly at both ends of the market. Mainstream
maths apps assume a neurotypical learner: timers, streaks, confetti,
figurative language, sudden jumps in difficulty. Autism apps get the sensory
design right, but maths is one tile among many, and adaptivity means a
difficulty slider. Neither can reach *one* child, because autistic learners
vary so widely in maths, language, attention and interests. Hand-written
content is always written for a median child who does not exist. Generated
content, fenced by rules, can be written for the child in front of it.

## A session, start to finish

1. **A grown-up sets it up once.** Name, age and school year. How much help
   the child needs, how they communicate, whether colours or sounds are
   upsetting, how they like a right answer marked, and their favourite show.
   Last, consent for the app to adapt.
2. **The friend is made.** The grown-up picks what the friend looks like from
   eleven drawable characters. The model names it, picks what it counts and
   where it keeps them, and writes its catchphrase. It is made once and never
   changes.
3. **A picture schedule shows the plan:** *First 5 puzzles → then a break.*
   Meanwhile the model writes the opening of today's story.
4. **New skills are shown first.** A short "watch me" demo plays with the
   same controls the child is about to use; it can be skipped.
5. **The child solves puzzles** by tapping answers or sliding beads on an
   upright bead frame. Children can tap each item to count it. A wrong answer
   gets one calm hint aimed at the *kind* of slip, then the answer is shown
   gently. There is no red cross, sad face or "wrong" sound anywhere.
6. **Between puzzles, the model chooses what comes next** from a menu of safe
   steps: harder, the same again, easier, another skill, or a review of the
   skill underneath.
7. **A break.** "Last puzzle. Then a break." comes before the end, and
   *I need a break* is always on screen. It opens a breathing pause with the
   friend, and the child can come back or be all done.
8. **The grown-up sees the record.** A learning profile, notes worth a look,
   *Try it at home* activities, and a printable report for a teacher or
   therapist with space for IEP goals.

## Built around how autistic children learn

Each feature is there for a reason; the sources are in [References](#references).

| What the app does | Why |
|---|---|
| Picture schedule before every session, a warning before the last puzzle, the same screen order every time | Predictability; visual activity schedules are an evidence-based practice [2][1] |
| "Watch me first" demo of every new skill, played on the real controls | Modelling and video modelling [3][1] |
| One calm hint for the specific slip, then the answer shown kindly; no "wrong" sound or animation | Prompting and errorless-style support; an unexpected answer is information, not failure [1] |
| Pictures → dots → numbers only, for the same question | The concrete–representational–abstract sequence [4][10] |
| The upright bead frame, dragged rather than tapped | Concrete and virtual manipulatives for maths [10] |
| Stories set in the child's favourite show | Using the child's interests to engage and motivate [5] |
| Literal language: every sentence is checked for negation, vague words, idioms, unclear "it/they", stacked questions and exclamation marks | Figurative language is often harder to follow [6] |
| One calm colour on request, no-movement mode, still or plain background, volume, soft sounds, easy-to-read font, larger text | Sensory differences are common and vary a lot between children [7] |
| Story length follows how the child communicates; everything can be read aloud | Language and maths skills can be very uneven for the same child [8] |
| *I need a break* at any time; breaks are a pause, not an end | Self-regulation and choice |
| Four ways to mark a right answer, from a big cheer to a quiet tick | Reinforcement that suits the child [1] |
| Notes and reports speak about observations, never diagnoses | Respectful, non-deficit language [9] |

No timers, scores, streaks or leaderboards. No camera, microphone,
emotion detection or analytics. That is a stated position, not a missing
feature.

## How the AI is used, and where it is not

Tally Tales runs two small models **on the laptop**. Nothing about the child
leaves the device.

| Model | Job | Runs on |
|---|---|---|
| **Qwen2.5-1.5B-Instruct**, quantized by us to 4-bit with MLX | designs the friend, plans each puzzle, writes story lines, writes the progress note, guesses at answers the rules can't explain | `npm run llm:serve`, :8080 |
| **Qwen3-TTS 1.7B VoiceDesign**, 6-bit | reads everything aloud in one cheerful child's voice, streamed as it is made | `npm run tts:serve`, :8091 |

**The rules that make a small model safe to put in front of a child**

- **The model never picks a number and never marks an answer.** Questions come
  from a seeded generator (`lib/learn/generate.ts`); answers are checked in
  code.
- **The model chooses from a menu, never free-form.** Before each puzzle the
  code builds the safe next steps (`planOptions` in `lib/learn/policy.ts`).
  Nothing harder straight after a miss, at most one level up, review only
  after a slip, and no repeating something plainly easy. The model picks one
  and gives a reason, which the grown-up can read. The option letters are
  shuffled each time, so a habit of picking "A" can't steer a child anywhere.
- **Every output is checked before anyone sees it.** A story must contain
  exactly the question's numbers (no stray number, no giving the answer
  away), mention what the question is about, and pass the literal-language
  rules. A progress note is fact-checked sentence by sentence against the
  record, and rejected if it praises a skill the child missed or uses
  clinical words.
- **Every call has a time budget and a fallback.** On a timeout, bad JSON or a
  failed check, the rules and templates answer instead, so the child never
  waits. With no model at all, the whole app still works.
- **With adaptation switched off** by the grown-up, puzzles come in a fixed
  order at a fixed level and the profile is not changed.

**Measured on an Apple M4 laptop (16 GB)**

- Quantizing Qwen2.5-1.5B from 3.1 GB to 0.87 GB (4-bit), plus a shared-prefix
  cache: about **2× faster** end to end than full precision (2.9 s against
  6.0 s per generation request).
- Choosing the next puzzle and writing its story: **0.7–1.5 s**.
- Story lines accepted by the checks: **27 of 30** in one run across five
  worlds and three grades; the other 3 fell back to templates.
- Voice: first sound after **~0.5 s** for a new line, and **~0.01 s** for a line
  heard before (lines are kept on disk).
- In simulation, the planner took a child who answers everything right
  through all four 1st-grade skills. It held a struggling child at level 1
  with reviews, and varied the skills for a mixed child.

To check the model any time, `curl -X POST localhost:3000/api/learn/health`
runs every job once on a made-up child and shows what came back, how long it
took, and whether the app used it or fell back to its rules.

## Run it

Needs Node 20+. The on-device models need an Apple silicon Mac with
[`uv`](https://docs.astral.sh/uv/).

```bash
npm install
npm run dev              # http://localhost:3000 — works with no model at all
```

For the full experience, in two more terminals:

```bash
npm run llm:quantize     # once: downloads Qwen2.5-1.5B and quantizes it to 4-bit (~0.9 GB)
npm run llm:serve        # the model, on :8080
npm run tts:serve        # the voice, on :8091 (first run downloads ~2.7 GB)
```

No environment needs activating: each script uses its own Python
environment. `.env.example` lists the optional settings, including Ollama or
any hosted OpenAI-compatible endpoint instead of MLX.

```bash
npm run check            # typecheck + lint + tests
```

**Try it with sample data.** `demo/sample-history.json` is ten sessions over
three weeks for "Adi", a 1st-grader who loves Shinchan. The puzzles, the
diagnosis of every slip, the levels and the notes come from the app's own
code, run on a simulated child (`npm run demo:data` rebuilds it). Load it
with **Grown-ups → Import from JSON** to see the learning profile, notes,
session history and report filled in.

The browser keeps separate data per address, so
`http://127.0.0.1:3000` and `http://localhost:3000` act as two devices: one
with Adi's history, and one starting fresh. An incognito window always
starts fresh.

| Route | What it is |
|---|---|
| `/` | The child app: setup on first open, then story sessions |
| `/grown-ups` | Notes, learning profile, the friend editor, sensory and voice settings, at-home ideas, session history, export and import |
| `/grown-ups/report` | One-page report for a teacher or therapist; prints to PDF |

## What is in the repo

```
app/page.tsx                  child app
app/grown-ups/                grown-ups page and printable report
app/api/learn/                model calls: character, plan, premise, review, hypothesis, health
app/api/speak/                the voice (streamed), with browser and macOS fallbacks
components/learn/             setup, session, questions, bead frame, characters, scenes, cheers
lib/learn/generate.ts         question generator — every number comes from here
lib/learn/diagnose.ts         names the slip behind a wrong answer
lib/learn/policy.ts           the safe-options menu and the rules-only planner
lib/learn/ai.ts               prompts, validation and fallbacks for every model call
lib/learn/notes.ts            observations for grown-ups
lib/learn/sound.ts            voice and sound effects
lib/ai/                       model providers (MLX, Ollama, hosted, none) and language rules
scripts/mlx/                  quantize and serve Qwen
scripts/tts/                  the voice server
scripts/demo-data.mts         builds the sample history
demo/sample-history.json      sample history to import
tests/                        generator, planner, validators, notes
```

Everything the app stores is in the browser's `localStorage`. There are no
accounts and no server-side storage. Grown-ups can export it as JSON,
import it on another device, or delete it.

## Limits and next steps

- **K to 2nd grade only.** 3rd to 5th grade (times tables, fractions, area)
  are listed in the curriculum but not built.
- **Not yet tested with children or families.** Caregiver and teacher
  feedback is the most important next step.
- **The on-device voice and model need an Apple silicon Mac.** Elsewhere the
  app uses the browser's own voice and its rules, or a hosted model.
- **The quick-pick shows in setup** are real TV shows. They should become
  generic interests before any public release; typing a show stays free.
- **A learning tool, not a therapeutic intervention.** It makes no clinical
  claim.

## References

The research that shaped how Tally Tales supports autistic children:

1. Steinbrenner, J. R., Hume, K., Odom, S. L., Morin, K. L., Nowell, S. W., Tomaszewski, B., Szendrey, S., McIntyre, N. S., Yücesoy-Özkan, S., & Savage, M. N. (2020). *Evidence-based practices for children, youth, and young adults with autism.* University of North Carolina at Chapel Hill, Frank Porter Graham Child Development Institute, National Clearinghouse on Autism Evidence and Practice.
2. Knight, V., Sartini, E., & Spriggs, A. D. (2015). Evaluating visual activity schedules as evidence-based practice for individuals with autism spectrum disorders. *Journal of Autism and Developmental Disorders, 45*(1), 157–178.
3. Bellini, S., & Akullian, J. (2007). A meta-analysis of video modeling and video self-modeling interventions for children and adolescents with autism spectrum disorders. *Exceptional Children, 73*(3), 264–287.
4. Bouck, E. C., Satsangi, R., & Park, J. (2018). The concrete–representational–abstract approach for students with learning disabilities: An evidence-based practice synthesis. *Remedial and Special Education, 39*(4), 211–228.
5. Gunn, K. C. M., & Delafield-Butt, J. T. (2016). Teaching children with autism spectrum disorder with restricted interests: A review of evidence for best practice. *Review of Educational Research, 86*(2), 408–430.
6. Kalandadze, T., Norbury, C., Nærland, T., & Næss, K.-A. B. (2018). Figurative language comprehension in individuals with autism spectrum disorder: A meta-analytic review. *Autism, 22*(2), 99–117.
7. Robertson, C. E., & Baron-Cohen, S. (2017). Sensory perception in autism. *Nature Reviews Neuroscience, 18*(11), 671–684.
8. Jones, C. R. G., Happé, F., Golden, H., Marsden, A. J. S., Tregay, J., Simonoff, E., Pickles, A., Baird, G., & Charman, T. (2009). Reading and arithmetic in adolescents with autism spectrum disorders: Peaks and dips in attainment. *Neuropsychology, 23*(6), 718–728.
9. Bottema-Beutel, K., Kapp, S. K., Lester, J. N., Sasson, N. J., & Hand, B. N. (2021). Avoiding ableist language: Suggestions for autism researchers. *Autism in Adulthood, 3*(1), 18–29.
10. Root, J. R., Browder, D. M., Saunders, A. F., & Lo, Y. (2017). Schema-based instruction with concrete and virtual manipulatives to teach problem solving to students with autism. *Remedial and Special Education, 38*(1), 42–52.

The easy-to-read font is Atkinson Hyperlegible, designed by the Braille
Institute of America for readers with low vision.
