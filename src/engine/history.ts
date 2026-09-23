import type {
  AwardState,
  ClubTotals,
  HistoryState,
  Player,
  Position,
  RecordEntry,
  RoundAward,
  SaveGame,
  SeasonRecord,
  WinRecord
} from "./types";
import { computeTable } from "./league";
import { pushNews } from "./training";

/** Prize money by final league position (1st → 8m … 10th → 700k). */
export const PRIZE_MONEY = [
  8_000_000, 5_000_000, 3_600_000, 2_800_000, 2_200_000, 1_800_000, 1_400_000, 1_100_000, 900_000, 700_000,
  560_000, 460_000, 380_000, 320_000, 270_000, 230_000, 200_000, 175_000, 155_000, 140_000
];

export const prizeFor = (position: number): number =>
  PRIZE_MONEY[Math.min(Math.max(1, position), PRIZE_MONEY.length) - 1];

/** how many clubs the league has (the season length is 2n-2) */
const clubsIn = (save: SaveGame): number => save.clubs?.length ?? 10;

/** Team of the Season shape (4-3-3). */
export const TOTS_SHAPE: Position[] = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];

/** Minimum league appearances for end-of-season awards. */
export const AWARD_MIN_APPS = 8;
/** Awards want half a season of football — 8 apps was half of eighteen rounds (v0.37) */
export const awardMinApps = (seasonRounds: number): number => Math.max(AWARD_MIN_APPS, Math.round(seasonRounds / 2));
/** Minimum minutes in a match to be eligible for Player of the Round. */
export const POTR_MIN_MINUTES = 45;

export const emptyHistory = (): HistoryState => ({
  seasons: [],
  titles: 0,
  allTime: {
    topScorer: null,
    mostApps: null,
    bestSeasonGoals: null,
    bestSeasonRating: null,
    biggestWin: null
  }
});

export const emptyAwards = (): AwardState => ({ rounds: [], bestWin: null });

/** Career totals for a player across every club he has played for (league matches only). */
export const careerTotals = (p: Player): ClubTotals => {
  const acc: ClubTotals = { apps: 0, goals: 0, assists: 0 };
  for (const t of Object.values(p.totals ?? {})) {
    acc.apps += t.apps;
    acc.goals += t.goals;
    acc.assists += t.assists;
  }
  return acc;
};

/** Totals for one club (club record books / the player sheet). */
export const totalsFor = (p: Player, clubId: string): ClubTotals =>
  (p.totals ?? {})[clubId] ?? { apps: 0, goals: 0, assists: 0 };

const marginOf = (w: WinRecord): number => Math.abs(w.hs - w.as);

/**
 * Per-round bookkeeping (called from `completeRound` once the round's results are final):
 * Player of the Round + the biggest-win tracker. Deterministic — first best wins ties.
 */
export function roundAwards(save: SaveGame): void {
  const awards = save.awards;
  if (!awards || !save.history) return;

  let best: { pid: string; rt: number } | null = null;
  for (const r of save.lastResults) {
    for (const [pid, rt] of Object.entries(r.ratings)) {
      const u = r.updates.find((x) => x.playerId === pid);
      if (!u || u.minutes < POTR_MIN_MINUTES) continue;
      if (typeof rt !== "number" || !Number.isFinite(rt)) continue;
      if (!best || rt > best.rt) best = { pid, rt };
    }
    const margin = Math.abs(r.homeGoals - r.awayGoals);
    const win: WinRecord = {
      homeId: r.homeId,
      awayId: r.awayId,
      hs: r.homeGoals,
      as: r.awayGoals,
      season: save.season,
      round: r.round
    };
    if (!awards.bestWin || margin > marginOf(awards.bestWin)) awards.bestWin = win;
    const all = save.history.allTime.biggestWin;
    if (!all || margin > marginOf(all)) save.history.allTime.biggestWin = win;
  }

  if (best) {
    const p = save.players.find((x) => x.id === (best as { pid: string }).pid);
    if (p) {
      const entry: RoundAward = {
        season: save.season,
        round: save.round,
        playerId: p.id,
        name: p.name,
        clubId: p.clubId,
        pos: p.pos,
        rating: best.rt
      };
      const head = awards.rounds[0];
      if (head && head.season === save.season && head.round === save.round) awards.rounds[0] = entry;
      else awards.rounds.unshift(entry);
      awards.rounds = awards.rounds.slice(0, Math.max(18, save.clubs.length * 2 - 2));
    }
  }
}

/**
 * Season rollover bookkeeping. MUST run at the very start of `nextSeason`, before
 * retirements remove players and before the season counters are reset.
 */
