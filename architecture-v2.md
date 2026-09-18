# Adaptive Manipulative-First Math Engine for Autistic Learners
## System Architecture — v2

*Changes from v1: AI layer promoted to a first-class section (§9), live
generation path added alongside the warm cache, provider abstraction for
Ollama, four AI surfaces defined, build order revised.*

---

## 1. The problem

Autistic K-5 students are served badly at both ends of the market.

**Mainstream math apps** assume a neurotypical learner: timers, streaks,
confetti, figurative language, abrupt difficulty jumps. Each is a documented
barrier — sensory load, unpredictability, literal-language processing.

**Autism apps** get sensory design right but are broad special-education
catalogues. Math is one tile among eighty. Adaptivity means difficulty-tuning,
not diagnosis.

**Neither diagnoses.** Both score. A child who represents 34 as two tens and
fourteen ones is marked wrong by every product on the market — despite having
demonstrated place-value understanding and a specific, nameable gap in
exchange.

**Neither can reach one child.** Every catalogue is authored for a median
learner. The central finding of the autism-math literature is that the median
autistic learner does not exist: the population is markedly heterogeneous in
math ability, working memory, language tolerance, and interest. Hand-authored
content cannot resolve this. Generated content can.

**What we build:** a manipulative-first math engine with a deterministic
diagnostic core and a generative content layer — the first because a child's
progression should not depend on a sampling temperature, the second because a
child's interests cannot be enumerated in advance.

**What we do not claim:** a learning tool, not a therapeutic intervention. No
clinical claim.

---

## 2. Scope: K-5 coverage vs. what ships

Skill-agnostic architecture. Every skill is a plug-in module conforming to one
interface (§5).

| Band | Skill | Manipulative | Status |
|---|---|---|---|
| K | Counting & cardinality to 20 | Counters, ten-frame | Stub |
| **G1** | **Place value to 99** | **Bead frame** | **SHIPS** |
| **G1** | **Compose / decompose tens** | **Bead frame** | **SHIPS** |
| G1 | Add/subtract within 20 | Ten-frame | Stub |
| G2 | Place value to 999, regrouping | Base-ten blocks | Roadmap |
| G3 | Multiplication as arrays | Array grid | Roadmap |
| G3 | Fractions as numbers | Fraction bars | Roadmap |
| G4 | Multi-digit multiplication | Area model | Roadmap |
| G5 | Fraction & decimal operations | Decimal grid | Roadmap |

---

## 3. Layer diagram

```
┌────────────────────────────────────────────────────────┐
│ L1  PRESENTATION                                       │
│     Child app (calm, literal, tap-first)               │
│     Caregiver app (profile, progress, settings)        │
├────────────────────────────────────────────────────────┤
│ L2  SESSION ORCHESTRATOR                               │
│     Phase machine: PREVIEW → MODEL → GUIDED → INDEP.   │
├────────────────────────────────────────────────────────┤
│ L3  ADAPTIVE POLICY            (deterministic)         │
│     Mastery · Component profile · Next-task · Flags    │
├────────────────────────────────────────────────────────┤
│ L4  SKILL MODULES              (plug-in)               │
│     classify() · remediation map · CRA renderers       │
├────────────────────────────────────────────────────────┤
│ L5  CONTENT                                            │
│     Warm cache (stems.json) ─┬─ hit  → instant         │
│                              └─ miss → L9 generation   │
├────────────────────────────────────────────────────────┤
│ L6  PERSISTENCE                (device-local)          │
│     Profile · event log · mastery state                │
└────────────────────────────────────────────────────────┘
                          ▲
┌─────────────────────────┴──────────────────────────────┐
│ L9  AI LAYER                                           │
│     Provider: Ollama | Hosted | None                   │
│     Surfaces: novel interest · caregiver narrative ·   │
│               UNCLASSIFIED hypothesis · language load  │
│     Every output passes validateStem() before use      │
└────────────────────────────────────────────────────────┘
```

**Design rule, stated explicitly:** the model never picks a number, a
difficulty, or a next task. It writes language. Selection is rules.

---

## 4. Session flow

```
PREVIEW      "Next: three number tasks. Then a break."
   ↓         Doubles as the generation wait screen (§9.4)
MODEL        System animates the solution step by step
   ↓
GUIDED       Child acts, faded prompt available
   ↓         Errors → errorless retry, not a red X
INDEPENDENT  Child acts unaided; this is what scores
   ↓
CLASSIFY     Deterministic → Misconception code
   ↓
LOG + SELECT Event written, policy picks next task
```

