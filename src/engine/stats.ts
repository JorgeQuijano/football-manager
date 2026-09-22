import type { Player, PlayerUpdate, SaveGame, Position } from "./types";

/** Form bands (average of the last few ratings) with display tints. */
export type FormBand = "brilliant" | "good" | "average" | "poor";

export const FORM_BANDS: Record<FormBand, { label: string; tint: string; min: number }> = {
  brilliant: { label: "Brilliant", tint: "#2ED573", min: 7.5 },
  good: { label: "Good", tint: "#7BE495", min: 6.7 },
  average: { label: "Average", tint: "#FFB020", min: 5.9 },
  poor: { label: "Poor", tint: "#FF6B6B", min: 0 }
};

export const formBandFor = (f: number): FormBand =>
  f >= FORM_BANDS.brilliant.min
    ? "brilliant"
    : f >= FORM_BANDS.good.min
      ? "good"
      : f >= FORM_BANDS.average.min
        ? "average"
        : "poor";

/** Average of the last up-to-6 match ratings (null = no appearances yet). */
export function formOf(p: Player): number | null {
  const f = p.form ?? [];
  if (!f.length) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

/** Season average rating (null = no rated appearances). */
export function ratingAvg(p: Player): number | null {
  const n = p.ratingCount ?? 0;
  return n > 0 ? (p.ratingSum ?? 0) / n : null;
}

export const rating1 = (v: number | null): string => (v === null ? "—" : v.toFixed(1));

/** Everything a match result needs to update a player's record. */
export interface MatchStatCtx {
  season: number;
  round: number;
  opp: string; // opponent short name
  home: boolean;
  rating: number | undefined;
  userClub: boolean; // store the per-match log line
}

/** Fold one match's update into a player's season stats, form and match log. */
/** Push a fresh rating onto the form guide (last 6, newest first). */
export function recordForm(p: Player, rating: number): void {
  p.form = [rating, ...(p.form ?? [])].slice(0, 6);
  p.formMiss = 0;
}

/**
 * How hot he is: the average of his recent ratings against 6.5 (the neutral mark),
 * worth up to ±4% in a match. Neutral until he has at least two ratings behind him.
 */
export function formFactor(p: Player): number {
  const f = p.form ?? [];
  if (f.length < 2) return 1;
  const avg = formOf(p) ?? 6.5;
  return Math.round(Math.max(0.96, Math.min(1.04, 1 + (avg - 6.5) * 0.012)) * 1000) / 1000;
}

export const formHotter = (a: Player, b: Player): number => (formOf(b) ?? 6.5) - (formOf(a) ?? 6.5);

export function recordMatch(p: Player, u: PlayerUpdate, ctx: MatchStatCtx): void {
  p.mins = (p.mins ?? 0) + u.minutes;
  p.yellows = (p.yellows ?? 0) + (u.yellow ?? 0);
  p.reds = (p.reds ?? 0) + (u.red ? 1 : 0);
  const rt = ctx.rating;
  if (u.minutes > 0 && typeof rt === "number" && Number.isFinite(rt)) {
    p.ratingSum = (p.ratingSum ?? 0) + rt;
    p.ratingCount = (p.ratingCount ?? 0) + 1;
    recordForm(p, rt);
  }
  if (ctx.userClub) {
    p.history = [
      { se: ctx.season, r: ctx.round, opp: ctx.opp, h: ctx.home, rt: rt ?? 0, m: u.minutes, g: u.goals, a: u.assists },
      ...(p.history ?? [])
    ].slice(0, 10);
  }
}

export type SortMode = "position" | "form" | "rating" | "goals" | "assists" | "minutes";

export const SORT_MODES: Array<{ id: SortMode; label: string }> = [
  { id: "position", label: "Position" },
  { id: "form", label: "Form (last games)" },
  { id: "rating", label: "Average rating" },
  { id: "goals", label: "Goals" },
  { id: "assists", label: "Assists" },
  { id: "minutes", label: "Minutes played" }
];

const POS_ORDER: Position[] = ["GK", "DF", "MF", "FW"];

/** Sort a squad for the roster list. Missing form/ratings always sink to the bottom. */
export function sortSquad(players: Player[], mode: SortMode, overall: (p: Player) => number): Player[] {
  const arr = players.slice();
  const byOverall = (a: Player, b: Player) => overall(b) - overall(a);
  switch (mode) {
    case "position":
      arr.sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || byOverall(a, b));
      break;
    case "form":
      arr.sort((a, b) => {
        const fa = formOf(a);
        const fb = formOf(b);
        if (fa === null && fb === null) return byOverall(a, b);
        if (fa === null) return 1;
        if (fb === null) return -1;
        return fb - fa || byOverall(a, b);
      });
      break;
    case "rating":
      arr.sort((a, b) => {
        const ra = ratingAvg(a);
        const rb = ratingAvg(b);
        if (ra === null && rb === null) return byOverall(a, b);
        if (ra === null) return 1;
        if (rb === null) return -1;
        return rb - ra || byOverall(a, b);
      });
      break;
    case "goals":
      arr.sort((a, b) => b.goals - a.goals || byOverall(a, b));
      break;
    case "assists":
      arr.sort((a, b) => b.assists - a.assists || byOverall(a, b));
      break;
    case "minutes":
      arr.sort((a, b) => (b.mins ?? 0) - (a.mins ?? 0) || byOverall(a, b));
      break;
  }
  return arr;
}

/** A round without football dulls the streak: three weeks out and it's gone. */
export function formFreshnessTick(save: SaveGame, playedIds: Set<string>): void {
  for (const p of save.players) {
    if (playedIds.has(p.id)) {
      p.formMiss = 0;
      continue;
    }
    const miss = (p.formMiss ?? 0) + 1;
    p.formMiss = miss;
    if (miss >= 3 && (p.form ?? []).length > 0) p.form = [];
  }
}
