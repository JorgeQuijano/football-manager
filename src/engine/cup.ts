import type { Cup, CupRoundId, CupTie, Fixture, MatchResult, SaveGame } from "./types";
import { hashSeed, mulberry32, type Rng } from "./rng";
import { matchInputs } from "./advance";
import { MATCH_DAY } from "./week";
import { squadValue } from "./transfers";
import { advanceTo, shootout, startMatch } from "./match";
import { pushInbox } from "./inbox";
import { pushNews } from "./training";
import { recordForm } from "./stats";
import { medicalWeeks } from "./commercial";
import { applyCardPenalties } from "./discipline";
import { jadedTick, sharpnessTick } from "./physical";

/**
 * The Challenge Cup (v0.36.0): a domestic knockout, played mid-week, on the same
 * day clock as everything else.
 *
 * Ten clubs: the four lowest-ranked play a preliminary round, the two winners
 * join the other six in the quarter-finals, then semis and the final. Every tie
 * is seeded off the season and the round, so the same save always draws — and
 * always wins or loses — the same way.
 *
 * Cup ties are real matches: the manager picks the XI, watches it, and pays the
 * price in legs, knocks and bookings. They just do not touch the league table.
 */

export const CUP_ROUNDS: CupRoundId[] = ["prelim", "qf", "sf", "final"];

export const CUP_ROUND_LABEL: Record<CupRoundId, string> = {
  prelim: "Preliminary round",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "The Final"
};

/** Which league round each cup round is played in (a Wednesday in that week). */
export const CUP_WEEK: Record<CupRoundId, number> = { prelim: 4, qf: 8, sf: 12, final: 16 };

/** Wednesday on the week clock. */
export const CUP_DAY = 2;
/** What beating each round is worth to the account. */
export const CUP_PRIZE: Record<CupRoundId, number> = { prelim: 150_000, qf: 350_000, sf: 750_000, final: 1_500_000 };

const rngFor = (save: SaveGame, tag: string): Rng => mulberry32(hashSeed(save.seed, "cup", save.season, tag));

/** The order clubs are seeded by: last season's finish, then the size of the squad. */
function seedOrder(save: SaveGame): string[] {
  const last = save.history?.seasons?.[save.history.seasons.length - 1];
  const byStrength = [...save.clubs].sort((a, b) => squadValue(save, b.id) - squadValue(save, a.id)).map((c) => c.id);
  if (last) {
    const userPos = last.user.pos;
    const champion = last.champion.clubId;
    // put last season's champion first and the user where he finished, then fall back to strength
    return [
      champion,
      ...byStrength.filter((id) => id !== champion && id !== save.userClubId)
    ].map((id, i) => (id === save.userClubId ? id : id)).map((id) => ({ id, rank: byStrength.indexOf(id) }))
      .map((x, i) => ({ ...x, adj: x.id === save.userClubId ? userPos : i }))
      .sort((a, b) => a.adj - b.adj)
      .map((x) => x.id);
  }
  return byStrength;
}

/** A fresh tie with a stable id. */
const tie = (round: CupRoundId, homeId: string, awayId: string, n: number): CupTie => ({
  id: `cup-${round}-${n}`,
  round,
  homeId,
  awayId,
  played: false
});

/** Draw the preliminary round: the four lowest-seeded clubs pair off. */
export function drawPrelim(save: SaveGame): Cup {
  const order = seedOrder(save);
  const low = order.slice(-4);
  const rng = rngFor(save, "draw-prelim");
  const shuffled = [...low].sort(() => rng() - 0.5);
  const ties = [tie("prelim", shuffled[0], shuffled[1], 0), tie("prelim", shuffled[2], shuffled[3], 1)];
  return {
    season: save.season,
    ties,
    schedule: { ...CUP_WEEK },
    rounds: CUP_ROUNDS
  };
}

