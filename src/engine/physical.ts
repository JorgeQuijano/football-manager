import type { Player, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { medicalWeeks } from "./commercial";
import { pushNews } from "./training";

// --- match sharpness ------------------------------------------------------------------
// Sharpness is match fitness: it rises with minutes and falls away when a player sits
// out, and it is NOT the same number as condition (freshness) or in-match legs.

export const SHARP_START = 85;
export const SHARP_NEUTRAL = 85; // at or above this he is match-fit, no penalty
export const SHARP_MIN = 20;

export const sharpnessOf = (p: Player): number => p.sharpness ?? SHARP_START;

/** 1.0 when match-fit; a rusty player loses up to 7% of his finishing/defending/keeping. */
export function sharpnessFactor(p: Player): number {
  const s = sharpnessOf(p);
  if (s >= SHARP_NEUTRAL) return 1;
  const drop = (SHARP_NEUTRAL - s) / (SHARP_NEUTRAL - SHARP_MIN); // 0..1
  return Math.round((1 - 0.07 * Math.min(1, Math.max(0, drop))) * 1000) / 1000;
}

export const sharpBand = (s: number): "match-fit" | "fine" | "rusty" | "cold" =>
  s >= 85 ? "match-fit" : s >= 70 ? "fine" : s >= 50 ? "rusty" : "cold";

/** A round of football: minutes sharpen you, sitting out dulls you. */
export function sharpnessTick(save: SaveGame, minutesById: Record<string, number>): void {
  for (const p of save.players) {
    const mins = minutesById[p.id] ?? 0;
    const s = sharpnessOf(p);
    let next = s;
    if (mins >= 60) next = s + 6;
    else if (mins > 0) next = s + 3;
    else if (p.injuredWeeks > 0) next = s - 4; // injured: rust sets in faster
    else next = s - 3;
    p.sharpness = Math.max(SHARP_MIN, Math.min(100, Math.round(next)));
  }
}

// --- jadedness -------------------------------------------------------------------------
// Accumulated wear from being overplayed. Builds when a tired or older player keeps
// starting, clears with rest, and costs up to 5% in a match (and raises injury risk).

export const jadedOf = (p: Player): number => p.jaded ?? 0;

export function jadedFactor(p: Player): number {
  const j = jadedOf(p);
  if (j <= 35) return 1;
  return 1 - 0.05 * Math.min(1, (j - 35) / 65);
}

export const jadedBand = (j: number): "fresh" | "ok" | "heavy" | "burnt out" =>
  j <= 35 ? "fresh" : j <= 60 ? "ok" : j <= 80 ? "heavy" : "burnt out";

export function jadedTick(save: SaveGame, minutesById: Record<string, number>): void {
  const heavy = save.training?.intensity === "heavy";
  for (const p of save.players) {
    const mins = minutesById[p.id] ?? 0;
    const j = jadedOf(p);
    let next = j;
    if (mins >= 60) {
      // a full game of wear, worse when he is tired, older, or played every week
      const load = (p.condition < 60 ? 1.6 : 1) * (p.age >= 30 ? 1.4 : 1) * (heavy ? 1.15 : 1);
      next = j + 6 * load;
    } else if (mins > 0) {
      next = j + 2.5;
    } else {
      next = j - (p.injuredWeeks > 0 ? 8 : 12); // rest is the cure
    }
    p.jaded = Math.max(0, Math.min(100, Math.round(next)));
  }
}

// --- injuries: kinds, proneness, length -------------------------------------------------

export const INJURY_KINDS: { id: string; label: string; maxWeeks: number }[] = [
  { id: "knock", label: "Knock", maxWeeks: 2 },
  { id: "strain", label: "Muscle strain", maxWeeks: 4 },
  { id: "hamstring", label: "Hamstring", maxWeeks: 6 },
  { id: "ankle", label: "Ankle ligaments", maxWeeks: 8 },
  { id: "break", label: "Broken foot", maxWeeks: 12 }
];

/** What a lay-off of this length reads as. */
export const injuryKindFor = (weeks: number): string =>
  (INJURY_KINDS.find((k) => weeks <= k.maxWeeks) ?? INJURY_KINDS[INJURY_KINDS.length - 1]).label;

export const injuryLine = (p: Player): string | null =>
  p.injuredWeeks > 0 ? `${injuryKindFor(p.injuredWeeks)} · ${p.injuredWeeks}w out` : null;

/** How injury-prone he is: age, build, wear and tear, and rust all add risk. */
export function pronenessOf(p: Player): number {
  const age = p.age >= 33 ? 1.5 : p.age >= 30 ? 1.25 : p.age >= 27 ? 1.05 : 1;
  const build = 1 + Math.max(0, 60 - p.attrs.physical) / 120;
  const wear = 1 + jadedOf(p) / 200;
  const rust = sharpnessOf(p) < 60 ? 1.15 : 1;
  return age * build * wear * rust;
}

// --- international breaks ---------------------------------------------------------------

/** Rounds where the national teams take the best players away midweek. */
export const INTL_ROUNDS = [5, 12];
export const isInternationalRound = (round: number): boolean => INTL_ROUNDS.includes(round);

/**
 * Call-ups: the division's best players (plus one youngster per club tagged as an U21
 * cap) go away and come back with a cap, a little rust knocked off and tired legs.
 */
export function internationalTick(save: SaveGame): string[] {
  if (!isInternationalRound(save.round)) return [];
  const called: string[] = [];
  const rng = mulberry32(hashSeed(save.seed, "intl", save.season, save.round));
  for (const club of save.clubs) {
    const squad = save.players.filter((p) => p.clubId === club.id && p.injuredWeeks === 0 && p.suspension === 0);
    if (!squad.length) continue;
    const best = squad.slice().sort((a, b) => b.attrs.reflexes + b.attrs.shooting + b.attrs.defending + b.attrs.passing - (a.attrs.reflexes + a.attrs.shooting + a.attrs.defending + a.attrs.passing))[0];
    const kid = squad.filter((p) => p.age <= 21 && p.id !== best.id).sort((a, b) => a.age - b.age)[0];
    const picks = [best, kid].filter(Boolean).slice(0, club.id === save.userClubId ? 2 : 1 + (rng() < 0.4 ? 1 : 0));
    for (const p of picks) {
      if (!p) continue;
      p.caps = (p.caps ?? 0) + 1;
      p.condition = Math.max(10, p.condition - 8);
      p.sharpness = Math.min(100, sharpnessOf(p) + 5);
      p.morale = Math.min(100, (p.morale ?? 60) + 3);
      called.push(p.id);
      // the odd knock on international duty
      if (rng() < 0.02 * pronenessOf(p)) {
        p.injuredWeeks = Math.max(
          p.injuredWeeks,
          medicalWeeks(save, p.clubId ?? "", 1 + Math.floor(rng() * 3))
        );
      }
    }
  }
  if (called.length) {
    const mine = called.filter((id) => save.players.find((p) => p.id === id)?.clubId === save.userClubId);
    if (mine.length) {
      const names = mine.map((id) => save.players.find((p) => p.id === id)!.name).join(", ");
      pushNews(save, `International week: ${names} away on duty — they return with tired legs.`);
    }
  }
  return called;
}
