import type { FormationId, Player, Position } from "./types";

/** All balance numbers live here — tune, don't scatter. */
export const T = {
  clubs: 10,
  squad: { GK: 3, DF: 7, MF: 7, FW: 5 } as Record<Position, number>,
  attrRange: [42, 82] as [number, number],
  ageRange: [17, 35] as [number, number],
  /** per-club strength offsets at generation (top clubs first on the list) */
  strengthOffsets: [8, 7, 6, 5, 3, 2, 1, 0, 0, -1, -1, -2, -3, -3, -4, -5, -5, -6, -7, -8],

  /** match engine */
  baseChancePerMinute: 0.108,
  conversionBase: 0.115,
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

  /** possession timeline (2D match view) */
  chainPasses: [2, 5] as [number, number],

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
