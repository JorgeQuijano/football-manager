import type { Lineup, MatchResult, Player, Position, RoleId, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { autoLineup, fixLineup, isAvailable, squadOf } from "./ratings";
import { builtinFormation, resolveFormation } from "./formations";
import { defaultRoleFor } from "./roles";
import { buildFixtures } from "./league";
import { simulateMatch } from "./match";
import { weeklyRecovery } from "./tuning";
import { TF, freshFinances, makeFreeAgent, rollContracts, windowTick } from "./transfers";
import { INTENSITIES, developRound, learnTraits, resetSeasonDev, youthIntake } from "./training";
import { growFamiliarity, planForClub } from "./setpieces";
import { recordMatch } from "./stats";
import { scoutingBudgetFor, scoutingTick } from "./scouting";
import { payPrize, recordSeason, roundAwards } from "./history";
import { moraleTick, MORALE_START } from "./morale";
import { conditionsFor } from "./conditions";

export function seasonRounds(save: Pick<SaveGame, "clubs">): number {
  return (save.clubs.length - 1) * 2;
}

export interface Resolved {
  xi: Player[];
  bench: Player[];
  mentality: "def" | "bal" | "att";
  roles: RoleId[];
  coords: [number, number][];
  poss: Position[];
}

export function resolveSide(save: SaveGame, clubId: string): Resolved {
  const club = save.clubs.find((c) => c.id === clubId)!;
  let lineup: Lineup;
  let def = builtinFormation(club.formation);
  if (clubId === save.userClubId) {
    def = resolveFormation(save.lineup.formation, save.customFormations) ?? builtinFormation("4-3-3");
    lineup = fixLineup(squadOf(save.players, clubId), save.lineup, def);
    save.lineup = lineup; // persist repairs
  } else {
    lineup = autoLineup(squadOf(save.players, clubId), def);
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
    roles,
    coords: def.slots.map((s) => [s.x, s.y] as [number, number]),
    poss: def.slots.map((s) => s.pos)
  };
}

const matchInputs = (save: SaveGame, round: number, homeId: string, awayId: string) => {
  const home = resolveSide(save, homeId);
  const away = resolveSide(save, awayId);
  const rng = mulberry32(hashSeed(save.seed, "match", save.season, round, homeId, awayId));
  return {
    round,
    homeClub: save.clubs.find((c) => c.id === homeId)!,
    awayClub: save.clubs.find((c) => c.id === awayId)!,
    homeXI: home.xi,
    awayXI: away.xi,
    homeBench: home.bench,
    awayBench: away.bench,
    homeMentality: home.mentality,
    awayMentality: away.mentality,
    homeRoles: home.roles,
    awayRoles: away.roles,
    homeCoords: home.coords,
    awayCoords: away.coords,
    homePoss: home.poss,
    awayPoss: away.poss,
    homePlan: planForClub(save, homeId),
    awayPlan: planForClub(save, awayId),
    conditions: conditionsFor(save, round),
    rng
  };
};

const applyResult = (
  save: SaveGame,
  result: MatchResult,
  playedIds: Set<string>
): void => {
  const home = save.clubs.find((c) => c.id === result.homeId);
  const away = save.clubs.find((c) => c.id === result.awayId);
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
    // stats: minutes, cards, rating → form, and the match log for your own players
    const isHome = p.clubId === result.homeId;
    recordMatch(p, u, {
      season: save.season,
      round: result.round,
      opp: (isHome ? away : home)?.short ?? "?",
      home: isHome,
      rating: result.ratings[u.playerId],
      userClub: p.clubId === save.userClubId
    });
  }
};

/**
 * Simulate every non-user fixture of the current round and apply their results.
 * The user's fixture is left unplayed (it becomes a live match).
 */
export function prepareRound(input: SaveGame): SaveGame {
  const save: SaveGame = structuredClone(input);
  const round = save.round;
  const results: MatchResult[] = [];
  const playedIds = new Set<string>();

  for (const fx of save.fixtures) {
    if (fx.round !== round || fx.played) continue;
    if (fx.homeId === save.userClubId || fx.awayId === save.userClubId) continue;
    const result = simulateMatch(matchInputs(save, round, fx.homeId, fx.awayId));
    applyResult(save, result, playedIds);
    fx.played = true;
    fx.homeGoals = result.homeGoals;
    fx.awayGoals = result.awayGoals;
    results.push(result);
  }

  save.lastResults = results;
  return save;
}

