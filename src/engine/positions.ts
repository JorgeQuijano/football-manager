import type { MatchSideState, Player, Position } from "./types";
import { styleOf } from "./tuning";

/**
 * Where the twenty-two are (v0.46).
 *
 * The old chains walked a static formation template, so nobody ever moved and
 * pressure was imaginary. This module is the engine's first real geometry: given
 * the ball and the phase, it places a side's eleven — and it is pure, so the
 * possession model can call it per pass and the view (Stage 3) can call it per
 * frame with the same answer.
 *
 * Frame: everything is in a side's OWN attacking frame — (0,0) is the opponent's
 * goal, (100,100) is your own. `shapeFor` takes the ball already converted into
 * the side's frame; `toFrame` flips a point between the two.
 */

export type Pt = [number, number];

const clampP = (v: number) => Math.max(3, Math.min(97, v));

/** A point in the opponent's attacking frame, seen from ours. */
export const toFrame = (p: Pt): Pt => [100 - p[0], 100 - p[1]];

/**
 * The depths (y) of a shape converted into the opponent's frame — the offside
 * line's input. A loop, not `.map(toFrame)`: this runs per pass and the
 * two-element allocations showed up in the profile (v0.46 perf pass).
 */
export function ysInOtherFrame(shape: Pt[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < shape.length; i++) out.push(100 - shape[i][1]);
  return out;
}

export interface ShapeOpts {
  /** ball position in this side's own attacking frame */
  ball: Pt;
  phase: "attack" | "defend";
  /** the carrier's slot (attack) — he stands on the ball */
  carrier?: number;
  /** per-slot designed positions (defaults to the side's coords) */
  roles?: (Position | undefined)[];
  /** the opponents' live offside line (own frame) — attackers hold it (v0.46) */
  offsideLine?: number;
}

const dist = (a: Pt, b: Pt) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  // Math.hypot is overflow-safe and slow; this is the engine's hottest line
  return Math.sqrt(dx * dx + dy * dy);
};

/** Place the side for the phase. Returns one point per slot, own attacking frame. */
export function shapeFor(side: MatchSideState, opts: ShapeOpts): Pt[] {
  const st = styleOf(side.style);
  const [bx, by] = opts.ball;
  const out: Pt[] = [];
  if (opts.phase === "attack") {
    // how much each line follows the ball up and down the pitch; a deep block
    // (high lineHeight) keeps its shape and lets the ball come to it
    const drag = 0.75 + 0.5 * (1 - st.lineHeight);
    const spread = 1 + 0.45 * (st.width - 1);
    for (let i = 0; i < 11; i++) {
      const base = side.coords[i] ?? [50, 50];
      const pos = opts.roles?.[i] ?? side.poss[i] ?? "MF";
      if (pos === "GK") {
        out.push([clampP(50 + (base[0] - 50) * 0.3), clampP(90 + (by - 50) * 0.06)]);
        continue;
      }
      // forwards stay high to stretch the play; midfielders drop toward the ball
      // to offer the short option, defenders push up with it
      const follow = pos === "DF" ? 0.35 : pos === "MF" ? 0.55 : 0.3;
      let y = base[1] + (by - base[1]) * follow * drag;
      // in the final third the attacking midfielders push *ahead* of the ball
      // (v0.47): the short game needs a man between the ball and the strikers'
      // line, or the ball can never get close enough to find them. Deep-lying
      // midfielders stay behind it — the pivot is still the pivot
      if (pos === "MF" && base[1] <= 50 && by < 55) y = Math.min(y, by - 6);
      // defenders stay goal-side of the ball; forwards stretch when it is deep
      if (pos === "DF") y = Math.max(y, by + 5);
      if (pos === "FW") y = Math.min(y, base[1] + 2);
      // nobody stands beyond the offside line: attackers hold it, onside by a
      // hair (v0.46 — the line is the opponents' live block, so a high press
      // squeezes the strikers up the pitch and a deep block lets them drop in)
      if (opts.offsideLine !== undefined) y = Math.max(y, opts.offsideLine + 0.5);
      const x = 50 + (base[0] - 50) * spread;
      out.push([clampP(x), clampP(y)]);
    }
    if (opts.carrier !== undefined) out[opts.carrier] = [clampP(bx), clampP(by)];
    return out;
  }
  // --- defending: press the ball if it is in the zone, else hold a line ---
  // pressHeight 1 = engage anywhere (even in their half); 0 = only near our own goal.
  // `by` is the ball in OUR frame: small = deep in their half (a high press), large = our box.
  const engage = by > 60 - 50 * st.pressHeight;
  const lineGap = 6 + 24 * st.lineHeight;
  const pressers = new Map<number, [number, number]>();
  if (engage) {
    const ranked = side.slots
      .map((_, i) => i)
      .filter((i) => (side.poss[i] ?? "MF") !== "GK")
      .sort((a, b) => {
        const da = dist(side.coords[a] ?? [50, 50], [bx, by]);
        const db = dist(side.coords[b] ?? [50, 50], [bx, by]);
        return da - db;
      });
    const n = Math.min(3, 1 + Math.round(2 * st.pressIntensity));
    // the first man takes the ball; the others cover goal-side, spread laterally
    const spots: [number, number][] = [
      [0, 2.2],
      [3.5, 3.5],
      [-6.5, 4.5]
    ];
    ranked.slice(0, n).forEach((slot, k) => {
      const [ox, oy] = spots[Math.min(k, spots.length - 1)];
      pressers.set(slot, [clampP(bx + ox), clampP(by + oy)]);
    });
  }
  // the block holds between the ball and the goal — the gap shrinks near our box
  const gap = Math.min(lineGap, (100 - by) * 0.6);
  const lineY = clampP(Math.min(94, by + gap));
  for (let i = 0; i < 11; i++) {
    const base = side.coords[i] ?? [50, 50];
    const pos = opts.roles?.[i] ?? side.poss[i] ?? "MF";
    if (pos === "GK") {
      out.push([clampP(50 + (base[0] - 50) * 0.3), 94]);
      continue;
    }
    if (pressers.has(i)) {
      const spot = pressers.get(i)!;
      out.push([spot[0], spot[1]]);
      continue;
    }
    // the block: formation shape blended toward a line just goal-side of the ball
    const y = base[1] * 0.35 + lineY * 0.65;
    out.push([clampP(base[0]), clampP(y)]);
  }
  return out;
}

