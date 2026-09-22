import type { Mentality } from "./types";
import { pickWeighted, type Rng } from "./rng";
import type { MotionProfile } from "./motion";

/**
 * Player decision layer (2D match view). Every few seconds each player *chooses*
 * what to do — hold shape, offer a pass, make a run, press, cover, drop, break —
 * instead of following one scripted formula. The choice is weighted by:
 *
 *   - the role's motion profile (a BWM wants to press, a Poacher wants runs),
 *   - the player's attributes (as folded into the profile: pace → runs/break,
 *     physical → stamina/push),
 *   - the team's mentality (attacking → more runs and pressing, defensive →
 *     more cover and dropping),
 *   - the game phase (in possession / out of possession / the 2.5 s transitions)
 *     and the situation (ball position, distance to the ball, lane width),
 *   - and a seeded RNG per player so squads never move in lockstep: each player
 *     re-decides on their own clock, giving the side an organic, uneven shape.
 *
 * `decideIntent` is pure (Rng in, pick out) so the whole selection is testable
 * and deterministic. Geometry is in the side's own attacking frame: (0,0) is the
 * opponent goal, (100,100) own goal; the view converts to screen coordinates.
 */

export type GamePhase = "in" | "out" | "break" | "recover";

export type IntentId =
  // in possession
  | "hold"
  | "support"
  | "come_short"
  | "drift_wide"
  | "run_behind"
  | "overlap"
  // out of possession
  | "hold_line"
  | "press_ball"
  | "cover"
  | "drop_deep"
  // transition — break
  | "counter"
  | "spread"
  // transition — recover
  | "sprint_back"
  | "delay";

export const INTENT_IDS: IntentId[] = [
  "hold",
  "support",
  "come_short",
  "drift_wide",
  "run_behind",
  "overlap",
  "hold_line",
  "press_ball",
  "cover",
  "drop_deep",
  "counter",
  "spread",
  "sprint_back",
  "delay"
];

export const INTENT_LABELS: Record<IntentId, string> = {
  hold: "Hold shape",
  support: "Offer for the pass",
  come_short: "Come short",
  drift_wide: "Stay wide",
  run_behind: "Run in behind",
  overlap: "Overlap",
  hold_line: "Hold the line",
  press_ball: "Press the ball",
  cover: "Cover",
  drop_deep: "Drop deep",
  counter: "Break",
  spread: "Spread out",
  sprint_back: "Recover",
  delay: "Delay"
};

export interface IntentCtx {
  phase: GamePhase;
  mentality: Mentality;
  /** the slot's designed spot, own attacking frame (0 = opponent goal) */
  slot: { x: number; y: number };
  /** ball position in the same frame */
  ball: { x: number; y: number };
  /** 0 = deep in own half, 1 = in the opponent box */
  prog: number;
}

export interface IntentPick {
  id: IntentId;
  /** how strongly the intent target overrides the phase/base target (0..1) */
  mix: number;
  /** target point, own attacking frame */
  target: { x: number; y: number };
  /** seconds until this player re-decides */
  seconds: number;
}

const clampP = (v: number) => Math.max(4, Math.min(96, v));
const paceOf = (prof: MotionProfile) =>
  prof.gk ? (prof.speed - 6.5) / 0.035 : (prof.speed - 8.5) / 0.095;

interface D {
  prof: MotionProfile;
  c: IntentCtx;
  d: number; // distance slot → ball
  wide: boolean;
  pace: number;
}

/** Target geometry per intent (own attacking frame; y 0 = opponent goal). */
const TARGET: Record<IntentId, (d: D) => { x: number; y: number; mix: number; secs: [number, number] }> = {
  hold: (d) => ({ x: d.c.slot.x, y: d.c.slot.y, mix: 0.35, secs: [2.2, 3.8] }),
  support: (d) => ({
    x: clampP((d.c.slot.x + d.c.ball.x) / 2 + (d.c.slot.x < 50 ? 7 : -7)),
    y: clampP(d.c.ball.y + 9),
    mix: 0.65,
    secs: [1.6, 2.8]
  }),
  come_short: (d) => ({
    x: clampP(d.c.slot.x * 0.45 + d.c.ball.x * 0.55),
    y: clampP(d.c.ball.y + 5),
    mix: 0.7,
    secs: [1.2, 2.2]
  }),
  drift_wide: (d) => ({
    x: clampP(d.c.slot.x < 50 ? d.c.slot.x - 10 : d.c.slot.x + 10),
    y: clampP(d.c.ball.y - 3),
    mix: 0.6,
    secs: [2.0, 3.4]
  }),
  run_behind: (d) => ({
    x: clampP(d.c.slot.x + (d.prof.seed - 0.5) * 16),
    y: clampP(Math.max(7, d.c.ball.y - 13 - d.pace / 20)),
    mix: 0.85,
    secs: [1.4, 2.4]
  }),
  overlap: (d) => ({
    x: clampP(d.c.slot.x + (d.c.slot.x < 50 ? -3 : 3)),
    y: clampP(Math.max(6, d.c.ball.y - 15)),
    mix: 0.8,
    secs: [1.6, 2.6]
  }),
  hold_line: (d) => ({ x: d.c.slot.x, y: clampP(d.c.slot.y), mix: 0.55, secs: [2.4, 4.2] }),
  press_ball: (d) => ({ x: clampP(d.c.ball.x), y: clampP(d.c.ball.y), mix: 0.85, secs: [0.9, 1.8] }),
  cover: (d) => ({
    x: clampP((d.c.slot.x + d.c.ball.x) / 2),
    y: clampP((d.c.ball.y + 100) / 2),
    mix: 0.75,
    secs: [1.8, 3.0]
  }),
  drop_deep: (d) => ({ x: d.c.slot.x, y: clampP(d.c.slot.y + 11), mix: 0.7, secs: [2.2, 3.6] }),
  counter: (d) => ({
    x: clampP(d.c.slot.x + (d.c.slot.x < 50 ? -7 : 7)),
    y: clampP(d.c.slot.y - 12),
    mix: 0.85,
    secs: [1.8, 3.0]
  }),
  spread: (d) => ({
    x: d.c.slot.x < 50 ? clampP(d.c.slot.x - 12) : clampP(d.c.slot.x + 12),
    y: clampP(d.c.slot.y - 4),
    mix: 0.7,
    secs: [1.8, 2.8]
  }),
  sprint_back: (d) => ({ x: d.c.slot.x, y: clampP(d.c.slot.y + 13), mix: 0.8, secs: [1.6, 2.6] }),
  delay: (d) => ({
    x: clampP((d.c.slot.x + d.c.ball.x) / 2),
    y: clampP((d.c.slot.y + d.c.ball.y) / 2),
    mix: 0.6,
    secs: [1.2, 2.2]
  })
};

