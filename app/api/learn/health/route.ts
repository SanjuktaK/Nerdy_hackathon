import { providerStatus } from "@/lib/ai/provider";
import { designCharacter, guessAnswer, planNext, reviewSession, sessionPremise } from "@/lib/learn/ai";
import { generateQuestion } from "@/lib/learn/generate";
import { initialModel } from "@/lib/learn/policy";
import type { Attempt, ChildProfile } from "@/lib/learn/types";
import { WORLDS } from "@/lib/learn/worlds";

export const dynamic = "force-dynamic";

/**
 * "Is the AI working?" — runs every job the on-device model does, once, on a
 * made-up child, and reports what came back, how long it took, and whether
 * the app accepted it or fell back to its rules and templates.
 */
export async function POST() {
  const status = await providerStatus();
  const p: ChildProfile = {
    name: "Alex", age: 6, grade: "G1", support: "some", communication: "sentences", colourSensitive: false, soundSensitive: false,
    likesStories: true, favouriteShow: "Doraemon", buddy: "robot", world: "custom", cheer: "smile", adaptConsent: true, createdAt: 0,
  };
  const a = (over: Partial<Attempt>): Attempt => ({ questionId: "q", skill: "add20", level: 2, correct: true, given: "", expected: "", mistake: "none", tries: 1, ms: 5000, at: 0, ...over });
  const history = [a({}), a({}), a({ level: 3, correct: false, mistake: "regrouping", tries: 2 })];

  const time = async <T,>(fn: () => Promise<T>) => {
    const t = Date.now();
    try {
      return { value: await fn(), ms: Date.now() - t };
    } catch {
      return { value: null as T | null, ms: Date.now() - t };
    }
  };

  const character = await time(() => designCharacter(p));
  const premise = await time(() => sessionPremise(p, WORLDS.honey, "Pooh"));
  const plan = await time(() => planNext(p, initialModel(p), history, "Pooh", "health", WORLDS.honey, premise.value ?? undefined));
  const review = await time(() => reviewSession(p, initialModel(p), history));
  const q = generateQuestion({ skill: "timeHour", level: 3, seed: "health", world: WORLDS.honey, hero: "Pooh" });
  const guess = await time(() => guessAnswer(q, "12"));

  const checks = [
    { job: "Design the friend", ok: character.value?.source === "model", ms: character.ms, sample: character.value ? `${character.value.name} — counts ${character.value.skin?.item.many}` : "" },
    { job: "Open the session's story", ok: !!premise.value, ms: premise.ms, sample: premise.value ?? "" },
    { job: "Choose the next puzzle", ok: plan.value?.plan.source === "model", ms: plan.ms, sample: plan.value ? `${plan.value.plan.skill} level ${plan.value.plan.level} — “${plan.value.plan.reason}”` : "" },
    { job: "Write the puzzle's story", ok: !!plan.value?.story, ms: plan.ms, sample: plan.value?.story ?? "" },
    { job: "Write the progress note", ok: review.value?.source === "model", ms: review.ms, sample: review.value?.note ?? "" },
    { job: "Guess at an unexplained answer", ok: !!guess.value, ms: guess.ms, sample: guess.value ?? "" },
  ];
  return Response.json({ provider: status, checks });
}
