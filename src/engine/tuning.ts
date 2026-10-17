import type { FormationId, Player, Position, TacticStyle } from "./types";
import { hashSeed, mulberry32 } from "./rng";

/** All balance numbers live here — tune, don't scatter. */
export const T = {
  clubs: 10,
  squad: { GK: 3, DF: 7, MF: 7, FW: 5 } as Record<Position, number>,
  attrRange: [42, 82] as [number, number],
  ageRange: [17, 35] as [number, number],
  /** per-club strength offsets at generation (top clubs first on the list) */
  strengthOffsets: [8, 7, 6, 5, 3, 2, 1, 0, 0, -1, -1, -2, -3, -3, -4, -5, -5, -6, -7, -8],

  /** match engine */
  /**
   * the shooting range (attacking frame, v0.47): a completed pass into it ends
   * the move as a shot. This is the goal-volume dial now that chances emerge
   * from progression — bigger range, more (and worse) shots
   */
  shootRange: 30,
  conversionBase: 0.24,
  saveShare: 0.42, // of non-goal chance outcomes
  homeAdvantage: 1.08,
  mentality: {
    def: { att: 0.85, def: 1.15 },
    bal: { att: 1.0, def: 1.0 },
    att: { att: 1.15, def: 0.85 }
  } as Record<string, { att: number; def: number }>,
  /** fouls & cards (fouls produce restarts; a share of them are carded) */
  foulPerMatch: 20,
  cardShareOfFouls: 0.18, // 20 × 0.18 ≈ 3.6 cards/match
  redChancePerFoul: 0.045,
  /** set pieces */
  fkZoneShare: 0.18, // share of fouls in the attacking third
  penShareOfAttFouls: 0.07, // → ≈ 0.25 penalties/match
  // --- on-pitch realism (v0.19): officials, offside & VAR ---
  offsideRate: 0.15, // share of open-play goals that were actually offside
  linesmanMiss: 0.35, // share of true offsides the flag misses
  // --- the laws, applied (v0.42) ---
  offsideTolerance: 0.6, // pitch units past the line before it is offside
  offsideTight: 2.2, // within this margin it is a "tight" call the flag may miss
  backPassHandle: 0.06, // chance a keeper picks up a deliberate back-pass (a free kick if he does)
  handballRate: 0.02, // share of defensive blocks that are handled (penalty in the box)
  linesmanWrong: 0.08, // share of onside goals wrongly flagged
  varReview: 0.6, // share of controversial calls reviewed
  varCatch: 0.75, // share of reviewed errors corrected
  varPenCheck: 0.12, // share of penalties reviewed
  varPenOverturn: 0.25, // share of reviewed penalties overturned
  fkShotShareOfAttFouls: 0.45, // → ≈ 1.6 direct free-kick attempts/match
  penaltyGoalBase: 0.78,
  fkGoalBase: 0.07,
  cornerGoalBase: 0.026,
  cornerFromBlock: 0.5,
  cornerFromSave: 0.45,
  cornerFromOut: 0.4,
  secondCornerShare: 0.3,
  injuryPerMatch: 0.32,
  injuryWeeks: [1, 4] as [number, number],
  blockShare: 0.2, // share of non-goal outcomes that become blocks (defence-scaled)
  assistChance: 0.82, // share of goals that are assisted

  /** conditioning */
  conditionLossStarter: 16,
  conditionLossSub: 8,
  tiredThreshold: 65,

  /** substitutions */
  subMinute: 62,
  maxSubs: 5,
  /** in-match substitution windows (PL rules: 3 windows + half-time, 5 subs) */
  subWindowsMax: 3,

  /** in-match stamina (legs) */
  staminaDrain: 0.42,
  /** recovered over the half-time break */
  staminaHalf: 7,
  /** what total exhaustion costs a player's game (±16%) */
  staminaEffect: 0.16,

  ratingBase: 6.0
};