type Wf = (d: D, m: Mentality) => number;
const fore = (m: Mentality) => (m === "att" ? 1.5 : m === "def" ? 0.55 : 1);

/** Candidate intents + weight functions per phase. Omitted = not allowed. */
const PHASE_WEIGHTS: Record<GamePhase, Partial<Record<IntentId, Wf>>> = {
  in: {
    hold: () => 1.0,
    support: (d) => 0.5 + d.prof.support * 1.3,
    come_short: (d) => (d.d < 42 ? 0.35 + d.prof.support * 0.7 : 0.05),
    drift_wide: (d) => 0.15 + Math.max(0, d.prof.width) * 1.5,
    run_behind: (d, m) =>
      (0.1 + d.prof.push * 0.05 + d.prof.break * 0.5 + d.pace / 160) *
      fore(m) *
      (d.c.slot.y < 55 ? 1.35 : 0.7),
    overlap: (d, m) => (d.wide ? 0.5 + d.prof.push * 0.03 : 0) * fore(m)
  },
  out: {
    hold_line: () => 0.9,
    press_ball: (d, m) =>
      d.prof.press *
      (1.1 + Math.max(0, 1 - d.d / 48)) *
      (m === "att" ? 1.35 : m === "def" ? 0.75 : 1),
    cover: (d) => 0.5 + (1 - d.c.prog) * 0.6 + d.prof.drop * 0.02,
    drop_deep: (d, m) => (0.15 + d.prof.drop * 0.05) * (m === "def" ? 1.9 : m === "att" ? 0.5 : 1)
  },
  break: {
    counter: (d, m) => (0.5 + d.prof.break * 1.1 + d.pace / 150) * fore(m),
    spread: (d) => 0.3 + Math.max(0, d.prof.width),
    support: () => 0.25
  },
  recover: {
    sprint_back: (d) => 1.0 + d.prof.recovery,
    delay: (d) => 0.3 + d.prof.press * 0.5,
    press_ball: (d, m) => d.prof.press * 0.7 * (m === "att" ? 1.3 : m === "def" ? 0.8 : 1)
  }
};

const GK_ALLOWED: IntentId[] = ["hold", "hold_line", "come_short"];

/**
 * Pick this player's next intent. Pure: same rng state → same pick.
 */
export function decideIntent(prof: MotionProfile, ctx: IntentCtx, rng: Rng): IntentPick {
  const d: D = {
    prof,
    c: ctx,
    d: Math.hypot(ctx.slot.x - ctx.ball.x, ctx.slot.y - ctx.ball.y),
    wide: Math.abs(ctx.slot.x - 50) >= 32,
    pace: paceOf(prof)
  };
  const table = PHASE_WEIGHTS[ctx.phase];
  const cands: { id: IntentId; w: number }[] = [];
  for (const id of INTENT_IDS) {
    const wf = table[id];
    if (!wf) continue;
    let w = wf(d, ctx.mentality);
    if (w <= 0) continue;
    if (prof.gk && !GK_ALLOWED.includes(id)) w *= 0.04;
    cands.push({ id, w });
  }
  // keepers never get transition intents — with none allowed in the phase,
  // they hold their line instead of breaking or recovering like an outfielder
  let pool = cands;
  if (prof.gk) {
    const allowed = cands.filter((o) => GK_ALLOWED.includes(o.id));
    pool = allowed.length ? allowed : [{ id: "hold_line" as IntentId, w: 1 }];
  }
  const pick = pickWeighted(rng, pool, (o) => o.w);
  const t = TARGET[pick.id](d);
  const mid = (t.secs[0] + t.secs[1]) / 2;
  const span = (t.secs[1] - t.secs[0]) / 2;
  const seconds = Math.max(0.7, mid + (rng() * 2 - 1) * span);
  return { id: pick.id, mix: t.mix, target: { x: t.x, y: t.y }, seconds };
}
