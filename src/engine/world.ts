import type { Club, Fixture, Player, Position, SaveGame, TableRow, WorldLeague } from "./types";
import { NATIONS, type NationId } from "./nations";
import { makePlayer } from "./generate";
import { hashSeed, mulberry32 } from "./rng";
import { overallFor } from "./ratings";
import { buildFixtures } from "./league";
import { computeTable } from "./league";

/**
 * The world outside your league (v0.38).
 *
 * `save.clubs` / `save.players` remain **your** league: the full engine runs on
 * it, the cup lives in it, the media talk about it, records are kept in it. The
 * other nations' leagues live in `save.world` with real clubs and real squads —
 * they are browsable, scoutable and signable — but their matches are resolved by
 * a **light model** (squad power → a seeded scoreline) instead of the minute-by-
 * minute engine. That keeps a four-league world at roughly the cost of one.
 *
 * Everything here is deterministic: seeds come from the save seed, the season,
 * the round and the fixture, so the same save always produces the same Europe.
 */

/** How strong a club is right now: the average of its best eleven. */
export function clubPower(players: Player[], clubId: string): number {
  const squad = players.filter((p) => p.clubId === clubId);
  if (!squad.length) return 50;
  const eleven = [...squad].sort((a, b) => overallFor(b) - overallFor(a)).slice(0, 11);
  return eleven.reduce((n, p) => n + overallFor(p), 0) / eleven.length;
}

/** A seeded Poisson draw — the workhorse of a cheap scoreline. */
function poisson(rng: () => number, lambda: number): number {
  const L = Math.exp(-Math.max(0.05, lambda));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 12);
  return k - 1;
}

/** Expected goals for one side of a light match. */
function xgFor(mine: number, theirs: number, atHome: boolean): number {
  const edge = (mine - theirs) / 26; // a 13-point squad difference ≈ half a goal a game
  return Math.max(0.18, 1.32 * (1 + edge) * (atHome ? 1.12 : 0.92));
}

export interface WorldRoundResult {
  round: number;
  fixtures: Fixture[];
}

/**
 * Play one league's round: every fixture, cheaply, with the goals credited to
 * plausible scorers so the foreign scoring charts are real people.
 */
export function playWorldRound(save: SaveGame, w: WorldLeague, round: number): void {
  const fixtures = w.fixtures.filter((f) => f.round === round && !f.played);
  if (!fixtures.length) return;
  const power = w.power ?? (w.power = {});
  const playersByClub = new Map<string, Player[]>();
  for (const p of w.players) {
    const list = playersByClub.get(p.clubId);
    if (list) list.push(p);
    else playersByClub.set(p.clubId, [p]);
  }
  const strength = (clubId: string): number => {
    if (power[clubId] === undefined) power[clubId] = clubPower(w.players, clubId);
    return power[clubId];
  };

  for (const f of fixtures) {
    const rng = mulberry32(hashSeed(save.seed, "world", w.id, save.season, round, f.homeId, f.awayId));
    const home = strength(f.homeId);
    const away = strength(f.awayId);
    f.homeGoals = poisson(rng, xgFor(home, away, true));
    f.awayGoals = poisson(rng, xgFor(away, home, false));
    f.played = true;

    // scorers and legs
    for (const clubId of [f.homeId, f.awayId]) {
      const squad = playersByClub.get(clubId) ?? [];
      const scored = clubId === f.homeId ? f.homeGoals! : f.awayGoals!;
      // everyone who features gets an appearance and pays for it
      for (const p of squad) {
        p.apps++;
        p.condition = Math.max(55, Math.round(p.condition - 12));
        p.jaded = Math.min(100, (p.jaded ?? 0) + 5);
        p.sharpness = Math.min(100, (p.sharpness ?? 70) + 5);
      }
      // goals go to the men who'd score them
      const attackers = squad.filter((p) => p.pos !== "GK");
      if (attackers.length) {
        const weights = attackers.map((p) =>
          (p.pos === "FW" ? 4 : p.pos === "MF" ? 2.2 : 0.7) * (p.attrs.shooting + 20)
        );
        for (let g = 0; g < scored; g++) {
          const pick = weightedPick(rng, attackers, weights);
          if (!pick) break;
          pick.goals++;
          if (rng() < 0.55) {
            const assister = weightedPick(
              rng,
              attackers.filter((x) => x.id !== pick.id),
              attackers.filter((x) => x.id !== pick.id).map((x) => x.attrs.passing + 25)
            );
            if (assister) assister.assists++;
          }
        }
      }
    }
  }
}

