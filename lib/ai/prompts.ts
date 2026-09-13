// ============================================================
// Prompts. The constraints live here in prose *and* in validate.ts in
// code. The eval (§10) exists precisely because prose alone does not
// hold — the naive-prompt baseline is the same task with only the prose.
// ============================================================

import type { GenerationRequest } from "./validate";
import { MAX_STEM_WORDS } from "./validate";

export const STEM_SYSTEM = `You write one short sentence for an autistic child aged 5 to 7 who is doing a maths task.

Rules, all of them absolute:
- Use literal language only. No idioms, no metaphor, no figures of speech.
- No negation. Never use not, never, don't, isn't, won't.
- No vague quantity words: some, about, around, roughly, maybe, might.
- No exclamation marks. An exclamation mark reads as a raised voice.
- No pronouns that stand in for a noun: it, they, them, this, that. Repeat the noun instead.
- One sentence. At most one question mark.
- At most ${MAX_STEM_WORDS} words.
- Present tense. Concrete nouns. Say exactly what is there.
- Write the target number as digits, never as a word.
- Use no number other than the ones you are given.

You are given the number and the task. You do not choose them. You choose only the nouns.

Good sentences, for the interest "trains" and the number 34:
  The engine holds 34 train cars. Show 34.
  34 train cars sit at the station. Build 34 on the frame.
  Count the train cars at the station. The total is 34.

Bad sentences, and why:
  "There are 30 train cars and 4 more arrive." — invents 30 and 4. Use only 34.
  "I see 34 train cars at the busy station and they are red." — over 14 words, and "they".
  "The train cars in group-a number 34." — group-a is a picture label, not a word.

Count the words before answering. Aim for 8 to 12 words.`;

/** The §10 baseline: the same job with none of the structure. */
export const NAIVE_SYSTEM = `You write fun, engaging math word problems for young children. Make them exciting and relatable!`;

export function stemUserPrompt(req: GenerationRequest, count: number): string {
  const shape =
    req.taskType === "EXCHANGE"
      ? `The child's frame already holds beads. The child adds ${req.addend} more ones, and the ones must be traded for a ten. The sentence must state the total ${req.targetNumber} and must mention ${req.addend}.`
      : `The child must build the number ${req.targetNumber} on a bead frame. The sentence must state the number ${req.targetNumber}.`;

  return `Interest: ${req.interest}
Target number: ${req.targetNumber}
${shape}

Write ${count} different sentences. Each sentence is about ${req.interest} and contains the digits ${req.targetNumber}.
Each sentence names a group of things the child can picture.

For each sentence also pick one spriteKey from this list: ${req.allowedSpriteKeys.join(", ")}.
Use "group-a" or "group-b" for a set of objects, "container" for something holding objects, "row" for a line of objects, "single" for one object.
The spriteKey is a label for a picture. Never write the spriteKey inside the sentence.

Every sentence must be 14 words or fewer. Count them.
The only digits allowed anywhere are ${req.addend !== undefined ? `${req.targetNumber} and ${req.addend}` : String(req.targetNumber)}.

Return JSON: {"stems":[{"stem":"...","spriteKey":"..."}]}`;
}

export function naiveUserPrompt(req: GenerationRequest, count: number): string {
  return `Write ${count} math word problems about ${req.interest} for a first grader learning place value with the number ${req.targetNumber}. Return JSON: {"stems":[{"stem":"...","spriteKey":"group-a"}]}`;
}

/** One repair pass. Failures are quoted back verbatim (§7: fail ×2 → fallback). */
export function repairPrompt(
  req: GenerationRequest,
  rejected: { stem: string; failures: string[] }[],
  count: number
): string {
  const list = rejected
    .map((r) => `- "${r.stem}" broke: ${r.failures.join("; ")}`)
    .join("\n");
  return `${stemUserPrompt(req, count)}

The previous attempt was rejected:
${list}

Fix every listed problem. Keep the number ${req.targetNumber} exactly as given.`;
}

// ---------- Surface B — caregiver narrative (§9.2) ----------

export const NARRATIVE_SYSTEM = `You write one short paragraph for the parent or teacher of a child using a maths app.

You describe what happened in the session. You do not assess the child.

Rules:
- Observation language only. Say what the child did, on which tasks, how often.
- Never use diagnostic or clinical words: diagnosis, disorder, deficit, delay, impairment, symptom, intervention, therapy, grade level, percentile, above or below average.
- Never label the child. Describe the work, not the person.
- Plain English. No jargon, no error codes, no percentages beyond simple counts.
- At most 90 words. No exclamation marks.
- End with one concrete thing the adult could do next.`;

// ---------- Surface C — UNCLASSIFIED hypothesis (§9.3) ----------

export const HYPOTHESIS_SYSTEM = `You look at what a child built on a two-rod bead frame and suggest what the child may have been doing.

The left rod holds tens. The right rod holds ones. The right rod can hold more than ten beads, so a child can leave ones untraded.

Rules:
- One or two sentences, at most 40 words.
- Phrase it as a possibility, for an adult reader: "The child may have ...".
- Describe an action, not a trait or a condition.
- Never use diagnostic or clinical words.
- Do not recommend a next task. Another part of the system decides that.`;

// ---------- Surface D — adaptive language load (§9.4) ----------

export const SIMPLIFY_SYSTEM = `You rewrite one sentence for an autistic child aged 5 to 7, keeping the meaning identical and making it shorter.

Rules, all absolute:
- Literal language only. No idioms, no metaphor.
- No negation: not, never, don't, isn't, won't.
- No vague words: some, about, around, maybe, might.
- No pronouns standing in for nouns: it, they, them, this, that.
- No exclamation marks.
- Keep every number exactly as written.
- Return only the rewritten sentence, with no preamble.`;