export interface Defender {
  slot: number;
  pt: Pt;
  defending: number;
}

/** Defenders' points converted into the attacker's frame, with their tackle stat. */
export function defendersOf(
  def: MatchSideState,
  defShape: Pt[],
  players: Map<string, Player>
): Defender[] {
  const out: Defender[] = [];
  for (let i = 0; i < 11; i++) {
    const id = def.slots[i];
    if (!id) continue;
    const p = players.get(id);
    if (!p || p.pos === "GK") continue;
    const q = defShape[i];
    // the flip is inlined: this runs for every defender on every pass
    out.push({
      slot: i,
      pt: q ? [100 - q[0], 100 - q[1]] : [50, 50],
      defending: p.attrs.defending
    });
  }
  return out;
}

/** How much a defender crowds a point: 0 = free, 1 = smothered. */
export function pressureAt(pt: Pt, defs: Defender[], radius = 14): number {
  let sum = 0;
  for (const d of defs) {
    const r = dist(pt, d.pt);
    if (r < radius) sum += (1 - r / radius) * (0.6 + d.defending / 200);
  }
  return Math.min(1, sum);
}

/** Distance from a point to the segment from→to. */
export function segDist(pt: Pt, from: Pt, to: Pt): number {
  const len = Math.max(1, dist(from, to));
  const t = Math.max(
    0,
    Math.min(1, ((pt[0] - from[0]) * (to[0] - from[0]) + (pt[1] - from[1]) * (to[1] - from[1])) / (len * len))
  );
  return dist(pt, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
}

/** How risky a passing lane is: defenders sitting on or near the segment. */
export function laneRisk(from: Pt, to: Pt, defs: Defender[], radius = 10): number {
  const len = Math.max(1, dist(from, to));
  let sum = 0;
  for (const d of defs) {
    const t = Math.max(
      0,
      Math.min(1, ((d.pt[0] - from[0]) * (to[0] - from[0]) + (d.pt[1] - from[1]) * (to[1] - from[1])) / (len * len))
    );
    // a man pressing the passer is not in the lane — only bodies ahead of the ball count
    if (t < 0.25) continue;
    const r = segDist(d.pt, from, to);
    if (r < radius) sum += (1 - r / radius) * (0.5 + d.defending / 200);
  }
  return Math.min(1, sum);
}
