"use client";

// Dev-only gallery of every screen, with real tasks from the real modules.
// Not linked from the app. It exists so the phases can be looked at
// side by side without clicking through a session to reach each one.

import { useState } from "react";
import {
  BreakCard,
  DoneCard,
  FeedbackCard,
  GuidedCard,
  IndependentCard,
  ModelCard,
  PreviewCard,
} from "@/components/child/Phases";
import { BeadFrameConcrete, BeadFrameRepresentational, BeadFrameAbstract } from "@/components/manipulatives/BeadFrame";
import { placeValue99 } from "@/lib/skills/place-value";
import { composeTens } from "@/lib/skills/compose-tens";
import { lookupOrNearest } from "@/lib/content/cache";
import { ProgressPath } from "@/components/child/ProgressPath";
import { DEFAULT_THEME, PALETTES, paletteCssVars, type PaletteId } from "@/lib/theme";
import type { Task, Representation } from "@/lib/core/types";

function makeTask(skillId: string, difficulty: 1 | 2 | 3 | 4 | 5, rep: Representation): Task {
  const skill = skillId === "compose-tens" ? composeTens : placeValue99;
  const spec = skill.taskSpace(difficulty)[0];
  const hit = lookupOrNearest({
    skillId: spec.skillId,
    taskType: spec.type,
    difficulty: spec.difficulty,
    targetNumber: spec.targetNumber,
    interest: "trains",
  })!;
  return {
    ...spec,
    id: "preview",
    interest: "trains",
    spriteKey: hit.entry.spriteKey,
    stem: hit.entry.stem,
    representation: rep,
    stemSource: "cache",
  };
}

const noop = () => {};

export default function Preview() {
  const [palette, setPalette] = useState<PaletteId>("sage");
  const [rep, setRep] = useState<Representation>("C");
  const theme = { ...DEFAULT_THEME, palette };

  const task = makeTask("place-value-99", 3, rep);
  const exchange = makeTask("compose-tens", 3, rep);
  const R = rep === "C" ? BeadFrameConcrete : rep === "R" ? BeadFrameRepresentational : BeadFrameAbstract;

  const screens: [string, React.ReactNode][] = [
    ["GUIDED · ten ones waiting to be traded", <GuidedCard key="x" task={exchange} theme={theme} work={{ tens: 2, ones: 14 }} Renderer={R} hint={null} cue="the amount is right; show the exchange" answerable onChange={noop} onPrompt={noop} onSubmit={noop} onShowModel={noop} />],
    ["PATH · start", <ProgressPath key="i" character={theme.character} done={0} total={6} motionLevel={1} />],
    ["PATH · midway", <ProgressPath key="j" character={theme.character} done={3} total={6} motionLevel={1} />],
    ["PATH · finished", <ProgressPath key="k" character={theme.character} done={6} total={6} motionLevel={1} atRest />],
    ["PREVIEW", <PreviewCard key="a" text="Next: 3 number tasks. Then a break." theme={theme} loading={false} onStart={noop} />],
    ["MODEL", <ModelCard key="b" task={exchange} theme={theme} steps={composeTens.modelSteps(exchange)} step={1} Renderer={R} onNext={noop} onDone={noop} />],
    ["GUIDED", <GuidedCard key="c" task={task} theme={theme} work={{ tens: 3, ones: 4 }} Renderer={R} hint={null} cue="start on the left rod" answerable onChange={noop} onPrompt={noop} onSubmit={noop} onShowModel={noop} />],
    ["GUIDED + hint", <GuidedCard key="d" task={task} theme={theme} work={{ tens: 4, ones: 3 }} Renderer={R} hint={{ slot: "tens", value: 3, message: "The left rod holds 3 tens." }} cue="name each rod, then place" answerable onChange={noop} onPrompt={noop} onSubmit={noop} onShowModel={noop} />],
    ["INDEPENDENT", <IndependentCard key="e" task={task} theme={theme} work={{ tens: 2, ones: 14 }} Renderer={R} answerable onChange={noop} onSubmit={noop} onAbandon={noop} />],
    ["FEEDBACK", <FeedbackCard key="f" message="The amount is right. Ten ones can become one ten." correct={false} theme={theme} onNext={noop} nextLabel="Next task" />],
    ["BREAK", <BreakCard key="g" theme={theme} onContinue={noop} />],
    ["DONE", <DoneCard key="h" theme={theme} tasks={6} />],
  ];

  return (
    <div className="min-h-dvh bg-[#1c1f1d] p-6 text-white">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-lg font-semibold">Screen gallery</h1>
          <div className="flex gap-2">
            {(Object.keys(PALETTES) as PaletteId[]).map((p) => (
              <button key={p} onClick={() => setPalette(p)} className={`rounded-lg px-3 py-1 text-sm ${palette === p ? "bg-white text-black" : "bg-white/15"}`}>
                {PALETTES[p].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["C", "R", "A"] as Representation[]).map((r) => (
              <button key={r} onClick={() => setRep(r)} className={`rounded-lg px-3 py-1 text-sm ${rep === r ? "bg-white text-black" : "bg-white/15"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {screens.map(([label, node]) => (
          <section key={label}>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-white/50">{label}</p>
            <div
              style={paletteCssVars(palette)}
              className="overflow-hidden rounded-2xl bg-[var(--bg)] p-6 text-[var(--ink)]"
            >
              <div className="mx-auto flex max-w-4xl flex-col gap-5">{node}</div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
