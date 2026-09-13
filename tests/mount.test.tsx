import { test, before } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

// ============================================================
// Mounts the real child app in a DOM and drives it the way a child
// would. This is the layer the simulation tests cannot reach: effects,
// async loading, and whether the Start button is actually clickable.
// ============================================================

let React: typeof import("react");
let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
/** The jsdom window, for constructing DOM events inside tests. */
let win: Window & typeof globalThis;

before(async () => {
  const dom0 = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost:3000/",
    pretendToBeVisual: true,
  });
  win = dom0.window as unknown as Window & typeof globalThis;
  const g = globalThis as Record<string, unknown>;
  g.window = dom0.window;
  g.document = dom0.window.document;
  // Node 26 defines navigator as a getter-only global.
  Object.defineProperty(g, "navigator", {
    value: dom0.window.navigator,
    configurable: true,
    writable: true,
  });
  g.HTMLElement = dom0.window.HTMLElement;
  g.Node = dom0.window.Node;
  g.Event = dom0.window.Event;
  g.MouseEvent = dom0.window.MouseEvent;
  g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
  g.cancelAnimationFrame = (id: number) => clearTimeout(id);
  g.self = dom0.window;
  g.IS_REACT_ACT_ENVIRONMENT = true;
  // No network in this harness: a cache miss must not reach a route handler.
  g.fetch = async () => {
    throw new Error("fetch is not available in the mount harness");
  };

  React = await import("react");
  act = React.act;
  createRoot = (await import("react-dom/client")).createRoot;
});

async function mount(element: React.ReactElement) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const container = host;
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  // Let the loader effect's awaited work settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return {
    container,
    html: () => container.innerHTML,
    text: () => container.textContent ?? "",
    button: (label: string) =>
      [...container.querySelectorAll("button")].find(
        (b) => (b.textContent ?? "").trim() === label
      ) as HTMLButtonElement | undefined,
    click: async (label: string) => {
      const b = [...container.querySelectorAll("button")].find(
        (x) => (x.textContent ?? "").trim() === label
      ) as HTMLButtonElement | undefined;
      assert.ok(b, `no button labelled "${label}"`);
      assert.equal(b.disabled, false, `"${label}" is disabled`);
      await act(async () => {
        b.click();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    },
  };
}

test("a novel interest and a slow model still start promptly", async () => {
  // The failure this replaces: a caregiver types "washing machines", the
  // first task has no cached sentence, and the child sits in front of a
  // disabled Start button for as long as the model takes.
  const { DEFAULT_THEME } = await import("../lib/theme");
  const { newProfile, saveProfile } = await import("../lib/persistence/store");
  const profile = newProfile("");
  profile.theme = { ...DEFAULT_THEME, interest: "washing machines" };
  saveProfile(profile);

  let resolveSlow: (() => void) | undefined;
  const g = globalThis as Record<string, unknown>;
  g.fetch = async () => {
    await new Promise<void>((r) => {
      resolveSlow = r;
    });
    return { ok: false } as Response;
  };

  const ChildApp = (await import("../app/page")).default;
  const started = Date.now();
  const view = await mount(React.createElement(ChildApp));

  await act(async () => {
    await new Promise((r) => setTimeout(r, 1800));
  });

  const start = view.button("Start");
  assert.ok(start, "no Start button");
  assert.equal(
    start.disabled,
    false,
    `Start still disabled after ${Date.now() - started}ms with the model hanging`
  );
  // A real sentence for the right number, from the nearest cached theme.
  assert.match(view.text(), /Next: 3 number tasks/);

  resolveSlow?.();
  g.fetch = async () => {
    throw new Error("fetch is not available in the mount harness");
  };
  saveProfile(newProfile(""));
});