function weightedPick<T>(rng: () => number, items: T[], weights: number[]): T | undefined {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (!items.length || total <= 0) return undefined;
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= Math.max(0, weights[i]);
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Two matches a week across Europe: play every world league's round. */
export function tickWorld(save: SaveGame, round: number): void {
  for (const w of save.world ?? []) playWorldRound(save, w, round);
}

/** New season abroad: fresh fixtures, fresh legs, counters back to zero. */
export function worldSeasonRollover(save: SaveGame): void {
  for (const w of save.world ?? []) {
    w.fixtures = buildFixtures(w.clubs, save.season, save.seed);
    w.power = {};
    for (const p of w.players) {
      p.age += 1;
      p.apps = 0;
      p.goals = 0;
      p.assists = 0;
      p.yellows = 0;
      p.reds = 0;
      p.mins = 0;
      p.condition = 100;
      p.jaded = 0;
      p.sharpness = 85;
    }
  }
}

/** A world league's table. */
export function worldTable(w: WorldLeague): TableRow[] {
  return computeTable(w.fixtures, w.clubs);
}

/** A world league's scoring chart. */
export function worldScorers(w: WorldLeague, limit = 15): Player[] {
  return [...w.players]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || (a.name < b.name ? -1 : 1))
    .slice(0, limit);
}

/** Everyone outside your league — the market the scouts travel to. */
export function worldPlayers(save: SaveGame): Player[] {
  return (save.world ?? []).flatMap((w) => w.players);
}

/** Every player in the world, yours first. */
export function allPlayers(save: SaveGame): Player[] {
  return [...save.players, ...worldPlayers(save)];
}

/** Find a player anywhere on the continent. */
export function playerAnywhere(save: SaveGame, id: string): Player | undefined {
  return save.players.find((p) => p.id === id) ?? worldPlayers(save).find((p) => p.id === id);
}

/** Which league is a club in? (for a player's card, a search result, a transfer) */
export function leagueOfClub(
  save: SaveGame,
  clubId: string
): { id: NationId; name: string; country: string } | undefined {
  if (save.clubs.some((c) => c.id === clubId)) {
    return {
      id: (save.nation ?? "eng") as NationId,
      name: save.leagueName ?? "League One",
      country: save.country ?? "England"
    };
  }
  for (const w of save.world ?? []) {
    if (w.clubs.some((c) => c.id === clubId)) return { id: w.id as NationId, name: w.name, country: w.country };
  }
  return undefined;
}

/** A one-line picture of the continent, for the Home screen. */
export function worldBrief(
  save: SaveGame
): Array<{ id: NationId; country: string; league: string; leader: string; pts: number }> {
  return (save.world ?? []).map((w) => {
    const table = worldTable(w);
    const top = table[0];
    const club = w.clubs.find((c) => c.id === top?.clubId);
    return { id: w.id as NationId, country: w.country, league: w.name, leader: club?.name ?? "—", pts: top?.pts ?? 0 };
  });
}

/** Build a world league's fixtures for a season (same generator as yours). */
export function worldFixtures(clubs: Club[], season: number, seed: number): Fixture[] {
  return buildFixtures(clubs, season, seed);
}

/* ------------------------------------------------------------------ *
 * Across the water (v0.43): the continent as a place you can do business
 * ------------------------------------------------------------------ */

