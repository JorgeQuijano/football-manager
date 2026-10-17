import type { MatchSideState, MatchState, Player, RoleId } from "./types";
import { hashSeed, mulberry32, pickWeighted, type Rng } from "./rng";
import { POSSESSION, styleOf } from "./tuning";
import { offsideLine } from "./laws";
import { oiInvolve } from "./talks";
import {
  defendersOf,
  laneRisk,
  pressureAt,
  segDist,
  shapeFor,
  toFrame,
  ysInOtherFrame,
  type Defender,
  type Pt
} from "./positions";

/**
 * The possession model (v0.46).
 *
 * The old chains were a random walk over the formation template: the shooter
 * was chosen first and a plausible-looking sequence of slots was drawn backwards
 * to him, so nothing about the play — pressure, distance, skill, style — was
 * real. Now a move is *played*: the carrier picks a target from the live shape,
 * the pass is rolled against the passer's touch, its length, the men closing him
 * down and the bodies in the lane, and if it fails a defender steps in or the
 * ball runs out. A chance move that cannot reach its shooter is just a
 * turnover — the shot does not happen.
 *
 * Everything is pure: the move's rolls come from their own stream keyed to the
 * match seed, the minute and the side (`hashSeed(flowSeed, m, "move", side)`),
 * so a style's passing can never bias anyone else's dice — the same lesson as
 * the chance rolls (v0.45) — and the same move replays byte-identically.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Pt, b: Pt) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  // Math.hypot is overflow-safe and slow; this is the move loop's hottest line
  return Math.sqrt(dx * dx + dy * dy);
};

interface Proto {
  slot: number;
  p: Player;
  role: RoleId;
}

const protoOf = (side: MatchSideState, players: Map<string, Player>): Proto[] =>
  side.slots
    .map((id, slot) => {
      if (!id) return null;
      const p = players.get(id);
      return p ? { slot, p, role: side.roles[slot] } : null;
    })
    .filter((x): x is Proto => x !== null);

export interface MoveOpts {
  s: MatchState;
  atk: MatchSideState;
  def: MatchSideState;
  players: Map<string, Player>;
  minute: number;
  /** the move is being played to reach this slot (a chance); omit for open possession */
  endSlot?: number;
  /**
   * the shooting range (attacking frame, v0.47): a completed pass into it ends
   * the move as a shot — chances emerge from progression, not from a per-minute
   * roll. The caller reads the shooter from the last slot of the chain.
   */
  shootRange?: number;
  /**
   * where the side won the ball (its own frame, v0.47): the move tends to start
   * with the man nearest that spot, so possession has somewhere to resume —
   * a side that wins it in midfield attacks from midfield
   */
  fromY?: number;
  /** force the first carrier (tests); otherwise chosen deep by the side's shape */
  startSlot?: number;
}

export interface MoveResult {
  /** carrier slots in order — the chain the view and the report read */
  chain: number[];
  /** attempted pass distances in pitch units, one per attempt */
  pd: number[];
  /** forward delta per attempt (+ = forward), one per attempt */
  pf: number[];
  /** completed passes out of `pd` */
  pc: number;
  end: "arrived" | "turnover" | "out" | "held";
  /** defending slot that cut the move out */
  interceptor?: number;
  /** where the ball ended, in the attacking side's frame */
  last: Pt;
  /** ball position after each completed pass (attacking frame) */
  pts: Pt[];
}

/** The probability that one pass sticks. Exported for tests and the harness. */
export function passProbability(
  passer: Player,
  receiver: Player,
  d: number,
  pressure: number,
  lane: number,
  risk: number
): number {
  const passF = clamp(
    POSSESSION.passBase + (passer.attrs.passing - 60) / POSSESSION.passSpan,
    POSSESSION.passMin,
    POSSESSION.passMax
  );
  const recvF = POSSESSION.recvBase + (receiver.attrs.passing - 60) / POSSESSION.recvSpan;
  const distF = 1 - clamp((d - POSSESSION.distFree) / POSSESSION.distSpan, 0, POSSESSION.distMax);
  const pressF = 1 - POSSESSION.pressWeight * pressure;
  const laneF = 1 - POSSESSION.laneWeight * lane;
  const riskF = 1 - POSSESSION.riskWeight * risk;
  return clamp(POSSESSION.base * passF * recvF * distF * pressF * laneF * riskF, POSSESSION.pMin, POSSESSION.pMax);
}

const pickInterception = (from: Pt, to: Pt, defs: Defender[], rng: Rng): Defender | undefined => {
  const near = defs.filter((d) => segDist(d.pt, from, to) < POSSESSION.interRadius);
  if (!near.length) return undefined;
  return pickWeighted(
    rng,
    near,
    (d) => (1 - segDist(d.pt, from, to) / POSSESSION.interRadius) * (0.6 + d.defending / 120)
  );
};

