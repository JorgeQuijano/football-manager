import type { Club, Fixture, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";

/**
 * Pre-season (v0.27): three friendlies on the three Saturdays before the opener.
 * They sharpen legs and build form, never the table.
 */

export const PRE_ROUNDS = [-3, -2, -1];

export const isFriendlyRound = (round: number): boolean => round < 0;

/** Three opponents for the summer: nobody from your own club, alternating home and away. */
export function makeFriendlies(
  save: Pick<SaveGame, "seed" | "clubs" | "userClubId">,
  season: number
): Fixture[] {
  const others = save.clubs.filter((c) => c.id !== save.userClubId);
  if (!others.length) return [];
  const rng = mulberry32(hashSeed(save.seed, "friendlies", season));
  const picked: Club[] = [];
  const pool = others.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  while (picked.length < Math.min(3, pool.length)) {
    const c = pool[Math.floor(rng() * pool.length)];
    if (!picked.some((x) => x.id === c.id)) picked.push(c);
  }
  return PRE_ROUNDS.map((round, i) => {
    const opp = picked[i % picked.length];
    const home = i % 2 === 0;
    return {
      round,
      friendly: true,
      homeId: home ? save.userClubId : opp.id,
      awayId: home ? opp.id : save.userClubId,
      played: false
    };
  });
}

/** How the pre-season is going: which friendly is next, and are we done? */
export function preseasonState(save: SaveGame): { total: number; played: number; next?: Fixture; done: boolean } {
  const list = save.fixtures.filter((f) => f.friendly).sort((a, b) => a.round - b.round);
  const played = list.filter((f) => f.played).length;
  return { total: list.length, played, next: list.find((f) => !f.played), done: played >= list.length };
}