**CRA within the task.** Same `BeadState`, three renderings — concrete
(tappable beads), representational (drawn sticks and dots), abstract
(`3 tens + 4 ones = 34`). Advancement is representation-first, then difficulty.

---

## 5. Skill module interface

```ts
interface SkillModule<TState> {
  id: string;
  band: "K" | "1" | "2" | "3" | "4" | "5";
  manipulative: "beadFrame" | "tenFrame" | "baseTen" | "arrayGrid" | "fractionBar";

  emptyState(): TState;
  evaluate(state: TState): number;

  classify(state: TState, task: Task): Misconception;
  remediation: Record<Misconception, Remediation>;

  render: {
    concrete: Component<TState>;
    representational: Component<TState>;
    abstract: Component<TState>;
  };

  taskSpace(difficulty: Difficulty): TaskSpec[];
}
```

---

## 6. Adaptive policy (L3) — deterministic

### 6.1 Mastery
Per (skill, difficulty, representation), rolling window of last 5 independent
results.
- **Advance** — 4/5 correct AND no misconception twice
- **Hold** — otherwise
- **Step back** — 3 consecutive same-code failures

### 6.2 Next-task selection
```
classify() → remediation[code] → taskSpace(difficulty) filtered by focus
          → content lookup (§7) → Task
```

### 6.3 Component profile

| Component | Derived from |
|---|---|
| Place-value grasp | COLUMN_SWAP, TENS_OMITTED, ONES_OMITTED rates |
| Exchange grasp | NON_CANONICAL, CARRY_DROPPED rates |
| Counting accuracy | OFF_BY_ONE_* rate |
| Representation reach | Highest mastered CRA level |
| Language load tolerance | Latency × accuracy vs. stem word count |

The last one feeds §9.3.

### 6.4 Attention flags
Observations for caregiver review. Never a diagnosis.
- Same misconception persisting 3+ sessions post-remediation
- Median latency rising >50% week over week
- Abandonment rate above threshold
- Accuracy collapse at a specific representation level (generalisation gap)

---

## 7. Content layer — warm cache with live fallthrough

```
request(skill, difficulty, taskType, interest)
   │
   ├─ cache hit          → return instantly, 0 ms, 0 cost
   │
   └─ cache miss (novel interest)
         → L9 generate (batch of 5)
         → validateStem() each
         → pass: write to cache, return
         → fail ×2 or provider down: nearest cached theme, silently
```

**Cache** is `stems.json`, pre-generated offline across the full cross-product
of shipped skills × difficulties × ~8 seed interests. Roughly 300 stems,
committed to the repo.

**Normal operation never touches the model.** The model exists for the case the
cache cannot cover — which is the case that matters.

---

## 8. Personalization

```ts
interface Theme {
  character: CharacterId;      // parent-selected avatar
  interest: string;            // FREE TEXT — this is the point
  palette: PaletteId;          // muted sets only
  soundLevel: 0 | 1 | 2;
  motionLevel: 0 | 1 | 2;
  narrationSpeed: number;
}
```

Rules:
- **Parent-controlled**, changed from the caregiver app, not mid-task
- **Swappable any time** — interests change; the app must not punish that
- **Previewed** before taking effect
- **Invariant** — a theme change alters sprites, nouns, palette. Never
  `targetNumber`, difficulty, or skill. Asserted in the eval (§10)
- **Conservative defaults** — sound 1, motion 1, muted palette

`interest` being free text is what forces §9.1 to exist.

---

## 9. AI layer (L9)

### 9.0 Provider abstraction

**Ollama runs on localhost. It does not exist on a deployed host.** The
interface below is what keeps the deployed build honest.

```ts
interface LLMProvider {
  id: "ollama" | "hosted" | "none";
  available(): Promise<boolean>;
  generate(req: GenerationRequest): Promise<GeneratedStem[]>;
}
```

Resolution order at runtime:
1. `ollama` — `http://localhost:11434`, used in dev and for the recorded demo
2. `hosted` — free-tier endpoint, used by the deployed build
3. `none` — cache-only; UI hides the free-text interest field

