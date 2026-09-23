import type { Activity, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { jadedOf, sharpnessOf } from "./physical";

/**
 * The week (v0.35.0): day-by-day management.
 *
 * The match engine still runs once per round — this layer decides what the six
 * days *before* the match do to the squad. Each day carries one activity, the
 * manager sets them (now or in advance), and the daily tick moves condition,
 * freshness, sharpness and injury risk for every club.
 *
 * Rules that keep the game honest:
 *  - a default week reproduces the old weekly recovery (the pacing does not change),
 *  - the day clock is pure state: no RNG draw, no engine call, so determinism and
 *    every existing golden value stay exactly where they were,
 *  - match day is the only day the match engine sees, and it is not optional.
 */

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type DayName = (typeof DAYS)[number];
export const MATCH_DAY = 5; // Sat
export const DAY_NAMES: readonly string[] = DAYS;


export interface ActivityDef {
  id: Activity;
  label: string;
  blurb: string;
  /** condition change for the day */
  condition: number;
  /** freshness (jaded) change for the day: negative is recovery */
  jaded: number;
  /** match sharpness change for the day */
  sharpness: number;
  /** does this day count as training work (development + a knock risk)? */
  trains?: boolean;
  /** small chance per player of a training knock */
  knock?: number;
}

export const ACTIVITIES: Record<Activity, ActivityDef> = {
  rest: { id: "rest", label: "Rest", blurb: "Nothing but recovery — legs come back fastest.", condition: 22, jaded: -7, sharpness: 0 },
  recovery: {
    id: "recovery",
    label: "Recovery",
    blurb: "Pool, bike, light movement. A little back in the tank.",
    condition: 20,
    jaded: -7,
    sharpness: 0
  },
  off: { id: "off", label: "Day off", blurb: "Away from the training ground. Good for the head, rust creeps in.", condition: 18, jaded: -7, sharpness: -1 },
  physical: {
    id: "physical",
    label: "Physical",
    blurb: "Conditioning and gym work — power and pace, and tired legs.",
    condition: -3,
    jaded: 2,
    sharpness: 0,
    trains: true,
    knock: 0.006
  },
  technical: {
    id: "technical",
    label: "Technical",
    blurb: "Ball work: passing, finishing, first touch.",
    condition: -3,
    jaded: 1,
    sharpness: 0,
    trains: true,
    knock: 0.003
  },
  tactical: {
    id: "tactical",
    label: "Tactical",
    blurb: "Shape, pressing triggers, unit work. Sharpens the team, not the legs.",
    condition: -2,
    jaded: 1,
    sharpness: 0,
    trains: true,
    knock: 0.002
  },
  setpieces: {
    id: "setpieces",
    label: "Set pieces",
    blurb: "Drills for corners and free kicks — familiarity is built here.",
    condition: -3,
    jaded: 1,
    sharpness: 0,
    trains: true,
    knock: 0.003
  },
  prep: {
    id: "prep",
    label: "Match prep",
    blurb: "The opponent, the plan, the XI. Light on the legs, sharpens the mind.",
    condition: -1,
    jaded: 1,
    sharpness: 2,
    trains: true,
    knock: 0.001
  },
  travel: { id: "travel", label: "Travel", blurb: "On the road. Nothing gained, a little spent.", condition: -2, jaded: 0, sharpness: 0 },
  match: { id: "match", label: "Match day", blurb: "The only day that counts.", condition: 0, jaded: 0, sharpness: 0 }
};

/** The default week: a normal load that reproduces the old weekly recovery. */
export const DEFAULT_PLAN: Activity[] = [
  "recovery",
  "physical",
  "technical",
  "tactical",
  "prep",
  "match"
];

/** Congestion preset, ready for cup weeks (v0.36): lighter, no heavy day. */
export const CONGESTED_PLAN: Activity[] = [
  "recovery",
  "tactical",
  "technical",
  "recovery",
  "prep",
  "match"
];

export const isActivity = (v: unknown): v is Activity =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(ACTIVITIES, v);

/** Today's activity for a club: match day is forced, otherwise the plan decides. */
export function activityFor(save: SaveGame, day: number, clubId?: string): Activity {
  const d = Math.max(0, Math.min(MATCH_DAY, day));
  if (d === MATCH_DAY) return "match";
  const plan = clubId === undefined || clubId === save.userClubId ? save.weekPlan : undefined;
  const chosen = plan?.[d];
  return isActivity(chosen) ? chosen : DEFAULT_PLAN[d];
}

/** How many of the week's days are real training work. */
export function trainingDays(plan: Activity[]): number {
  return plan.filter((a) => ACTIVITIES[a]?.trains).length;
}

/**
 * Development multiplier for the week. A four-training-day week is the baseline
 * (1.0) so the game does not speed up; slacking off costs growth, overloading
 * buys a little more at a freshness price (paid in the daily tick).
 */
export function planGrowthFactor(plan: Activity[]): number {
  const days = trainingDays(plan);
  if (days <= 0) return 0.45;
  if (days === 1) return 0.6;
  if (days === 2) return 0.75;
  if (days === 3) return 0.9;
  if (days === 4) return 1;
  return 1.1; // 5+ (five training days is already a heavy week on the legs)
}

export interface DayReport {
  day: DayName;
  activity: Activity;
  /** the manager's own squad, only the lines worth reading */
  lines: string[];
  knocks: string[];
}

/**
 * One day passes: apply today's activity to every player, then move the clock on.
 * Pure state — no engine call, no RNG beyond a seeded roll per (player, day).
 */
export function runDay(
  input: SaveGame,
  day: number = input.day ?? 0
): { save: SaveGame; report: DayReport } {
  const save: SaveGame = structuredClone(input);
  const d = Math.max(0, Math.min(MATCH_DAY, day));
  const activity = activityFor(save, d);
  const def = ACTIVITIES[activity];
  const lines: string[] = [];
  const knocks: string[] = [];

  for (const p of save.players) {
    // injured players only get recovery, and they heal a day too
    const injured = p.injuredWeeks > 0;
    if (injured) {
      p.condition = Math.min(100, p.condition + 4);
      p.jaded = Math.max(0, jadedOf(p) - 4);
      continue;
    }
    if (d === MATCH_DAY) {
      // match day's own physical work is done by the match engine; a non-player
      // only gets the freshness of not playing
      p.jaded = Math.max(0, Math.min(100, Math.round(jadedOf(p) - 8)));
      p.sharpness = Math.max(20, Math.min(100, Math.round(sharpnessOf(p) - 3)));
      p.condition = Math.min(100, p.condition + 4);
      continue;
    }
    p.condition = Math.max(5, Math.min(100, p.condition + def.condition));
    p.jaded = Math.max(0, Math.min(100, jadedOf(p) + def.jaded));
    if (def.sharpness !== 0) {
      p.sharpness = Math.max(20, Math.min(100, Math.round(sharpnessOf(p) + def.sharpness)));
    }
    // a training knock, seeded so the same save always breaks the same way
    if (def.trains && def.knock) {
      const rng = mulberry32(hashSeed(save.seed, "dayknock", save.season, save.round, d, p.id));
      const risk = def.knock * (p.condition < 55 ? 2.2 : 1) * (jadedOf(p) > 60 ? 1.5 : 1);
      if (rng() < risk) {
        p.injuredWeeks = 1;
        if (p.clubId === save.userClubId) knocks.push(`${p.name} picked up a knock in training — out for a week.`);
      }
    }
  }

  save.day = d >= MATCH_DAY ? MATCH_DAY : d + 1;
  return {
    save,
    report: { day: DAYS[d], activity, lines, knocks }
  };
}

/** What the week looks like, for the screen: day, activity, and what happens. */
export interface WeekDay {
  day: DayName;
  index: number;
  activity: Activity;
  label: string;
  blurb: string;
  isToday: boolean;
  isMatch: boolean;
}

export function weekView(save: SaveGame, clubId?: string): WeekDay[] {
  const today = Math.min(MATCH_DAY, save.day ?? MATCH_DAY);
  return DAYS.map((day, i) => {
    const activity = activityFor(save, i, clubId);
    const def = ACTIVITIES[activity];
    return {
      day,
      index: i,
      activity,
      label: def.label,
      blurb: def.blurb,
      isToday: i === today,
      isMatch: activity === "match"
    };
  });
}

/** The review the manager reads after the match: what the week cost and gave. */
export interface WeekReview {
  conditionDelta: number;
  trainingDays: number;
  growth: number;
  knocks: number;
}

export function reviewWeek(save: SaveGame, before: SaveGame): WeekReview {
  const inSquad = (s: SaveGame) => s.players.filter((p) => p.clubId === s.userClubId);
  const now = inSquad(save);
  const then = inSquad(before);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const conditionDelta = Math.round(
    avg(now.map((p) => p.condition)) - avg(then.map((p) => p.condition))
  );
  return {
    conditionDelta,
    trainingDays: trainingDays(save.weekPlan ?? DEFAULT_PLAN),
    growth: planGrowthFactor(save.weekPlan ?? DEFAULT_PLAN),
    knocks: now.filter((p) => p.injuredWeeks > 0).length - then.filter((p) => p.injuredWeeks > 0).length
  };
}

