// ============================================================
// Material colours for the manipulatives.
//
// These are deliberately NOT the palette. §8 says muted palettes only, and
// that rule is about the room: the chrome, the cards, the background, the
// things a child is not looking at. Read as "make everything beige" it
// produces a screen with no focal point, where the maths is the quietest
// thing present.
//
// Physical Montessori materials are the opposite — calm wooden trays
// holding vividly coloured beads, because the material is the thing the
// child is supposed to attend to. Colour here is doing a job: green is a
// unit, blue is a ten, and a child learns to read the value off the colour
// before they can read it off the column.
//
// Saturated is not the same as overstimulating. What the literature warns
// about is flashing, churn, high-contrast animation and unpredictable
// change — none of which these are. They sit still.
// ============================================================

export interface Material {
  /** Bead face. */
  fill: string;
  /** Rim, one step darker, so a bead reads as an object with an edge. */
  edge: string;
  /** Specular highlight. */
  shine: string;
  /** Empty slot on the rod. */
  slot: string;
  /** Backing wash for the rod when it is being pointed at. */
  wash: string;
  label: string;
}

/** Montessori convention: units green, tens blue. */
export const MATERIALS: { tens: Material; ones: Material } = {
  tens: {
    fill: "#2f6fb0",
    edge: "#1e4d7d",
    shine: "#9cc4e8",
    slot: "#c8d9ea",
    wash: "#e4eef8",
    label: "blue",
  },
  ones: {
    fill: "#3f9455",
    edge: "#2a6c3b",
    shine: "#a5d9b2",
    slot: "#cbe3d2",
    wash: "#e6f3ea",
    label: "green",
  },
};

/**
 * Sensory level 0 means "as little stimulation as possible". At that level
 * the materials desaturate toward the calm end rather than disappearing —
 * a child who cannot tolerate the vivid set still needs to tell a ten from
 * a one.
 */
export const QUIET_MATERIALS: { tens: Material; ones: Material } = {
  tens: {
    fill: "#6c88a6",
    edge: "#4e6b80",
    shine: "#b9cbdd",
    slot: "#d6dfe8",
    wash: "#eef2f6",
    label: "blue",
  },
  ones: {
    fill: "#6f9a78",
    edge: "#4f7358",
    shine: "#bcd8c3",
    slot: "#d8e4db",
    wash: "#eff5f1",
    label: "green",
  },
};

export const materialsFor = (level: 0 | 1 | 2) =>
  level === 0 ? QUIET_MATERIALS : MATERIALS;