Model: `llama3.2:3b` or `qwen2.5:3b`. A 3B model is ample for 14-word
sentences and runs fast enough on a laptop. Request JSON via Ollama's `format`
option and validate the result regardless — never trust the shape.

### 9.1 Surface A — novel interest generation *(headline)*

Parent types any interest. Washing machines. Elevators. A specific dinosaur.
No catalogue covers this; generation does.

```
"washing machines" + targetNumber 34 + difficulty 3
   → 5 candidate stems
   → validateStem(): numeral present, in band, ≤14 words,
     zero banned patterns
   → cached, served
```

The numbers and difficulty are ours. Only the language changes. That
invariance is provable and is measured in §10.

**Why this is the demo:** a judge names any interest and the app teaches place
value with it in under a minute, with structure demonstrably unchanged.

### 9.2 Surface B — caregiver narrative

One call per session. Input: event log slice. Output: the plain-English
paragraph a parent can act on. Synthesis and tone are real model strengths;
`NON_CANONICAL ×4` is not something anyone should have to read.

Constrained to observation language (§6.4). No diagnostic vocabulary.

### 9.3 Surface C — UNCLASSIFIED hypothesis

When the rule-based classifier returns `UNCLASSIFIED`, pass the bead state and
target to the model and ask what the child might have been doing.

Shown to the caregiver, labelled as a hypothesis. **Never drives task
selection** — the policy falls back to `nextDifficulty: 1`.

Rules where they are reliable, model where they are not, boundary explicit.

### 9.4 Surface D — adaptive language load

Regenerate the same correction at the reading level the child's profile
tolerates (§6.3). Connects the generative layer to the diagnostic one.

### 9.5 Latency handling

A 3B local model returns a 5-stem batch in roughly 2–5 s. The PREVIEW screen
(§4) covers it — the wait *is* the predictability feature, not a spinner
bolted on. Generation for task N+1 starts while the child works on task N.

---

## 10. Eval harness

Baseline naive prompt vs. constrained pipeline, run offline over the cache plus
a novel-interest sample:

- Schema validity rate
- **Structure preservation** — correct numeral, correct band, invariant across
  interest swap
- **Literal-language compliance** — zero banned patterns (negation, idiom,
  ambiguous pronoun, multiple questions, exclamation)
- Compliance spread across interests — does "washing machines" degrade vs.
  "trains"?
- Rejection and retry rates
- Generation latency distribution

This is the technical slide. Most entries will have none.

---

## 11. Persistence

Device-local `localStorage`. No account, no server, no telemetry.

```ts
interface Event {
  ts: number;
  skillId: string;
  taskId: string;
  phase: "GUIDED" | "INDEPENDENT";
  difficulty: Difficulty;
  representation: "C" | "R" | "A";
  result: Misconception;
  latencyMs: number;
  promptUsed: boolean;
  abandoned: boolean;
}
```

**Deliberately absent:** camera, microphone, affect inference, analytics SDKs,
third-party identifiers. Affect detection for this population is immature and
ethically fraught; not building it is a stated position.

Local-first also means the Ollama path keeps child data on-device end to end.

---

## 12. Caregiver app

Profile setup · component profile (five bars, plain language) · misconception
history · attention flags · IEP goal tag per skill · theme controls · export
and delete.

---

## 13. Build order — Sep 11 to Sep 18

| Day | Deliverable |
|---|---|
| **11 Sep** | Scaffold deployed. Bead frame interactive. Types locked. |
| **12 Sep** | Classifier + unit tests. Phase machine. |
| **13 Sep** | CRA renderers. Mastery + next-task policy. Theme model. |
| **14 Sep** | Ollama batch run → stems.json. Validator. Provider interface. |
| **15 Sep** | Live novel-interest path (§9.1). Eval harness + charts. |
| **16 Sep** | Caregiver dashboard + narrative (§9.2). Sensory polish. Stubs. |
| **17 Sep** | **Freeze.** Record video. Write submission. |
| **18 Sep** | Buffer only. |

**Cut list:** word problems/MSBI, video modeling, self-graphing, multi-learner
profiles, auth, server, surfaces C and D if day 16 runs long.

---

## 14. The positioning line

> The diagnostic engine is deterministic by design — a child's next problem
> should not depend on a sampling temperature. The content engine is generative
> by necessity — no catalogue can cover every child's interests, which is
> exactly why every existing product is built for a median autistic child who
> does not exist.
