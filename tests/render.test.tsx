import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// ============================================================
// Render every screen a child can reach, with real props from the real
// modules. This catches the class of failure the logic tests cannot:
// a component that throws the moment it is handed a live task.
// ============================================================

import {
  BreakCard,
  DoneCard,
  FeedbackCard,
  GuidedCard,
  IndependentCard,
  ModelCard,
  PreviewCard,
} from "../components/child/Phases";
import {
  BeadFrameAbstract,
  BeadFrameConcrete,
  BeadFrameRepresentational,
} from "../components/manipulatives/BeadFrame";
import {
  TenFrameAbstract,
  TenFrameConcrete,
  TenFrameRepresentational,
} from "../components/manipulatives/TenFrame";
import { CharacterMark, Sprite } from "../components/child/Sprite";
import { placeValue99 } from "../lib/skills/place-value";
import { composeTens } from "../lib/skills/compose-tens";
import { lookupOrNearest } from "../lib/content/cache";
import { selectSpec, startingCursor } from "../lib/policy/select";
import { DEFAULT_THEME } from "../lib/theme";
import { emptyBeadState, type BeadState } from "../lib/core/bead-frame";
import { emptyTenFrame } from "../lib/core/ten-frame";
import type { Task } from "../lib/core/types";
import type { RendererProps } from "../lib/skills/types";

const taskFor = (skillId: string, difficulty: 1 | 2 | 3 | 4 | 5): Task => {
  const cursor = { ...startingCursor(), skillId, difficulty };
  const spec = selectSpec(cursor, "same skill, new surface", 0);
  const hit = lookupOrNearest({
    skillId: spec.skillId,
    taskType: spec.type,
    difficulty: spec.difficulty,
    targetNumber: spec.targetNumber,
    interest: "trains",
  })!;
  return {
    ...spec,
    id: "render-test",
    interest: "trains",
    spriteKey: hit.entry.spriteKey,
    stem: hit.entry.stem,
    representation: "C",
    stemSource: "cache",
  };
};

const beadProps = (task: Task, state: BeadState): RendererProps<BeadState> => ({
  state,
  task,
  onChange: () => {},
  interactive: true,
  motionLevel: 1,
  hint: null,
});

test("all three bead-frame renderings draw the same state", () => {
  const task = taskFor(placeValue99.id, 3);
  const state = { tens: 3, ones: 4 };
  for (const R of [BeadFrameConcrete, BeadFrameRepresentational, BeadFrameAbstract]) {
    const html = renderToStaticMarkup(<R {...beadProps(task, state)} />);
    assert.ok(html.length > 100);
    assert.ok(html.includes("Tens") && html.includes("Ones"), "both rods are labelled");
  }
});

test("a non-interactive rendering disables every control", () => {
  const task = taskFor(placeValue99.id, 3);
  const html = renderToStaticMarkup(
    <BeadFrameConcrete {...beadProps(task, emptyBeadState())} interactive={false} />
  );
  assert.ok(html.includes("disabled"));
});

test("motion level 0 emits no transition at all", () => {
  const task = taskFor(placeValue99.id, 3);
  const still = renderToStaticMarkup(
    <BeadFrameConcrete {...beadProps(task, { tens: 2, ones: 3 })} motionLevel={0} />
  );
  assert.ok(!/\d+ms/.test(still), "level 0 must emit no duration at all");
  assert.ok(/transition:\s*none/.test(still), "level 0 must say none explicitly");

  const moving = renderToStaticMarkup(
    <BeadFrameConcrete {...beadProps(task, { tens: 2, ones: 3 })} motionLevel={2} />
  );
  assert.ok(/260ms/.test(moving), "level 2 must animate");
});

test("a hint marks the rod it points at without giving the answer away", async () => {
  const task = taskFor(placeValue99.id, 3);
  const html = renderToStaticMarkup(
    <BeadFrameConcrete
      {...beadProps(task, emptyBeadState())}
      hint={{ slot: "tens", value: 3, message: "The left rod holds 3 tens." }}
    />
  );
  // The rod the hint points at is picked out, and the beads it is pointing
  // to are outlined rather than filled — the child still has to place them.
  const { MATERIALS } = await import("../lib/theme/materials");
  assert.ok(html.includes(MATERIALS.tens.wash), "the hinted rod is not washed in its material colour");
  assert.ok(html.includes("stroke-dasharray"), "the target beads are outlined, not filled in");

  const unhinted = renderToStaticMarkup(
    <BeadFrameConcrete {...beadProps(task, emptyBeadState())} hint={null} />
  );
  assert.ok(
    html.split(MATERIALS.tens.fill).length > unhinted.split(MATERIALS.tens.fill).length,
    "a hint must change what is drawn"
  );
});

