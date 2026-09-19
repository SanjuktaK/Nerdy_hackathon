// ============================================================
// Try it at home. A skill that works on a screen and nowhere else is a
// known gap for autistic learners, so every skill has two everyday ways to
// use it with real things. Short, concrete, and written for the grown-up.
// ============================================================

import type { SkillId } from "./types";

export const AT_HOME: Record<SkillId, string[]> = {
  count: [
    "Count the spoons as you lay the table, touching each one.",
    "Count stairs out loud on the way up, one step, one number.",
  ],
  recognise: [
    "Spot numbers on a walk: house doors, buses, shop signs. Say each one.",
    "Find the number on the lift or the microwave together.",
  ],
  compare: [
    "Make two piles of grapes. Which pile has more? Count to check.",
    "Pour two cups of water. Which has more? Which has fewer?",
  ],
  add10: [
    "Put 3 toys in a box, then 2 more. How many now? Count them out.",
    "At snack time: 4 crackers, then 3 more. How many crackers?",
  ],
  sub10: [
    "Put 7 blocks on the table. Take 2 away. How many are left?",
    "Eat 2 of 6 grapes. How many grapes are left on the plate?",
  ],
  shapes: [
    "Shape hunt: find a circle (a plate), a square (a tile), a rectangle (a door).",
    "Sort crackers or blocks by shape.",
  ],
  add20: [
    "Use egg cartons: fill one (10), then add more. How many eggs altogether?",
    "Count coins or buttons past ten: make a ten first, then add the rest.",
  ],
  sub20: [
    "Line up 15 pegs. Take some off. How many are left?",
    "Start with 12 raisins, eat 5. Count what is left, making a ten first.",
  ],
  placeValue100: [
    "Bundle straws or pencils into tens with a rubber band. Show 34 as 3 bundles and 4 loose.",
    "Read house numbers: in 47, which digit is the tens?",
  ],
  timeHour: [
    "Look at a real clock at each o'clock: lunch at 12, bath at 6.",
    "Set the oven or toy clock to an hour and read it together.",
  ],
  add1000: [
    "Add prices on a shopping list, carrying the tens on paper.",
    "Count steps on two walks and add them together.",
  ],
  sub1000: [
    "Page counting: a book has 120 pages, you have read 45. How many are left?",
    "Subtract ages or dates together, borrowing a ten on paper.",
  ],
  placeValue1000: [
    "Read big numbers on car plates or receipts: say the hundreds, tens and ones.",
    "Use 100s, 10s and 1s play money to build a number.",
  ],
  money: [
    "Pay for something small with coins and count the change together.",
    "Sort a coin jar by coin, then count each pile.",
  ],
  measure: [
    "Measure toys, spoons and shoes with a ruler. Which is longest?",
    "Start at 0 on the ruler, every time. Measure a pencil together.",
  ],
};