export function recordSeason(save: SaveGame): void {
  const h = save.history;
  if (!h) return;

  // 1. fold this season's counters into per-club career totals (contributors only — keeps saves small)
  for (const p of save.players) {
    if (!p.clubId || (p.apps === 0 && p.goals === 0 && p.assists === 0)) continue;
    p.totals = p.totals ?? {};
    const t = p.totals[p.clubId] ?? { apps: 0, goals: 0, assists: 0 };
    t.apps += p.apps;
    t.goals += p.goals;
    t.assists += p.assists;
    p.totals[p.clubId] = t;
  }

  const table = computeTable(save.fixtures, save.clubs);
  const champ = table[0];
  const runner = table[1];
  const userRow = table.find((r) => r.clubId === save.userClubId) ?? table[table.length - 1];
  const nameOf = (id: string) => save.clubs.find((c) => c.id === id)?.name ?? "?";

  // 2. league-wide season awards
  const topScorerRow = [...save.players]
    .filter((p) => p.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || (a.id < b.id ? -1 : 1))[0];

  const rated = [...save.players]
    .filter((p) => p.apps >= awardMinApps(clubsIn(save) * 2 - 2) && (p.ratingCount ?? 0) > 0)
    .map((p) => ({ p, avg: (p.ratingSum ?? 0) / (p.ratingCount ?? 1) }))
    .sort((a, b) => b.avg - a.avg || b.p.apps - a.p.apps || (a.p.id < b.p.id ? -1 : 1));

  const poty = rated[0];
  const used = new Set<string>();
  const tots: SeasonRecord["teamOfSeason"] = [];
  for (const pos of TOTS_SHAPE) {
    const pick = rated.find((e) => !used.has(e.p.id) && e.p.pos === pos);
    if (pick) {
      used.add(pick.p.id);
      tots.push({ playerId: pick.p.id, name: pick.p.name, pos, clubId: pick.p.clubId });
    }
  }

  const rec: SeasonRecord = {
    season: save.season,
    champion: {
      clubId: champ.clubId,
      name: nameOf(champ.clubId),
      points: champ.pts,
      gf: champ.gf,
      ga: champ.ga
    },
    runnerUp: { clubId: runner?.clubId ?? "", name: runner ? nameOf(runner.clubId) : "", points: runner?.pts ?? 0 },
    user: {
      pos: userRow.position,
      pts: userRow.pts,
      w: userRow.w,
      d: userRow.d,
      l: userRow.l,
      prize: prizeFor(userRow.position)
    },
    topScorer: topScorerRow
      ? { playerId: topScorerRow.id, name: topScorerRow.name, clubId: topScorerRow.clubId, goals: topScorerRow.goals }
      : null,
    playerOfSeason: poty
      ? { playerId: poty.p.id, name: poty.p.name, clubId: poty.p.clubId, rating: poty.avg, apps: poty.p.apps }
      : null,
    teamOfSeason: tots,
    biggestWin: save.awards?.bestWin ?? null
  };
  h.seasons.push(rec);

  // 3. titles
  if (champ.clubId === save.userClubId) h.titles += 1;
  for (const p of save.players) if (p.clubId === champ.clubId) p.titles = (p.titles ?? 0) + 1;

  // 4. all-time records — stored entries survive retirements (only beaten by a better value)
  const better = (entry: RecordEntry | null, value: number) => entry === null || value > entry.value;
  let topCareer = h.allTime.topScorer;
  let topApps = h.allTime.mostApps;
  for (const p of save.players) {
    const c = careerTotals(p);
    if (better(topCareer, c.goals)) {
      topCareer = { value: c.goals, playerId: p.id, name: p.name, clubId: p.clubId, season: save.season };
    }
    if (better(topApps, c.apps)) {
      topApps = { value: c.apps, playerId: p.id, name: p.name, clubId: p.clubId, season: save.season };
    }
  }
  h.allTime.topScorer = topCareer;
  h.allTime.mostApps = topApps;

  const bestGoals = [...save.players].sort((a, b) => b.goals - a.goals || (a.id < b.id ? -1 : 1))[0];
  if (bestGoals && better(h.allTime.bestSeasonGoals, bestGoals.goals)) {
    h.allTime.bestSeasonGoals = {
      value: bestGoals.goals,
      playerId: bestGoals.id,
      name: bestGoals.name,
      clubId: bestGoals.clubId,
      season: save.season
    };
  }
  if (poty && better(h.allTime.bestSeasonRating, Math.round(poty.avg * 100) / 100)) {
    h.allTime.bestSeasonRating = {
      value: Math.round(poty.avg * 100) / 100,
      playerId: poty.p.id,
      name: poty.p.name,
      clubId: poty.p.clubId,
      season: save.season
    };
  }

  // 5. the season's live award state resets for the new campaign
  save.awards = emptyAwards();
}

/** Pays last season's prize money once the new budgets exist (prize + a news line). */
export function payPrize(save: SaveGame): void {
  const last = save.history?.seasons[save.history.seasons.length - 1];
  if (!last) return;
  const fin = save.finances[save.userClubId];
  if (!fin) return;
  const prize = last.user.prize;
  fin.transfer += prize;
  const m = (n: number) => `£${(n / 1_000_000).toFixed(1)}m`;
  pushNews(
    save,
    last.champion.clubId === save.userClubId
      ? `Season ${last.season}: CHAMPIONS! ${m(prize)} prize money banked.`
      : `Season ${last.season}: ${last.champion.name} champions. You finished ${ordinal(last.user.pos)} — ${m(prize)} prize money.`
  );
}

export const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

/** This season's top scorers (league-wide) for the Scorers tab. */
export function topScorers(save: SaveGame, limit = 15): Player[] {
  return [...save.players]
    .filter((p) => p.goals > 0 || (p.apps ?? 0) > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.apps - a.apps || (a.id < b.id ? -1 : 1))
    .slice(0, limit);
}
