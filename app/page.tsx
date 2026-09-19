"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Buddy } from "@/components/learn/Character";
import { GrownUpsLink } from "@/components/learn/GrownUpsLink";
import { Jar } from "@/components/learn/Items";
import { computeNotes } from "@/lib/learn/notes";
import { Scene } from "@/components/learn/Scene";
import { Onboarding } from "@/components/learn/Onboarding";
import { Session } from "@/components/learn/Session";
import { initialModel, ruleReview } from "@/lib/learn/policy";
import { TEXT_SCALE, backgroundOf, readAloudOf, readingClasses, sensoryFilter, sessionLengthOf, soundSettings, voiceStyleOf } from "@/lib/learn/sensory";
import { setEffects, setVoiceStyle, setVolume, speak } from "@/lib/learn/sound";
import { getLearn, getLearnServer, subscribeLearn, updateLearn } from "@/lib/learn/store";
import { worldOf, type World } from "@/lib/learn/worlds";

export default function Home() {
  const state = useSyncExternalStore(subscribeLearn, getLearn, getLearnServer);
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState<string | null>(null);

  // Volume and effects follow the profile everywhere in the child app.
  const prof = state?.profile;
  useEffect(() => {
    if (!prof) return;
    const s = soundSettings(prof);
    setVolume(s.volume);
    setEffects(s.effects);
    // Text size scales everything, so the whole page grows together.
    document.documentElement.style.fontSize = TEXT_SCALE[prof.textSize ?? "normal"];
    setVoiceStyle(voiceStyleOf());
  }, [prof]);

  if (!state) return <main className="min-h-screen" aria-busy="true" />;

  const { profile, character, sessions } = state;
  if (!profile || !character) {
    return (
      <Onboarding
        onDone={(p, c) => updateLearn({ profile: p, character: c, model: initialModel(p), sessions: [] })}
      />
    );
  }

  const model = state.model ?? initialModel(profile);
  const saved = sessions.reduce((n, s) => n + s.attempts.filter((a) => a.correct).length, 0);
  const world = worldOf(character);

  return (
    <div
      className={`app-root ${profile.reduceMotion ? "reduce-motion" : ""} ${readingClasses(profile)}`}
      style={{ ...skyVars(world), filter: sensoryFilter(profile) }}
    >
      <Scene world={world} mode={backgroundOf(profile)} />
      {playing ? (
        <Session
          profile={profile}
          character={character}
          model={model}
          previous={sessions.flatMap((s) => s.attempts)}
          totalSaved={saved}
          onHome={() => setPlaying(false)}
          notes={computeNotes(profile, sessions, sessionLengthOf(profile))}
          seenNotes={state.seenNotes ?? []}
          onHypothesis={(qid, text) =>
            updateLearn({
              sessions: getLearn().sessions.map((s) => ({
                ...s,
                attempts: s.attempts.map((a) => (a.questionId === qid ? { ...a, hypothesis: text } : a)),
              })),
            })
          }
          onFinish={(rec, reviewed) => {
            const all = [...getLearn().sessions, rec];
            updateLearn({ sessions: all });
            reviewed
              .then((m) => updateLearn({ model: m }))
              .catch(() => updateLearn({ model: profile.adaptConsent ? ruleReview(model, rec.attempts) : { ...model, sessions: model.sessions + 1 } }));
          }}
        />
      ) : (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-5 sm:px-6">
          <header className="flex items-center justify-between">
            <span className="font-display text-xl font-bold">Tally Tales</span>
            <GrownUpsLink align="right" notes={computeNotes(profile, sessions, sessionLengthOf(profile))} seen={state.seenNotes ?? []} />
          </header>
          <section className="flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center">
            <p className="bubble min-h-[3.5rem]" aria-live="polite">{line ?? character.catchphrase}</p>
            <div className="flex items-end gap-6 sm:gap-10">
              <Buddy
                character={character}
                mood="happy"
                size={230}
                onSay={(l) => {
                  setLine(l);
                  if (readAloudOf(profile) === "auto") speak(l, { quiet: profile.soundSensitive, interrupt: true });
                }}
              />
              <Jar world={world} filled={saved % 5} of={5} total={saved} label={world.jar} size={120} />
            </div>
            <h1 className="font-display text-4xl font-bold sm:text-5xl">
              Hello{profile.name ? `, ${profile.name}` : ""}.
            </h1>
            <p className="text-xl text-[var(--ink-soft)]">
              {character.name} has {sessionLengthOf(profile)} puzzles today. Tap {character.name} to say hello.
            </p>
            <button type="button" className="btn-primary btn-xl" onClick={() => setPlaying(true)} autoFocus>
              Start
            </button>
          </section>
        </main>
      )}
    </div>
  );
}

function skyVars(world: World): React.CSSProperties {
  const c = world.colours;
  return { ["--sky" as string]: c.sky, ["--ground" as string]: c.ground };
}
