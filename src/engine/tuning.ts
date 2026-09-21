import type { FormationId, Position } from "./types";

/** All balance numbers live here — tune, don't scatter. */
export const T = {
  clubs: 10,
  squad: { GK: 3, DF: 7, MF: 7, FW: 5 } as Record<Position, number>,
  attrRange: [42, 82] as [number, number],
  ageRange: [17, 35] as [number, number],
  /** per-club strength offsets at generation (top clubs first on the list) */
  strengthOffsets: [8, 6, 4, 2, 0, 0, -2, -3, -5, -6],

  /** match engine */
  baseChancePerMinute: 0.135,
  conversionBase: 0.115,
  saveShare: 0.42, // of non-goal chance outcomes
  homeAdvantage: 1.08,
  mentality: {
    def: { att: 0.85, def: 1.15 },
    bal: { att: 1.0, def: 1.0 },
    att: { att: 1.15, def: 0.85 }
  } as Record<string, { att: number; def: number }>,
  yellowPerMatch: 3.6,
  redChancePerFoul: 0.045,
  injuryPerMatch: 0.32,
  injuryWeeks: [1, 4] as [number, number],

  /** conditioning */
  conditionLossStarter: 16,
  conditionLossSub: 8,
  conditionRecovery: 34,

  /** substitutions */
  subMinute: 62,
  maxSubs: 5,

  ratingBase: 6.0
};

export const FORMATIONS: Record<FormationId, Position[]> = {
  "4-4-2": ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW"],
  "4-3-3": ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"],
  "4-2-3-1": ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW"],
  "3-5-2": ["GK", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW", "FW"],
  "5-3-2": ["GK", "DF", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW"]
};

export const BENCH_SLOTS = 7;

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];