/** Play one move. Pure: same inputs, same move. */
export function playMove(o: MoveOpts): MoveResult {
  const st = styleOf(o.atk.style);
  const defSt = styleOf(o.def.style);
  const atk = protoOf(o.atk, o.players);
  if (!atk.length) return { chain: [], pd: [], pf: [], pc: 0, end: "turnover", last: [50, 50], pts: [] };
  const bySlot = new Map(atk.map((x) => [x.slot, x] as const));
  // the men this defence has singled out are harder to find (v0.47): with the
  // chance dice gone, the move is where marking costs a man his touches — the
  // old shooter pick no longer exists to carry the involve penalty
  const invol = new Map<number, number>();
  for (const x of atk) {
    const f = oiInvolve(o.def, x.p.id);
    if (f !== 1) invol.set(x.slot, f);
  }
  const seed = o.s.flowSeed ?? o.s.rngState;
  const sideKey = o.s.home === o.atk ? "h" : "a";
  const rng = mulberry32(hashSeed(seed, o.minute, "move", sideKey));

  const yOf = (slot: number) => clamp(o.atk.coords[slot]?.[1] ?? 50, 0, 100);
  const startWeight = (x: Proto) => {
    const base = Math.pow(yOf(x.slot) / 100, 2.2) * (x.p.pos === "GK" ? 0.35 : 1) + 0.12;
    if (o.fromY === undefined || x.p.pos === "GK") return base;
    // the ball resumes where it was won (v0.47): a side that won it in midfield
    // builds from midfield, not from its own six-yard box
    const d = yOf(x.slot) - o.fromY;
    return base * (1 + POSSESSION.startSpot * Math.exp(-(d * d) / (2 * 18 * 18)));
  };
  let start = o.startSlot;
  if (start === undefined) start = pickWeighted(rng, atk, startWeight).slot;
  if (o.endSlot !== undefined && start === o.endSlot) {
    const alt = atk.filter((x) => x.slot !== o.endSlot);
    if (alt.length) start = pickWeighted(rng, alt, startWeight).slot;
  }

  // a chance move is played with a little more patience than open circulation
  const budget =
    Math.max(2, Math.round(POSSESSION.budgetBase * st.tempo)) + (o.endSlot !== undefined ? 1 : 0);
  // a move that is still advancing keeps probing (v0.47): the second budget is
  // how a short-passing side crosses the pitch — progression, not a roll. A
  // move that has not crossed halfway when its first budget runs out still
  // dies with the clearance, exactly as before
  const budgetTotal = o.endSlot !== undefined ? budget : budget * 2;
  const preferred = POSSESSION.lenBase + POSSESSION.lenSpan * st.directness;
  const sigma = POSSESSION.lenSigmaBase + POSSESSION.lenSigmaSpan * st.directness;
  // how often the ball is played through to the striker a beat too early
  const pEarly = POSSESSION.earlyBase + POSSESSION.earlySpan * st.directness;
  let carrier = start;
  let ball: Pt = o.atk.coords[carrier] ?? [50, 50];
  const chain = [carrier];
  const pd: number[] = [];
  const pf: number[] = [];
  const pts: Pt[] = [ball];
  let pc = 0;
  // one weight slot per formation slot, reused every pass (a Map here showed
  // up in the perf profile — this loop runs per candidate per pass)
  const weights: number[] = new Array(11).fill(0);

  for (let k = 0; k < budgetTotal; k++) {
    const defShape = shapeFor(o.def, { ball: toFrame(ball), phase: "defend" });
    const defs = defendersOf(o.def, defShape, o.players);
    // the live offside line: attackers hold it, so the model does not offer a
    // man standing in an offside position (v0.46)
    const lineY = offsideLine(ysInOtherFrame(defShape));
    const atkShape = shapeFor(o.atk, { ball, phase: "attack", carrier, offsideLine: lineY });
    const from = atkShape[carrier] ?? ball;
    const cands = atk.filter((x) => x.slot !== carrier);
    if (!cands.length) break;
    const lastK = k === budgetTotal - 1;
    for (const x of cands) {
      const to = atkShape[x.slot] ?? [50, 50];
      const d = dist(from, to);
      const lenPref = Math.exp(-((d - preferred) ** 2) / (2 * sigma * sigma));
      const prog = from[1] - to[1]; // positive = forward
      const fwd = 1 + clamp(prog, -25, 45) * (0.01 + 0.025 * st.risk);
      // switching the play to the far side is worth a ball: space, not progress
      const sw = 1 + 0.15 * st.width * clamp((Math.abs(to[0] - from[0]) - 15) / 35, 0, 1);
      const open = 1 - 0.5 * pressureAt(to, defs, POSSESSION.pressRadius);
      const gk = x.p.pos === "GK" ? 0.05 : 1;
      // a shot is a target too (v0.47): the chance is not declared first, it
      // emerges from the move — so the *final* ball of an advanced move looks
      // for the man in the shooting range. Earlier passes circulate normally;
      // deep moves progress normally, they do not launch hopeful balls
      const late = lastK || from[1] < 65;
      const end =
        x.slot === o.endSlot
          ? late
            ? POSSESSION.endLate
            : POSSESSION.endWeight
          : lastK && o.shootRange !== undefined && to[1] <= o.shootRange
            ? POSSESSION.endLate * 0.6
            : 1;
      // a man the defence has singled out is harder to find — and as the man the
      // final ball is looking for, the marker's job is exactly to deny him, so
      // the penalty compounds there (v0.47): the end boost cannot override it
      const involF = invol.get(x.slot) ?? 1;
      const endF = end > 1 ? end * involF * involF : end;
      weights[x.slot] = Math.max(1e-6, lenPref * fwd * sw * open * gk * endF * involF);
    }
    const target = pickWeighted(rng, cands, (x) => weights[x.slot] ?? 0);
    let to = atkShape[target.slot] ?? [50, 50];
    // every so often the ball is played through a beat too early and the runner
    // is caught a step beyond the line — the flag goes up (v0.46)
    // the early through ball (v0.46): a ball played in behind for a runner in
    // the box, a beat too soon. Only box-bound balls are played early (v0.47 —
    // with chances emergent, every final ball would otherwise be a gamble)
    const shotBound =
      target.slot === o.endSlot ||
      (o.shootRange !== undefined && to[1] <= Math.min(o.shootRange, 26));
    if (shotBound && to[1] <= lineY + 2 && rng() < pEarly) {
      to = [to[0], clamp(lineY - 1.5, 3, 97)];
    }
    const shot = o.shootRange !== undefined && to[1] <= o.shootRange;
    const d = dist(from, to);
    pd.push(Math.round(d * 10) / 10);
    pf.push(Math.round((from[1] - to[1]) * 10) / 10);
    const pressure = Math.min(
      1.2,
      pressureAt(from, defs, POSSESSION.pressRadius) * (0.75 + 0.5 * defSt.pressIntensity)
    );
    const lane = laneRisk(from, to, defs, POSSESSION.laneRadius);
    const passer = bySlot.get(carrier);
    const p = passProbability(passer?.p ?? target.p, target.p, d, pressure, lane, st.risk);
    if (rng() < p) {
      pc++;
      chain.push(target.slot);
      ball = to;
      pts.push(to);
      carrier = target.slot;
      if ((o.endSlot !== undefined && carrier === o.endSlot) || shot) {
        return { chain, pd, pf, pc, end: "arrived", last: ball, pts };
      }
      // between the two budgets: a move that has not crossed halfway when the
      // first runs out dies here (v0.47) — the clearance path below
      if (k === budget - 1 && ball[1] >= 50) break;
      continue;
    }
    // the pass did not stick: a defender cuts it out, or it runs out of play
    const inter = pickInterception(from, to, defs, rng);
    if (inter) {
      // the ball is won where the interceptor actually is (already in our frame)
      return { chain, pd, pf, pc, end: "turnover", interceptor: inter.slot, last: inter.pt, pts };
    }
    return { chain, pd, pf, pc, end: "out", last: to, pts };
  }

  // out of passes in a good position (v0.48): a patient side recycles and
  // camps — the ball stays with it, and the next minute's move resumes from
  // here. Deep or stalled moves still die with the clearance below
  const hold = clamp(
    POSSESSION.holdBase + POSSESSION.holdSpan * (st.retention - 1),
    0,
    POSSESSION.holdMax
  );
  if (ball[1] <= POSSESSION.holdFrom && rng() < hold) {
    return { chain, pd, pf, pc, end: "held", last: ball, pts };
  }

  // out of passes: the move dies — and it dies with a ball forward, not a gift
  // in the attacking side's own third (a clearance the defence drops on)
  const clearance: Pt = [
    clamp(ball[0] + (rng() < 0.5 ? -12 : 12), 4, 96),
    clamp(ball[1] - 25, 8, 92)
  ];
  const defs = defendersOf(o.def, shapeFor(o.def, { ball: toFrame(ball), phase: "defend" }), o.players);
  const inter = pickInterception(clearance, clearance, defs, rng);
  return { chain, pd, pf, pc, end: "turnover", interceptor: inter?.slot, last: clearance, pts };
}