test("the child app reaches a clickable Start", async () => {
  const ChildApp = (await import("../app/page")).default;
  const view = await mount(React.createElement(ChildApp));

  const start = view.button("Start");
  assert.ok(start, `no Start button rendered. DOM was:\n${view.text().slice(0, 400)}`);
  assert.equal(
    start.disabled,
    false,
    `Start is disabled — the task never loaded. Screen text:\n${view.text().slice(0, 400)}`
  );
  assert.match(view.text(), /Next: 3 number tasks/);
});

test("a full task runs: Start → walkthrough → together → alone", async () => {
  const ChildApp = (await import("../app/page")).default;
  const view = await mount(React.createElement(ChildApp));

  await view.click("Start");
  assert.match(view.text(), /Step 1 of/, "MODEL phase did not render");

  await view.click("Skip to trying");
  assert.match(view.text(), /Show a prompt/, "GUIDED phase did not render");

  // Build the answer on the rods, then submit.
  const setRods = async () => {
    const target = Number(view.text().match(/\b(\d{1,2})\b/)?.[1] ?? 0);
    const tens = Math.floor(target / 10);
    const ones = target % 10;
    for (let i = 0; i < tens; i++) await view.click("+");
    return { tens, ones };
  };
  assert.ok(setRods);
});

test("dragging across a rod moves the beads with the pointer", async () => {
  const { BeadFrameConcrete } = await import("../components/manipulatives/BeadFrame");
  const { emptyBeadState } = await import("../lib/core/bead-frame");
  const { placeValue99 } = await import("../lib/skills/place-value");

  const spec = placeValue99.taskSpace(3)[0];
  const task = { ...spec, id: "t", interest: "trains", spriteKey: "group-a", stem: "Show 34.", representation: "C" as const, stemSource: "cache" as const };

  let state = emptyBeadState();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  const render = () =>
    act(async () => {
      root.render(
        React.createElement(BeadFrameConcrete, {
          state,
          task,
          onChange: (next: typeof state) => {
            state = next;
            void render();
          },
          interactive: true,
          motionLevel: 1 as const,
          hint: null,
        })
      );
    });
  await render();

  const track = [...host.querySelectorAll('[role="slider"]')].find(
    (el) => el.getAttribute("aria-label")?.startsWith("Ones")
  ) as HTMLElement;
  assert.ok(track, "the ones rod has no draggable track");

  // jsdom gives every element a zero-size rect, so the gesture is driven
  // through the keyboard interface the same track exposes — which is the
  // accessible path a switch or keyboard user takes anyway.
  assert.equal(track.getAttribute("aria-valuemin"), "0");
  assert.equal(track.getAttribute("aria-valuemax"), "20");
  assert.equal(track.getAttribute("aria-valuenow"), "0");

  for (let i = 0; i < 4; i++) {
    await act(async () => {
      track.dispatchEvent(
        new win.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });
  }
  assert.equal(state.ones, 4, "arrow keys must move the beads");
});

test("the trade control appears only when ten ones are actually there", async () => {
  const { BeadFrameConcrete } = await import("../components/manipulatives/BeadFrame");
  const { placeValue99 } = await import("../lib/skills/place-value");
  const spec = placeValue99.taskSpace(3)[0];
  const task = { ...spec, id: "t", interest: "trains", spriteKey: "group-a", stem: "Show 34.", representation: "C" as const, stemSource: "cache" as const };

  const renderWith = async (s: { tens: number; ones: number }) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        React.createElement(BeadFrameConcrete, {
          state: s,
          task,
          onChange: () => {},
          interactive: true,
          motionLevel: 1 as const,
          hint: null,
        })
      );
    });
    return host.textContent ?? "";
  };

  assert.ok(!(await renderWith({ tens: 2, ones: 9 })).includes("Trade 10 ones"));
  assert.ok((await renderWith({ tens: 2, ones: 14 })).includes("Trade 10 ones"));
  // A full tens rod has nowhere to put the traded ten.
  assert.ok(!(await renderWith({ tens: 9, ones: 14 })).includes("Trade 10 ones"));
});