test("the ten-frame renderings draw too — the interface is not bead-shaped", () => {
  const task = taskFor(placeValue99.id, 1);
  const props = { ...beadProps(task, emptyBeadState()), state: emptyTenFrame() };
  for (const R of [TenFrameConcrete, TenFrameRepresentational, TenFrameAbstract]) {
    // @ts-expect-error deliberately crossing state types to prove the render
    // path is independent of the bead frame's shape.
    assert.ok(renderToStaticMarkup(<R {...props} />).length > 50);
  }
});

test("every phase screen renders with a live task", () => {
  const task = taskFor(placeValue99.id, 3);
  const theme = DEFAULT_THEME;
  const noop = () => {};

  const screens = [
    <PreviewCard key="p" text="Next: 3 number tasks. Then a break." theme={theme} loading={false} onStart={noop} />,
    <PreviewCard key="pl" text="Next: 3 number tasks. Then a break." theme={theme} loading onStart={noop} />,
    <ModelCard
      key="m"
      task={task}
      theme={theme}
      steps={placeValue99.modelSteps(task)}
      step={0}
      Renderer={BeadFrameConcrete}
      onNext={noop}
      onDone={noop}
    />,
    <GuidedCard
      key="g"
      task={task}
      theme={theme}
      work={emptyBeadState()}
      Renderer={BeadFrameConcrete}
      hint={null}
      cue="start on the left rod"
      answerable={false}
      onChange={noop}
      onPrompt={noop}
      onSubmit={noop}
      onShowModel={noop}
    />,
    <IndependentCard
      key="i"
      task={task}
      theme={theme}
      work={{ tens: 3, ones: 4 }}
      Renderer={BeadFrameAbstract}
      answerable
      onChange={noop}
      onSubmit={noop}
      onAbandon={noop}
    />,
    <FeedbackCard key="f" message="That matches the number." correct theme={theme} onNext={noop} nextLabel="Next task" />,
    <BreakCard key="b" theme={theme} onContinue={noop} />,
    <DoneCard key="d" theme={theme} tasks={6} />,
  ];

  for (const screen of screens) {
    const html = renderToStaticMarkup(screen);
    assert.ok(html.length > 80, "screen rendered empty");
    // No screen may leak a raw misconception code to a child.
    assert.ok(!/[A-Z]{4,}_[A-Z]/.test(html), `raw code leaked: ${html.slice(0, 200)}`);
  }
});

test("the final MODEL step renders the completed state", () => {
  const task = taskFor(composeTens.id, 3);
  const steps = composeTens.modelSteps(task);
  const html = renderToStaticMarkup(
    <ModelCard
      task={task}
      theme={DEFAULT_THEME}
      steps={steps}
      step={steps.length - 1}
      Renderer={BeadFrameConcrete}
      onNext={() => {}}
      onDone={() => {}}
    />
  );
  assert.ok(html.includes(String(task.targetNumber)));
  assert.ok(html.includes("Try it together"));
});

test("every sprite key in the skill's set has a drawing", () => {
  for (const key of placeValue99.spriteKeys) {
    assert.ok(renderToStaticMarkup(<Sprite spriteKey={key} />).includes("<svg"));
  }
  // An unknown key degrades to a shape rather than rendering nothing.
  assert.ok(renderToStaticMarkup(<Sprite spriteKey="nonsense" />).includes("<svg"));
});

test("every character draws", () => {
  for (const id of ["bo", "mira", "ade", "nell"] as const) {
    assert.ok(renderToStaticMarkup(<CharacterMark id={id} />).includes("<svg"));
  }
});

test("the server renders no speaker button, so hydration cannot mismatch", () => {
  // speechAvailable() is false on the server and true in most browsers.
  // Reading it during render put a button in one tree and not the other.
  const task = taskFor(placeValue99.id, 3);
  const html = renderToStaticMarkup(
    <GuidedCard
      task={task}
      theme={DEFAULT_THEME}
      work={emptyBeadState()}
      Renderer={BeadFrameConcrete}
      hint={null}
      cue="start on the left rod"
      answerable={false}
      onChange={() => {}}
      onPrompt={() => {}}
      onSubmit={() => {}}
      onShowModel={() => {}}
    />
  );
  assert.ok(!html.includes("Read the sentence again"), "server must not emit the speaker");
  assert.ok(html.includes(task.stem), "the sentence itself is always there");
});