/** Everyone still in it after the last drawn round: its winners, plus the byes. */
export function survivors(save: SaveGame): string[] {
  const cup = save.cup;
  if (!cup) return save.clubs.map((c) => c.id);
  const drawn = CUP_ROUNDS.filter((r) => cup.ties.some((t) => t.round === r));
  if (!drawn.length) return save.clubs.map((c) => c.id);
  const last = drawn[drawn.length - 1];
  const lastTies = cup.ties.filter((t) => t.round === last);
  const winners = lastTies.map((t) => winnerOf(t)).filter((id): id is string => !!id);
  const everDrawn = new Set(cup.ties.flatMap((t) => [t.homeId, t.awayId]));
  const byes = save.clubs.map((c) => c.id).filter((id) => !everDrawn.has(id));
  return [...winners, ...byes];
}

/** Draw the next round from whoever is left (seeded, home advantage by lot). */
export function drawRound(save: SaveGame, round: CupRoundId): void {
  const cup = save.cup;
  if (!cup) return;
  const through = survivors(save);
  const rng = rngFor(save, `draw-${round}`);
  const order = through.sort((a, b) => seedOrder(save).indexOf(a) - seedOrder(save).indexOf(b));
  const shuffled = [...order].sort(() => rng() - 0.5);
  const ties: CupTie[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    // the higher-seeded side of the pair gets the home draw
    const a = shuffled[i];
    const b = shuffled[i + 1];
    const aRank = seedOrder(save).indexOf(a);
    const bRank = seedOrder(save).indexOf(b);
    ties.push(tie(round, aRank <= bRank ? a : b, aRank <= bRank ? b : a, ties.length));
  }
  cup.ties.push(...ties);
}

/** A new season's cup: drawn, with the preliminary round ready to play. */
export function makeCup(save: SaveGame): Cup {
  return drawPrelim(save);
}

/** Is this league round a cup week, and is the user still involved? */
export function cupRoundThisWeek(save: SaveGame): CupRoundId | null {
  const cup = save.cup;
  if (!cup) return null;
  for (const r of CUP_ROUNDS) {
    if (cup.schedule[r] !== save.round) continue;
    if (cup.ties.some((t) => t.round === r)) return r;
  }
  return null;
}

/** The user's tie in a given cup round (if he is in it and it is unplayed). */
export function userCupTie(save: SaveGame, round?: CupRoundId | null): CupTie | undefined {
  const cup = save.cup;
  if (!cup) return undefined;
  const r = round ?? cupRoundThisWeek(save);
  if (!r) return undefined;
  return cup.ties.find(
    (t) => t.round === r && !t.played && (t.homeId === save.userClubId || t.awayId === save.userClubId)
  );
}

/** Does the user have a cup tie to play this week? Then Wednesday is a match day. */
export function hasCupTieThisWeek(save: SaveGame): boolean {
  return !!userCupTie(save);
}

/** A tie as a Fixture, so the match screen and the sim can treat it normally. */
export function tieAsFixture(t: CupTie): Fixture {
  return {
    round: 0,
    homeId: t.homeId,
    awayId: t.awayId,
    played: !!t.played,
    homeGoals: t.homeGoals,
    awayGoals: t.awayGoals
  };
}

/**
 * A tie, played out: ninety minutes, and penalties if they are level.
 * (The manager's own tie runs through the live screen and lands here the same way.)
 */
export function resolveTie(
  save: SaveGame,
  t: CupTie
): { homeGoals: number; awayGoals: number; pens?: { home: number; away: number } } {
  const players = new Map(save.players.map((p) => [p.id, p]));
  const inputs = matchInputs(save, save.round, t.homeId, t.awayId);
  let state = advanceTo(startMatch({ ...inputs, bigMatch: false }), 90, players);
  if (state.home.goals !== state.away.goals) return { homeGoals: state.home.goals, awayGoals: state.away.goals };
  const rng = mulberry32(state.rngState);
  const p = shootout(state, players, rng);
  state = { ...state, rngState: rng.state };
  return { homeGoals: state.home.goals, awayGoals: state.away.goals, pens: { home: p.home, away: p.away } };
}

/** Who won, or undefined if nobody has yet. */
export function winnerOf(t: CupTie): string | undefined {
  if (!t.played) return undefined;
  if (t.winnerId) return t.winnerId;
  const h = t.homeGoals ?? 0;
  const a = t.awayGoals ?? 0;
  if (h !== a) return h > a ? t.homeId : t.awayId;
  if (t.pens) return t.pens.home > t.pens.away ? t.homeId : t.awayId;
  return undefined;
}

