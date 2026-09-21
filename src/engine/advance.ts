import type { Lineup, MatchResult, Player, RoleId, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { autoLineup, fixLineup, isAvailable, squadOf } from "./ratings";
import { builtinFormation, resolveFormation } from "./formations";
import { defaultRoleFor } from "./roles";
import { buildFixtures } from "./league";
import { simulateMatch } from "./match";
import { weeklyRecovery } from "./tuning";

export function seasonRounds(save: Pick<SaveGame, "clubs">): number {
  return (save.clubs.length - 1) * 2;
}

interface Resolved {
  xi: Player[];
  bench: Player[];
  mentality: "def" | "bal" | "att";
  roles: RoleId[];
}

function resolveSide(save: SaveGame, clubId: string): Resolved {
  const club = save.clubs.find((c) => c.id === clubId)!;
  let lineup: Lineup;
  if (clubId === save.userClubId) {
    const def =
      resolveFormation(save.lineup.formation, save.customFormations) ?? builtinFormation("4-3-3");
    lineup = fixLineup(squadOf(save.players, clubId), save.lineup, def);
    save.lineup = lineup; // persist repairs
  } else {
    lineup = autoLineup(squadOf(save.players, clubId), builtinFormation(club.formation));
  }
  const byId = new Map(save.players.map((p) => [p.id, p] as const));
  const xi: Player[] = [];
  const roles: RoleId[] = [];
  lineup.starters.slice(0, 11).forEach((id, i) => {
    const p = id ? byId.get(id) : undefined;
    if (p && isAvailable(p)) {
      xi.push(p);
      roles.push(lineup.roles[i] ?? defaultRoleFor(p.pos));
    }
  });
  const bench = lineup.bench
    .map((id) => (id ? byId.get(id) : undefined))
    .filter((p): p is Player => !!p && isAvailable(p));
  return {
    xi,
    bench,
    mentality: clubId === save.userClubId ? save.lineup.mentality : "bal",
    roles
  };
}

/**
 * Simulate every fixture of the current round, apply the results and player
 * updates, then move to the next round. Pure: returns a new save.
 */
export function playRound(input: SaveGame): { save: SaveGame; userMatch?: MatchResult } {
  const save: SaveGame = structuredClone(input);
  const round = save.round;
  const roundFixtures = save.fixtures.filter((f) => f.round === round && !f.played);
  const results: MatchResult[] = [];
  const playedIds = new Set<string>();

  for (const fx of roundFixtures) {
    const homeClub = save.clubs.find((c) => c.id === fx.homeId)!;
    const awayClub = save.clubs.find((c) => c.id === fx.awayId)!;
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);

    const rng = mulberry32(
      hashSeed(save.seed, "match", save.season, round, fx.homeId, fx.awayId)
    );
    const result = simulateMatch({
      round,
      homeClub,
      awayClub,
      homeXI: home.xi,
      awayXI: away.xi,
      homeBench: home.bench,
      awayBench: away.bench,
      homeMentality: home.mentality,
      awayMentality: away.mentality,
      homeRoles: home.roles,
      awayRoles: away.roles,
      rng
    });

    for (const u of result.updates) {
      const p = save.players.find((pp) => pp.id === u.playerId);
      if (!p) continue;
      if (u.minutes > 0) {
        p.apps++;
        playedIds.add(p.id);
      }
      p.goals += u.goals;
      p.assists += u.assists;
      if (u.red) p.suspension = Math.max(p.suspension, 1);
      if (u.injuredWeeks > 0) p.injuredWeeks = Math.max(p.injuredWeeks, u.injuredWeeks);
      if (u.conditionLoss > 0) {
        p.condition = Math.max(5, Math.round(p.condition - u.conditionLoss));
      }
    }

    fx.played = true;
    fx.homeGoals = result.homeGoals;
    fx.awayGoals = result.awayGoals;
    results.push(result);
  }

  // Between rounds: players who sat out recover / serve bans.
  for (const p of save.players) {
    if (p.injuredWeeks > 0 && !playedIds.has(p.id)) p.injuredWeeks--;
    if (p.suspension > 0 && !playedIds.has(p.id)) p.suspension--;
    p.condition = Math.min(100, p.condition + weeklyRecovery(p));
  }

  save.lastResults = results;
  save.round = round + 1;

  const userFixture = roundFixtures.find(
    (f) => f.homeId === save.userClubId || f.awayId === save.userClubId
  );
  const userMatch = userFixture
    ? results.find(
        (r) => r.fixtureKey === `${round}:${userFixture.homeId}:${userFixture.awayId}`
      )
    : undefined;
  if (userMatch) save.lastUserMatch = userMatch;

  return { save, userMatch };
}

/** Roll the save into the next season: age up, reset status, fresh fixtures. */
export function nextSeason(input: SaveGame): SaveGame {
  const save: SaveGame = structuredClone(input);
  save.season += 1;
  save.round = 1;
  save.fixtures = buildFixtures(save.clubs, save.season, save.seed);
  for (const p of save.players) {
    p.age = Math.min(40, p.age + 1);
    p.condition = 100;
    p.injuredWeeks = 0;
    p.suspension = 0;
    p.apps = 0;
    p.goals = 0;
    p.assists = 0;
  }
  const def =
    resolveFormation(save.lineup.formation, save.customFormations) ?? builtinFormation("4-3-3");
  save.lineup = autoLineup(squadOf(save.players, save.userClubId), def, {
    mentality: save.lineup.mentality
  });
  save.lastResults = [];
  save.lastUserMatch = undefined;
  return save;
}