/** Apply the user's finished match, run between-rounds recovery and advance the round. */
export function completeRound(input: SaveGame, userResult?: MatchResult): SaveGame {
  const save: SaveGame = structuredClone(input);
  const round = save.round;

  const playedIds = new Set<string>();
  for (const r of save.lastResults) {
    for (const u of r.updates) if (u.minutes > 0) playedIds.add(u.playerId);
  }

  if (userResult) {
    applyResult(save, userResult, playedIds);
    const fx = save.fixtures.find(
      (f) =>
        f.round === round &&
        f.homeId === userResult.homeId &&
        f.awayId === userResult.awayId &&
        !f.played
    );
    if (fx) {
      fx.played = true;
      fx.homeGoals = userResult.homeGoals;
      fx.awayGoals = userResult.awayGoals;
    }
    save.lastResults = [...save.lastResults, userResult];
    save.lastUserMatch = userResult;
  }

  save.live = undefined;

  // awards & records for this round: player of the round, biggest win
  roundAwards(save);
  // morale: minutes, results, wages, contracts, form → mood (+ transfer requests)
  moraleTick(save, save.lastResults);
  const mine = save.lastResults.find((r) => r.homeId === save.userClubId || r.awayId === save.userClubId);
  if (mine) {
    const h = mine.homeId === save.userClubId;
    save.recentResults = [
      {
        season: save.season,
        round: mine.round,
        oppId: h ? mine.awayId : mine.homeId,
        h,
        gf: h ? mine.homeGoals : mine.awayGoals,
        ga: h ? mine.awayGoals : mine.homeGoals
      },
      ...(save.recentResults ?? [])
    ].slice(0, 8);
  }

  // Between rounds: players who sat out recover / serve bans.
  const intensityRec = INTENSITIES[(save.training?.intensity ?? "normal") as keyof typeof INTENSITIES].recovery;
  for (const p of save.players) {
    if (p.injuredWeeks > 0 && !playedIds.has(p.id)) p.injuredWeeks--;
    if (p.suspension > 0 && !playedIds.has(p.id)) p.suspension--;
    const rec = weeklyRecovery(p) * (p.clubId === save.userClubId ? intensityRec : 1);
    p.condition = Math.min(100, p.condition + rec);
  }

  // Training: every player develops a little each round (age × minutes × focus × intensity).
  const minutesById: Record<string, number> = {};
  for (const r of save.lastResults)
    for (const u of r.updates) minutesById[u.playerId] = (minutesById[u.playerId] ?? 0) + u.minutes;
  const withDev = developRound(save, minutesById);
  growFamiliarity(withDev); // set-piece routines get groovier every round
  scoutingTick(withDev); // scouts work their assignments (knowledge, discovery, decay)

  // Transfer activity for this round while a window is open (AI churn + bids for you).
  const withTransfers = windowTick(withDev);
  withTransfers.round = round + 1;
  return withTransfers;
}

/**
 * Simulate every fixture of the current round (including the user's, one-shot) and
 * advance. Kept for tests, tooling and the instant-sim path.
 */
export function playRound(input: SaveGame): { save: SaveGame; userMatch?: MatchResult } {
  const prepared = prepareRound(input);
  const round = prepared.round;
  const userFx = prepared.fixtures.find(
    (f) =>
      f.round === round &&
      !f.played &&
      (f.homeId === prepared.userClubId || f.awayId === prepared.userClubId)
  );
  let userResult: MatchResult | undefined;
  if (userFx) {
    const inp = matchInputs(prepared, round, userFx.homeId, userFx.awayId);
    userResult = simulateMatch({
      ...inp,
      userSide: userFx.homeId === prepared.userClubId ? "home" : "away"
    });
  }
  const save = completeRound(prepared, userResult);
  return { save, userMatch: userResult };
}

/** Roll the save into the next season: age up, contracts, fresh fixtures & budgets. */
export function nextSeason(input: SaveGame): SaveGame {
  const save: SaveGame = structuredClone(input);
  // remember the season that just finished (career totals, records, awards) — before
  // retirements remove players and before the season counters reset
  recordSeason(save);
  save.season += 1;
  save.round = 1;
  save.live = undefined;
  save.offers = [];
  save.pending = undefined;
  save.fixtures = buildFixtures(save.clubs, save.season, save.seed);
  // season-end: trait learning reads last season's minutes; then reset trackers + intake
  learnTraits(save);
  resetSeasonDev(save);
  for (const p of save.players) {
    p.age = Math.min(40, p.age + 1);
    p.condition = 100;
    p.injuredWeeks = 0;
    p.suspension = 0;
    // pre-season: a clean slate — mood drifts back toward neutral, minutes window resets
    p.morale = Math.round(MORALE_START + ((p.morale ?? MORALE_START) - MORALE_START) * 0.5);
    p.recentMin = [];
    p.unhappyRounds = 0;
    p.apps = 0;
    p.goals = 0;
    p.assists = 0;
    // season stats reset (the recent-match log survives across seasons)
    p.mins = 0;
    p.yellows = 0;
    p.reds = 0;
    p.ratingSum = 0;
    p.ratingCount = 0;
    p.form = [];
  }
  // contracts: expiries leave (AI clubs re-sign most), then a fresh free-agent intake
  rollContracts(save);
  for (let i = 0; i < TF.freeAgentsPerSeason; i++) {
    const id = `pfree-${save.season}-${i}`;
    if (!save.players.some((p) => p.id === id)) save.players.push(makeFreeAgent(save.season, i));
  }
  // academy intake: a kid for your first team, one or two for every AI club
  youthIntake(save);
  save.finances = freshFinances(save);
  // prize money for last season's finish lands with the new budgets
  payPrize(save);
  // fresh scouting budget for the season
  save.scouting.budget = scoutingBudgetFor(save.finances[save.userClubId]?.transfer ?? 1_000_000);
  const def =
    resolveFormation(save.lineup.formation, save.customFormations) ?? builtinFormation("4-3-3");
  save.lineup = autoLineup(squadOf(save.players, save.userClubId), def, {
    mentality: save.lineup.mentality
  });
  save.lastResults = [];
  save.lastUserMatch = undefined;
  return save;
}