/** Play every AI tie in a round (no manager, no drama — just the result). */
function playAiTies(save: SaveGame, round: CupRoundId): void {
  const cup = save.cup!;
  for (const t of cup.ties.filter((x) => x.round === round && !x.played)) {
    if (t.homeId === save.userClubId || t.awayId === save.userClubId) continue; // the manager plays his own
    const r = resolveTie(save, t);
    t.played = true;
    t.homeGoals = r.homeGoals;
    t.awayGoals = r.awayGoals;
    t.pens = r.pens;
    t.winnerId = r.pens
      ? r.pens.home > r.pens.away
        ? t.homeId
        : t.awayId
      : r.homeGoals > r.awayGoals
        ? t.homeId
        : t.awayId;
  }
}

/**
 * Called as every league round completes: if this week's cup round does not
 * involve the manager (he is out, or he has a bye), the ties are played and the
 * round is settled right here — otherwise the bracket would stall until he is
 * back in it, which can never happen.
 */
export function tickCup(save: SaveGame): void {
  const round = cupRoundThisWeek(save);
  if (!round) return;
  if (save.cup!.settled?.includes(round)) return; // already dealt with
  if (userCupTie(save, round)) return; // his tie is his to play
  const ties = save.cup!.ties.filter((t) => t.round === round);
  if (!ties.length) return;
  playAiTies(save, round);
  settleRound(save, round);
}

/** Everything that happens when the book closes on a cup round. */
function settleRound(save: SaveGame, round: CupRoundId): void {
  const cup = save.cup!;
  cup.settled = cup.settled ?? [];
  if (cup.settled.includes(round)) return; // it only settles once
  cup.settled.push(round);
  cup.rounds = cup.rounds ?? CUP_ROUNDS;
  const mine = cup.ties.find((t) => t.round === round && (t.homeId === save.userClubId || t.awayId === save.userClubId));
  const idx = CUP_ROUNDS.indexOf(round);
  const next = CUP_ROUNDS[idx + 1];

  if (round === "final") {
    const w = cup.ties.find((t) => t.round === "final");
    const winnerId = w ? winnerOf(w) : undefined;
    if (winnerId) {
      cup.winnerId = winnerId;
      cup.runnerUpId = winnerId === w!.homeId ? w!.awayId : w!.homeId;
      const winner = save.clubs.find((c) => c.id === winnerId);
      const fin = save.finances[save.userClubId];
      if (winnerId === save.userClubId && fin) {
        fin.balance = (fin.balance ?? 0) + CUP_PRIZE.final;
        pushNews(save, `CHAMPIONS! ${winner?.name} win the Challenge Cup — £${(CUP_PRIZE.final / 1_000_000).toFixed(2)}m in prize money.`);
      } else {
        pushNews(save, `${winner?.name} lift the Challenge Cup.`);
      }
      pushInbox(save, {
        kind: "club",
        title: winnerId === save.userClubId ? "Challenge Cup winners" : `${winner?.name} win the Challenge Cup`,
        body: winnerId === save.userClubId ? "A trophy for the cabinet — the board will remember this." : "Your cup run is over for the season.",
        screen: "league"
      });
      save.history = save.history ?? { seasons: [] };
      save.history.cups = [...(save.history.cups ?? []), { season: save.season, winnerId }];
    }
    return;
  }

  // prize money for going through
  if (mine && winnerOf(mine) === save.userClubId) {
    const fin = save.finances[save.userClubId];
    if (fin) fin.balance = (fin.balance ?? 0) + (CUP_PRIZE[round] ?? 0);
    pushNews(save, `Cup: through to the ${next ? CUP_ROUND_LABEL[next].toLowerCase() : "final"}.`);
  } else if (mine) {
    pushNews(save, `Cup: out of the competition — ${save.clubs.find((c) => c.id === winnerOf(mine))?.name} knock you out.`);
  }
  if (next) drawRound(save, next);
}

