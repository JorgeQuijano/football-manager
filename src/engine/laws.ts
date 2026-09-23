import type { MatchSideState, MatchState, Player } from "./types";
import { T } from "./tuning";
import type { Rng } from "./rng";

/**
 * The laws of the game, applied (v0.42).
 *
 * The match engine used to *flavour* the rules: offside was a dice roll on
 * goals ("15% of open-play goals were actually offside"), the ball went out for
 * a throw-in to nobody in particular, and the back-pass rule did not exist at
 * all. This module makes the rulings real where the engine has the facts to make
 * them, and returns an explicit verdict everywhere else:
 *
 *  - **offside** is judged from positions: the line is the second-last defender
 *    (never nearer the goal than the halfway line), a pass must be forward, and
 *    throw-ins, corners and goal kicks can never be offside;
 *  - **the back-pass rule**: a deliberate team-mate pass to the keeper can be
 *    picked up — and when he does, it is an indirect free kick;
 *  - **handball** in the box is a penalty;
 *  - **restarts** are decided by who put the ball out and where: an attacker's
 *    touch over the goal line is a goal kick, a defender's is a corner, and the
 *    touchline always gives the throw to the other side.
 *
 * Everything here is deterministic given the state and the rng stream, and every
 * ruling has a test that constructs the situation and asserts the verdict.
 */

export interface OffsideRuling {
  offside: boolean;
  /** a coat of paint: the flag may miss it (and VAR may overturn a goal) */
  tight: boolean;
  /** the line itself, in pitch units (0 = the goal they attack) */
  line: number;
  /** why, for the commentary */
  reason: "beyond" | "level" | "behind" | "own-half" | "backward" | "restart" | "keeper" | "no-line";
}

/** Depth: y=0 is the goal a side attacks, y=100 its own. */
const depth = (side: MatchSideState, slot: number): number => side.coords[slot]?.[1] ?? 50;

/** Do the rules even allow offside from this restart? */
export const OFFSIDE_FROM: Record<string, boolean> = {
  open: true,
  turnover: true,
  throw: false, // no offside from a throw-in
  corner: false,
  goalkick: false
};

/**
 * The defending side's offside line: the second-last defender, or the halfway
 * line if that defender is deeper than halfway (you cannot be offside in your
 * own half).
 */
export function offsideLine(defSide: MatchSideState, onPitch: Array<{ slot: number; p: Player }>): number {
  const men = onPitch
    .map((x) => ({ slot: x.slot, y: depth(defSide, x.slot), isGk: x.p.pos === "GK" }))
    .sort((a, b) => a.y - b.y); // nearest their own goal first
  if (men.length < 2) return 50;
  // the last man is usually the keeper; the second-last is the line
  const second = men[1];
  // you cannot be offside in your own half, so the line never retreats past halfway
  return Math.min(second.y, 50);
}

export function checkOffside(
  atkSide: MatchSideState,
  defSide: MatchSideState,
  defenders: Array<{ slot: number; p: Player }>,
  attackers: Array<{ slot: number; p: Player }>,
  passerSlot: number | undefined,
  receiverSlot: number | undefined,
  restart = "open"
): OffsideRuling {
  if (!OFFSIDE_FROM[restart]) return { offside: false, tight: false, line: 50, reason: "restart" };
  if (passerSlot === undefined || receiverSlot === undefined) {
    return { offside: false, tight: false, line: 50, reason: "no-line" };
  }
  const receiver = attackers.find((x) => x.slot === receiverSlot);
  if (!receiver || receiver.p.pos === "GK") {
    return { offside: false, tight: false, line: 50, reason: "keeper" };
  }
  const line = offsideLine(defSide, defenders);
  const ry = depth(atkSide, receiverSlot);
  const py = depth(atkSide, passerSlot);
  if (ry >= 50) return { offside: false, tight: false, line, reason: "own-half" };
  if (ry >= py) return { offside: false, tight: false, line, reason: "backward" }; // the pass was not forward
  const beyond = line - ry; // positive = past the line, toward the goal they attack
  if (beyond > T.offsideTolerance) return { offside: true, tight: beyond < T.offsideTight, line, reason: "beyond" };
  return { offside: false, tight: beyond > -T.offsideTight, line, reason: beyond < 0 ? "behind" : "level" };
}

/**
 * The back-pass rule: which slot in this chain, if any, was a deliberate pass to
 * the side's own keeper? (Law: he may not pick that up with his hands.)
 */
export function backPassTarget(
  chain: number[],
  attackers: Array<{ slot: number; p: Player }>
): number | null {
  for (let i = 1; i < chain.length; i++) {
    const man = attackers.find((x) => x.slot === chain[i]);
    if (man?.p.pos === "GK") return chain[i];
  }
  return null;
}

/** Under pressure, a keeper may take the easy option — and it is a free kick. */
export function keeperPicksItUp(pressure: number, rng: Rng): boolean {
  const p = T.backPassHandle * (1 + Math.max(0, pressure));
  return rng() < Math.max(0, Math.min(0.75, p));
}

/** Handball in the area is a penalty; outside it, a free kick. */
export function handballVerdict(inBox: boolean, rng: Rng): "penalty" | "freekick" | null {
  if (rng() >= T.handballRate) return null;
  return inBox ? "penalty" : "freekick";
}

/**
 * Who restarts, and how, when the ball crosses a line. `lastTouch` is the side
 * that played it out; `line` is which line it crossed.
 */
export function restartAfterOut(
  lastTouch: "atk" | "def",
  line: "touchline" | "goal-line-defending",
  deep: boolean
): { restart: "throw" | "corner" | "goalkick"; to: "atk" | "def" } {
  if (line === "touchline") return { restart: "throw", to: lastTouch === "atk" ? "def" : "atk" };
  // over the goal line the attack is attacking: defender's touch = corner, attacker's = goal kick
  if (lastTouch === "def") return { restart: "corner", to: "atk" };
  return { restart: "goalkick", to: "def" };
}

/** The linesman's call on the pitch — a tight one can be missed. */
export function flagGoesUp(ruling: OffsideRuling, rng: Rng): boolean {
  if (!ruling.offside) return false;
  if (!ruling.tight) return true;
  return rng() >= T.linesmanMiss;
}

export const LAW_TEXT = {
  /** (player, team) */
  offsideFlag: [
    (n: string) => `Flag up! ${n} went too early — offside.`,
    (n: string) => `The assistant's flag is up against ${n}. Offside.`,
    (n: string) => `${n} strayed beyond the last man — offside.`
  ],
  backPass: [
    (n: string) => `Back to the keeper — and ${n} picks it up! Indirect free kick.`,
    (n: string) => `He gathers it with his hands from a team-mate. The referee has seen it — free kick.`,
    (n: string) => `Careless: a deliberate pass back, and ${n} handles it. Free kick.`
  ],
  handball: [
    () => "Handball! The referee points to the spot.",
    () => "It strikes an arm in the area — penalty!",
    () => "Handball in the box. Penalty."
  ],
  goalKick: [
    (t: string) => `${t} will restart with a goal kick.`,
    (t: string) => `Over the line off the attacker — goal kick to ${t}.`
  ]
};

/** On-pitch players of a side as `{ slot, player }` — the shape the law checks want. */
export const attackersOf = (side: MatchSideState, players: Map<string, Player>) =>
  side.slots
    .map((id, slot) => {
      const p = id ? players.get(id) : undefined;
      return p ? { slot, p } : null;
    })
    .filter((x): x is { slot: number; p: Player } => x !== null);