export const FORMATIONS: Record<FormationId, Position[]> = {
  "4-4-2": ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW"],
  "4-3-3": ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"],
  "4-2-3-1": ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW"],
  "3-5-2": ["GK", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW", "FW"],
  "5-3-2": ["GK", "DF", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW"]
};

/**
 * Pitch coordinates per slot (index-aligned with FORMATIONS):
 * x: 0 = left touchline, 100 = right;  y: 0 = opponent goal, 100 = own goal.
 */
export const FORMATION_COORDS: Record<FormationId, Array<[number, number]>> = {
  "4-4-2": [
    [50, 91],
    [14, 72], [37, 75], [63, 75], [86, 72],
    [14, 48], [37, 51], [63, 51], [86, 48],
    [36, 20], [64, 20]
  ],
  "4-3-3": [
    [50, 91],
    [14, 72], [37, 75], [63, 75], [86, 72],
    [25, 50], [50, 55], [75, 50],
    [14, 22], [50, 16], [86, 22]
  ],
  "4-2-3-1": [
    [50, 91],
    [14, 72], [37, 75], [63, 75], [86, 72],
    [36, 58], [64, 58], [14, 38], [50, 36], [86, 38],
    [50, 15]
  ],
  "3-5-2": [
    [50, 91],
    [25, 74], [50, 77], [75, 74],
    [8, 52], [32, 52], [50, 55], [68, 52], [92, 52],
    [38, 20], [62, 20]
  ],
  "5-3-2": [
    [50, 91],
    [8, 72], [30, 75], [50, 77], [70, 75], [92, 72],
    [28, 50], [50, 53], [72, 50],
    [38, 20], [62, 20]
  ]
};

export const BENCH_SLOTS = 7;

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];

/**
 * Weekly recovery: younger, more physical players bounce back faster.
 * Old low-physical players recover less than a full match costs them,
 * so they need rotation — that's the point.
 */
export function weeklyRecovery(p: Player): number {
  return Math.max(
    8,
    Math.round(9 + (35 - Math.min(p.age, 35)) * 0.5 + (p.attrs.physical - 60) * 0.15)
  );
}

// --- playing styles (v0.45) --------------------------------------------------

export interface StyleDef {
  id: TacticStyle;
  label: string;
  blurb: string;
  /** attack / defence strength multipliers — the coarse outcome edge */
  att: number;
  def: number;
  /** ball progression: 0 = patient and short, 1 = long and vertical */
  directness: number;
  /** passing cadence: passes per move multiplier */
  tempo: number;
  /** lateral ambition: wide overloads vs central combinations */
  width: number;
  /** risk appetite: forward share, line-breaking attempts */
  risk: number;
  /** where the press starts (0 = own box, 1 = their box) */
  pressHeight: number;
  /** how hard they press: stamina, fouls, forced errors */
  pressIntensity: number;
  /** defensive line: 0 = high, 1 = deep block */
  lineHeight: number;
  /** urgency the moment the ball is won */
  counterBias: number;
  /** ball retention: how much of the play they keep */
  retention: number;
  /** stamina drain multiplier */
  stamina: number;
  /** foul rate multiplier */
  fouls: number;
}

/** The six styles, as pure numbers. Tune here, never scatter. */
export const STYLES: Record<TacticStyle, StyleDef> = {
  balanced: {
    id: "balanced",
    label: "Balanced",
    blurb: "Solid and adaptable — no obvious weakness.",
    att: 1,
    def: 1,
    directness: 0.45,
    tempo: 1,
    width: 1,
    risk: 0.5,
    pressHeight: 0.5,
    pressIntensity: 0.6,
    lineHeight: 0.5,
    counterBias: 0.6,
    retention: 1,
    stamina: 1,
    fouls: 1
  },
  tiki_taka: {
    id: "tiki_taka",
    label: "Tiki-Taka",
    blurb: "Short, patient passing and a swarm to win it back.",
    att: 1.02,
    def: 0.99,
    directness: 0.16,
    tempo: 2.1,
    width: 0.95,
    risk: 0.35,
    pressHeight: 0.7,
    pressIntensity: 0.85,
    lineHeight: 0.35,
    counterBias: 0.5,
    retention: 1.3,
    stamina: 1.06,
    fouls: 0.95
  },
  direct: {
    id: "direct",
    label: "Direct",
    blurb: "Get it forward early — long balls and crosses.",
    att: 1.05,
    def: 0.95,
    directness: 0.9,
    tempo: 0.9,
    width: 1.15,
    risk: 0.65,
    pressHeight: 0.45,
    pressIntensity: 0.55,
    lineHeight: 0.5,
    counterBias: 0.7,
    retention: 0.82,
    stamina: 1,
    fouls: 1
  },
  gegenpress: {
    id: "gegenpress",
    label: "Gegenpress",
    blurb: "Hunt the ball high and strike before they set.",
    att: 1.06,
    def: 1.02,
    directness: 0.5,
    tempo: 1.15,
    width: 0.95,
    risk: 0.6,
    pressHeight: 0.9,
    pressIntensity: 1.4,
    lineHeight: 0.25,
    counterBias: 1.1,
    retention: 1.05,
    stamina: 1.22,
    fouls: 1.2
  },
  park_bus: {
    id: "park_bus",
    label: "Park the Bus",
    blurb: "A deep, stubborn block — and a long clearance.",
    att: 0.84,
    def: 1.16,
    directness: 0.8,
    tempo: 0.7,
    width: 0.8,
    risk: 0.25,
    pressHeight: 0.12,
    pressIntensity: 0.35,
    lineHeight: 0.92,
    counterBias: 1.15,
    retention: 0.72,
    stamina: 0.88,
    fouls: 1.05
  },
  counter: {
    id: "counter",
    label: "Counter",
    blurb: "Sit in, then break at speed the moment it turns.",
    att: 1,
    def: 1.06,
    directness: 0.85,
    tempo: 0.95,
    width: 0.9,
    risk: 0.55,
    pressHeight: 0.3,
    pressIntensity: 0.45,
    lineHeight: 0.72,
    counterBias: 1.45,
    retention: 0.8,
    stamina: 0.95,
    fouls: 1
  }
};

export const STYLE_IDS = Object.keys(STYLES) as TacticStyle[];

/** The style definition for an id, tolerant of legacy saves. */
export const styleOf = (id: TacticStyle | undefined): StyleDef =>
  STYLES[id ?? "balanced"] ?? STYLES.balanced;

/**
 * The style a club plays with — its identity. Deterministic from the club's id
 * and generation strength: strong sides dominate games, weak sides sit deep.
 */
export function styleFor(club: { id: string; strength: number }): TacticStyle {
  const r = mulberry32(hashSeed(club.id, "style"))();
  const weights: Record<TacticStyle, number> =
    club.strength >= 5
      ? { balanced: 2, tiki_taka: 3, direct: 2.5, gegenpress: 3, park_bus: 0.5, counter: 1 }
      : club.strength >= 1
        ? { balanced: 3, tiki_taka: 2, direct: 2, gegenpress: 2, park_bus: 1, counter: 1.5 }
        : club.strength >= -2
          ? { balanced: 3, tiki_taka: 1.5, direct: 2, gegenpress: 1.5, park_bus: 2, counter: 2 }
          : { balanced: 2.5, tiki_taka: 1, direct: 2, gegenpress: 1, park_bus: 3.5, counter: 3 };
  const total = STYLE_IDS.reduce((acc, id) => acc + weights[id], 0);
  let roll = r * total;
  for (const id of STYLE_IDS) {
    roll -= weights[id];
    if (roll <= 0) return id;
  }
  return "balanced";
}

/**
 * The possession model (v0.46): every pass is played — chosen from real geometry,
 * rolled against real pressure. Tune here, never scatter.
 */
export const POSSESSION = {
  /** p = base × passing × receiving × distance × pressure × lane × risk */
  base: 1.18,
  /** passing attribute: 60 → 0.96, every +20 units ≈ +12% */
  passBase: 0.96,
  passSpan: 160,
  passMin: 0.8,
  passMax: 1.12,
  /** the receiver's touch: 60 → 0.99 */
  recvBase: 0.99,
  recvSpan: 400,
  /** distance: full marks inside 10 units, −30% at ~76+ */
  distFree: 10,
  distSpan: 220,
  distMax: 0.3,
  /** men on the passer */
  pressWeight: 0.28,
  pressRadius: 6,
  /** bodies in the lane */
  laneWeight: 0.24,
  laneRadius: 5,
  /** risk appetite: ambitious passes are ambitious */
  riskWeight: 0.1,
  pMin: 0.3,
  pMax: 0.975,
  /** where passes want to go: preferred length grows with directness */
  lenBase: 7,
  lenSpan: 29,
  lenSigmaBase: 6,
  lenSigmaSpan: 9,
  /** the designated shooter gets these weight boosts — more, late */
  endWeight: 2.5,
  endLate: 9,
  /** who can cut out a failed pass */
  interRadius: 26,
  /** passes per move, scaled by tempo */
  budgetBase: 3.6,
  /** the early through ball: how often the striker is played in a step offside */
  earlyBase: 0.14,
  earlySpan: 0.26,
  /** how strongly a move starts near where the side won the ball (v0.47) */
  startSpot: 2.2,
  /**
   * Between minutes the side with the ball keeps it with p = keepBase +
   * 2(1 − keepBase)(p_side − ½) — possession comes in sequences instead of a
   * fresh coin flip, while the share still converges to pPossHome (v0.48)
   */
  keepBase: 0.78,
  keepMin: 0.5,
  keepMax: 0.95,
  /**
   * A move that runs out of passes within holdFrom of the goal may keep the
   * ball instead of gifting a clearance — more, the more the side retains:
   * p = holdBase + holdSpan(retention − 1), so tiki-taka camps and a bus
   * clears (v0.48)
   */
  holdBase: 0.4,
  holdSpan: 0.5,
  holdMax: 0.85,
  holdFrom: 45
};