/** Apply the manager's finished tie: the tie, the rest of the round, the draw. */
export function completeCupTie(input: SaveGame, result: MatchResult, pens?: { home: number; away: number }): SaveGame {
  const save: SaveGame = structuredClone(input);
  const cup = save.cup;
  if (!cup) return save;
  const round = cupRoundThisWeek(save);
  const t = round ? userCupTie(save, round) : undefined;
  if (!t || !round) return save;

  const hg = result.homeGoals;
  const ag = result.awayGoals;
  t.played = true;
  t.homeGoals = hg;
  t.awayGoals = ag;
  if (pens) t.pens = pens;
  t.winnerId = pens
    ? pens.home > pens.away
      ? t.homeId
      : t.awayId
    : hg > ag
      ? t.homeId
      : ag > hg
        ? t.awayId
        : undefined;

  // the match's own consequences: legs, knocks, form, ratings, cards, bans
  const minutesById: Record<string, number> = {};
  for (const u of result.updates) {
    const p = save.players.find((pp) => pp.id === u.playerId);
    if (!p) continue;
    minutesById[p.id] = (minutesById[p.id] ?? 0) + u.minutes;
    if (u.minutes > 0) p.apps++;
    p.goals += u.goals;
    p.assists += u.assists;
    if (u.header) p.headers = (p.headers ?? 0) + 1;
    if (u.conditionLoss > 0) p.condition = Math.max(5, Math.round(p.condition - u.conditionLoss));
    if (u.injuredWeeks > 0) p.injuredWeeks = Math.max(p.injuredWeeks, medicalWeeks(save, p.clubId, u.injuredWeeks));
    const before = p.yellows ?? 0;
    if (u.yellow > 0) p.yellows = before + u.yellow;
    if (u.red) p.reds = (p.reds ?? 0) + 1;
    applyCardPenalties(save, p, {
      before,
      after: p.yellows ?? 0,
      redKind: u.redKind,
      notify: p.clubId === save.userClubId
    });
    const rt = result.ratings[u.playerId];
    if (u.minutes > 0 && typeof rt === "number" && Number.isFinite(rt)) recordForm(p, rt);
  }
  sharpnessTick(save, minutesById, "played");
  jadedTick(save, minutesById, "played");

  playAiTies(save, round);
  settleRound(save, round);
  save.lastUserMatch = result;
  save.live = undefined;
  save.cupLast = { round, tieId: t.id };
  // the tie is done: the clock moves on to the next day of the week
  save.day = Math.max(save.day ?? CUP_DAY, Math.min(MATCH_DAY, CUP_DAY + 1));
  return save;
}

/** The bracket, for the screen: rounds in order with their ties. */
export function cupView(save: SaveGame): Array<{ round: CupRoundId; label: string; ties: CupTie[]; week: number }> {
  const cup = save.cup;
  if (!cup) return [];
  return CUP_ROUNDS.map((r) => ({
    round: r,
    label: CUP_ROUND_LABEL[r],
    ties: cup.ties.filter((t) => t.round === r),
    week: cup.schedule?.[r] ?? CUP_WEEK[r]
  }));
}

/** One line for the manager: where the cup stands. */
export function cupStatus(save: SaveGame): string {
  const cup = save.cup;
  if (!cup) return "No cup this season.";
  if (cup.winnerId) {
    const w = save.clubs.find((c) => c.id === cup.winnerId);
    return w?.id === save.userClubId ? "You won the Challenge Cup." : `${w?.name} won the Challenge Cup.`;
  }
  const round = cupRoundThisWeek(save);
  const t = userCupTie(save, round);
  if (t) {
    const opp = save.clubs.find((c) => c.id === (t.homeId === save.userClubId ? t.awayId : t.homeId));
    return `${CUP_ROUND_LABEL[t.round]} v ${opp?.name}${t.homeId === save.userClubId ? " (home)" : " (away)"}`;
  }
  const stillIn = cup.ties.some((x) => x.played && x.winnerId === save.userClubId);
  return stillIn ? "Still in the cup." : "Out of the cup.";
}