/** A squad abroad is kept at least this deep, so the light model always has an XI. */
export const WORLD_MIN_SQUAD = 16;

/** Find a club anywhere on the continent, with its league. */
export function clubAnywhere(
  save: SaveGame,
  clubId: string
): { club: Club; league: { id: string; name: string; country: string }; foreign: boolean } | undefined {
  const home = save.clubs.find((c) => c.id === clubId);
  if (home) {
    return {
      club: home,
      league: { id: save.nation ?? "eng", name: save.leagueName ?? "League One", country: save.country ?? "England" },
      foreign: false
    };
  }
  const w = findWorldClub(save, clubId);
  return w ? { club: w.club, league: { id: w.w.id, name: w.w.name, country: w.w.country }, foreign: true } : undefined;
}

/** The world league (and club) a club id belongs to, if it is abroad. */
export function findWorldClub(
  save: SaveGame,
  clubId: string
): { w: WorldLeague; club: Club } | undefined {
  for (const w of save.world ?? []) {
    const club = w.clubs.find((c) => c.id === clubId);
    if (club) return { w, club };
  }
  return undefined;
}

/** A club's squad, wherever the club lives. */
export function squadAnywhere(save: SaveGame, clubId: string): Player[] {
  if (save.clubs.some((c) => c.id === clubId)) return save.players.filter((p) => p.clubId === clubId);
  const w = findWorldClub(save, clubId);
  return w ? w.w.players.filter((p) => p.clubId === clubId) : [];
}

/** Take a player out of the continent (he is coming home with you). */
export function removeFromWorld(save: SaveGame, playerId: string): Player | undefined {
  for (const w of save.world ?? []) {
    const i = w.players.findIndex((p) => p.id === playerId);
    if (i >= 0) {
      const [p] = w.players.splice(i, 1);
      w.power = {}; // the squad changed: clubPower must be recomputed
      return p;
    }
  }
  return undefined;
}

/** Move a player abroad (he is leaving your league). */
export function addToWorld(save: SaveGame, player: Player, clubId: string): boolean {
  const w = findWorldClub(save, clubId);
  if (!w) return false;
  player.clubId = clubId;
  w.w.players.push(player);
  w.w.power = {};
  return true;
}

/**
 * Keep every squad abroad resolvable. Selling a star to nobody is how a
 * continent rots: any club under WORLD_MIN_SQUAD gets a young local — derived
 * from the club's own nation pools, on a stream of its own so no existing
 * world, fixture or golden value moves.
 */
export function worldTopUp(save: SaveGame, onlyClubId?: string): void {
  for (const w of save.world ?? []) {
    const nation = NATIONS.find((n) => n.id === w.id);
    const needs = w.clubs
      .filter((c) => !onlyClubId || c.id === onlyClubId)
      .map((c) => ({ club: c, have: w.players.filter((p) => p.clubId === c.id).length }))
      .filter((x) => x.have < WORLD_MIN_SQUAD);
    for (const { club, have } of needs) {
      for (let slot = have, n = 0; slot < WORLD_MIN_SQUAD; slot++, n++) {
        const pos = (["GK", "DF", "DF", "MF", "MF", "FW"] as Position[])[n % 6];
        const rng = mulberry32(hashSeed(save.seed, "worldregen", club.id, save.season, slot));
        const p = makePlayer(rng, club.id, 100 + slot, pos, club.strength - 2, {
          first: nation?.first ?? [],
          last: nation?.last ?? []
        });
        p.age = 17 + Math.floor(rng() * 4);
        w.players.push(p);
      }
      w.power = {};
    }
  }
}

/** Everyone abroad, for a screen that wants to browse the continent. */
export function worldClubs(save: SaveGame): Array<{ id: string; name: string; country: string; clubs: Club[] }> {
  return (save.world ?? []).map((w) => ({ id: w.id, name: w.name, country: w.country, clubs: w.clubs }));
}
