import type { CareerState, JobOffer, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { computeTable } from "./league";
import { squadOf, autoLineup } from "./ratings";
import { squadValue } from "./transfers";
import { bandFor, difficultyFor, expectationFor, squadWord, type Band } from "./onboarding";
import { ordinal } from "./history";
import { pushNews } from "./training";
import { pushInbox } from "./inbox";
import { builtinFormation, resolveFormation } from "./formations";
import { cleanSetPieces } from "./setpieces";
import { policyFor } from "./market";
import { scoutingBudgetFor } from "./scouting";
import { makeSponsorOffers } from "./commercial";
import { FANS_START } from "./media";

/**
 * The manager's career (v0.44): patience, reputation and the sack.
 *
 * Until now `userClubId` was forever and the board only judged *money*. Now the
 * board judges *results*: every league round moves a confidence score against a
 * stated target, the pressure escalates in public (concerned → vote of
 * confidence), and a manager who cannot turn it around is dismissed. The record
 * card lives on: reputation grows with overachievement and follows you to the
 * jobs that come calling in pre-season.
 *
 * Everything here is pure and deterministic — no RNG beyond the seeded streams
 * for job offers — so a replay of the same save sacks the same manager.
 */

/** A fresh caretaker start: a known name (50) and the new board's trust (60). */
export const REP_START = 50;
export const CONF_START = 60;
/** confidence thresholds: concern, final warning, the sack */
export const WARN_CONCERNED = 38;
export const WARN_FINAL = 22;
export const SACK_BELOW = 10;
/** no vote of confidence can end a job in the first rounds — the board must see a run */
export const SACK_GRACE_ROUNDS = 6;

const clampN = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A career record for a chosen club. */
export function freshCareer(clubId: string): CareerState {
  return {
    reputation: REP_START,
    confidence: CONF_START,
    warning: 0,
    dismissed: null,
    stints: [{ clubId, from: 1 }],
    offers: []
  };
}

/** The career, created if a save predates it (mid-season backfills are safe). */
export function ensureCareer(save: SaveGame): CareerState {
  if (!save.career) save.career = freshCareer(save.userClubId);
  return save.career;
}

const clubName = (save: SaveGame, clubId: string): string =>
  save.clubs.find((c) => c.id === clubId)?.name ?? "the club";

export interface BoardTarget {
  /** the finishing position the board expects, by the squad's standing in the division */
  target: number;
  band: Band;
  /** the board's line, in words */
  text: string;
}

/**
 * What the board asks of the manager: roughly where the squad belongs. Read
 * freshly each time — sign superstars and the target climbs; sell the family
 * silver and it falls.
 */
export function boardTarget(save: SaveGame, clubId = save.userClubId): BoardTarget {
  const ranked = [...save.clubs].sort(
    (a, b) => squadValue(save, b.id) - squadValue(save, a.id) || (a.id < b.id ? -1 : 1)
  );
  const rank = Math.max(1, ranked.findIndex((c) => c.id === clubId) + 1);
  const band = bandFor(squadValue(save, clubId), ranked.map((c) => squadValue(save, c.id)));
  return { target: rank, band, text: expectationFor(band) };
}

export interface BoardVerdict {
  label: string;
  tone: "good" | "neutral" | "bad";
  /** the meter's colour */
  tint: string;
}

/** How the board feels, in one line, for the Home card. */
export function boardVerdict(confidence: number, warning: 0 | 1 | 2 = 0): BoardVerdict {
  if (warning >= 2) return { label: "One bad result from the sack", tone: "bad", tint: "var(--danger)" };
  if (warning === 1) return { label: "Under pressure", tone: "bad", tint: "var(--warn)" };
  if (confidence >= 75) return { label: "Delighted", tone: "good", tint: "var(--positive)" };
  if (confidence >= 62) return { label: "Pleased", tone: "good", tint: "var(--positive)" };
  if (confidence >= 45) return { label: "Content", tone: "neutral", tint: "var(--muted-foreground)" };
  if (confidence >= WARN_CONCERNED) return { label: "Watching closely", tone: "neutral", tint: "var(--warn)" };
  return { label: "Concerned", tone: "bad", tint: "var(--warn)" };
}

/** Your name in the game, in bands. */
export function reputationLabel(reputation: number): string {
  if (reputation >= 85) return "Elite";
  if (reputation >= 70) return "A big name";
  if (reputation >= 55) return "Highly regarded";
  if (reputation >= 40) return "Respected";
  if (reputation >= 25) return "Making a name";
  return "An unknown quantity";
}

/** The board's read on the manager, written at every rollover. */
const seasonMoodWord = (gap: number): string => {
  if (gap >= 4) return "delighted";
  if (gap >= 1) return "pleased";
  if (gap >= -2) return "satisfied";
  if (gap >= -6) return "unimpressed";
  return "furious";
};

/**
 * One league round of board patience. Pure and deterministic: result + table
 * position against the target, with a slow pull back toward neutral so a good
 * run is never permanently banked.
 */
export function careerTick(save: SaveGame): void {
  const c = save.career;
  if (!c || c.dismissed) return;
  if ((save.phase ?? "league") !== "league" || save.round < 1) return; // pre-season friendlies decide nothing

  const mine = save.lastResults.find(
    (r) => r.homeId === save.userClubId || r.awayId === save.userClubId
  );
  if (!mine) return; // a cup week: not the board's business this time

  const { target } = boardTarget(save);
  const table = computeTable(save.fixtures, save.clubs);
  const row = table.find((r) => r.clubId === save.userClubId);
  const played = row?.p ?? 0;
  const position = row?.position ?? target;

  const h = mine.homeId === save.userClubId;
  const gf = h ? mine.homeGoals : mine.awayGoals;
  const ga = h ? mine.awayGoals : mine.homeGoals;
  const won = gf > ga;
  const lost = gf < ga;
  const margin = Math.min(4, Math.abs(gf - ga));

  // the result itself, its margin, where it leaves you against the target —
  // early-season table position is noise, so the table term ramps in over six rounds
  let d = won ? 2.6 : lost ? -2.6 : 0.2;
  d += (won ? 0.35 : lost ? -0.35 : 0) * margin;
  const gap = target - position; // positive: above where the board expects you
  d += clampN(gap, -8, 8) * 0.32 * Math.min(1, played / 6);
  d += (CONF_START - c.confidence) * 0.05;

  c.confidence = clampN(c.confidence + d, 0, 100);
  const round = save.round;

  // the ladder: concern → vote of confidence → the sack (with a grace period)
  if (c.confidence <= SACK_BELOW && round > SACK_GRACE_ROUNDS) {
    c.warning = 2;
    c.dismissed = { season: save.season, round: round - 1, clubId: save.userClubId };
    c.reputation = clampN(c.reputation - 6, 5, 95);
    const last = c.stints[c.stints.length - 1];
    if (last && last.clubId === save.userClubId) last.until = save.season;
    const club = clubName(save, save.userClubId);
    pushNews(save, `${club} part company with their manager — the board had seen enough.`);
    pushInbox(save, {
      kind: "board",
      title: `You have been dismissed by ${club}`,
      body: "The board ran out of patience. Your record is your record — it is time to look back at it.",
      screen: "home"
    });
    return;
  }
  if (c.confidence <= WARN_FINAL && c.warning < 2) {
    c.warning = 2;
    pushNews(save, `The board issue a vote of confidence — but at ${clubName(save, save.userClubId)} everyone knows what it really means.`);
    pushInbox(save, {
      kind: "board",
      title: "The board: results must improve",
      body: "A public vote of confidence, and a private warning. The next few weeks are your job.",
      screen: "home"
    });
    return;
  }
  if (c.confidence <= WARN_CONCERNED && c.warning < 1) {
    c.warning = 1;
    pushNews(save, `The board have noted their concern about the run of results at ${clubName(save, save.userClubId)}.`);
    pushInbox(save, {
      kind: "board",
      title: "The board are concerned",
      body: "Nothing terminal — yet. Results need to turn.",
      screen: "home"
    });
    return;
  }
  // the storm passes, quietly (hysteresis, so the warning does not flap)
  if (c.warning === 2 && c.confidence > 42) c.warning = 1;
  else if (c.warning === 1 && c.confidence > 52) c.warning = 0;
}

/**
 * The books close on a season: reputation against the target, the spell
 * recorded, a clean slate for the new board — and the clubs that come calling.
 * Runs inside `nextSeason`, before the season counter moves.
 */
export function careerReview(save: SaveGame): void {
  const c = save.career;
  if (!c || c.dismissed) return;
  const table = computeTable(save.fixtures, save.clubs);
  const row = table.find((r) => r.clubId === save.userClubId);
  if (!row) return;
  const { target } = boardTarget(save);
  const gap = target - row.position; // positive: overachievement

  let delta = clampN(Math.round(gap * 1.6), -12, 16);
  const champion = table[0]?.clubId === save.userClubId;
  const cupWin = (save.history.cups ?? []).some(
    (x) => x.season === save.season && x.winnerId === save.userClubId
  );
  if (champion) delta += 10;
  if (cupWin) delta += 6;
  c.reputation = clampN(c.reputation + delta, 5, 95);

  // close the season in the spell book
  const last = c.stints[c.stints.length - 1];
  if (last && last.clubId === save.userClubId) last.until = save.season;
  else c.stints.push({ clubId: save.userClubId, from: save.season, until: save.season });

  // the board's verdict on the season
  const mood = seasonMoodWord(gap);
  pushNews(
    save,
    `Season ${save.season} reviewed: you finished ${ordinal(row.position)} — the board are ${mood}.`
  );
  pushInbox(save, {
    kind: "board",
    title: `The board's verdict: ${mood}`,
    body: `You were asked for ${ordinal(target)} or thereabouts; you delivered ${ordinal(row.position)}. Reputation ${c.reputation} (${reputationLabel(c.reputation)}).`,
    screen: "home"
  });

  // a clean slate, and the jobs that follow a reputation
  c.confidence = CONF_START;
  c.warning = 0;
  c.offers = makeJobOffers(save);
  for (const o of c.offers) {
    pushNews(save, `${clubName(save, o.clubId)} are looking for a new manager — your name is on their list.`);
    pushInbox(save, {
      kind: "board",
      title: `Approach: ${clubName(save, o.clubId)} want you`,
      body: `Their board expects: ${o.expectation} The offers are on the Home screen while pre-season lasts.`,
      screen: "home"
    });
  }
}

/**
 * What a club of this stature needs from a manager before it will come
 * calling: the champions want a big name, the strugglers will take a chance.
 */
export function requiredReputation(rank: number, clubs: number): number {
  const n = Math.max(2, clubs);
  const frac = (n - rank) / (n - 1); // 1 at the top of the table, 0 at the bottom
  return Math.round(20 + frac * 58);
}

/**
 * The approaches for the new season: the biggest clubs that would take you,
 * picked on a seeded stream so the same career offers the same jobs. At most
 * three, never your current club.
 */
export function makeJobOffers(save: SaveGame): JobOffer[] {
  const c = save.career;
  if (!c || c.dismissed) return [];
  const ranked = [...save.clubs].sort(
    (a, b) => squadValue(save, b.id) - squadValue(save, a.id) || (a.id < b.id ? -1 : 1)
  );
  const values = ranked.map((cl) => squadValue(save, cl.id));
  const eligible = ranked
    .map((club, i) => ({ club, rank: i + 1 }))
    .filter((e) => e.club.id !== save.userClubId && c.reputation >= requiredReputation(e.rank, ranked.length))
    .slice(0, 3); // the biggest that would have you
  if (!eligible.length) return [];
  const rng = mulberry32(hashSeed(save.seed, "joboffers", save.season));
  const count = eligible.length === 1 ? 1 : rng() < 0.55 ? 2 : Math.min(3, eligible.length);
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count).map((e) => {
    const band = bandFor(squadValue(save, e.club.id), values);
    return {
      id: `joff-${save.season}-${e.club.id}`,
      clubId: e.club.id,
      season: save.season + 1,
      expectation: expectationFor(band),
      squad: squadWord(band)
    };
  });
}

/**
 * Accept an approach: the full re-keying of a club move. The playbook travels
 * (formation, customs, set-piece routines, week plan); the club-specific state
 * does not (takers, armband, transfer dealings, sponsor, builders, the old
 * board's policy and confidence). Pre-season only — the offers expire at the
 * opener.
 */
export function acceptJob(
  input: SaveGame,
  offerId: string
): { save: SaveGame; ok: boolean; message: string } {
  const save: SaveGame = structuredClone(input);
  const c = save.career;
  if (!c) return { save, ok: false, message: "No career to move." };
  const offer = c.offers.find((o) => o.id === offerId);
  if (!offer) return { save, ok: false, message: "That offer is no longer on the table." };
  const club = save.clubs.find((x) => x.id === offer.clubId);
  if (!club) return { save, ok: false, message: "That club does not exist." };
  const oldName = clubName(save, save.userClubId);

  // close the old spell, open the new one (review has already stamped `until`)
  const last = c.stints[c.stints.length - 1];
  if (last && last.clubId === save.userClubId && last.until === undefined) {
    last.until = Math.max(last.from, save.season - 1);
  }
  c.stints.push({ clubId: club.id, from: save.season });
  c.confidence = CONF_START;
  c.warning = 0;
  c.offers = [];

  save.userClubId = club.id;
  // your shape travels; the eleven, the takers and the armband are the new club's
  const def = resolveFormation(save.lineup.formation, save.customFormations) ?? builtinFormation("4-3-3");
  const squad = squadOf(save.players, club.id);
  save.lineup = autoLineup(squad, def, { mentality: save.lineup.mentality });
  save.setpieces = cleanSetPieces(save.setpieces, new Set(squad.map((p) => p.id)));
  save.captain = undefined;
  save.vice = undefined;
  save.meeting = undefined;
  save.live = undefined;
  save.weekOverride = undefined;
  // deals on the old club's players, agreed for the old club, die with the move
  save.offers = [];
  save.pending = undefined;
  save.preContracts = [];
  // the builders were the old club's; the new shirt is on the market
  save.builds = [];
  save.sponsor = undefined;
  save.sponsorOffers = makeSponsorOffers(save);
  save.policy = policyFor(save, save.season);
  save.scouting.budget = scoutingBudgetFor(save.finances[club.id]?.transfer ?? 1_000_000);
  // the terrace mood is the ground's, not the manager's; the press's respect follows you
  save.recentResults = [];
  if (save.media) save.media.fans = FANS_START;

  pushNews(save, `You are the new manager of ${club.name} — out of ${oldName} and straight into a new project.`);
  pushInbox(save, {
    kind: "board",
    title: `New job: ${club.name}`,
    body: `${club.name} have appointed you on the strength of your record. The board expects: ${offer.expectation} ${difficultyFor(bandFor(squadValue(save, club.id), save.clubs.map((x) => squadValue(save, x.id))))} job ahead.`,
    screen: "home"
  });
  return { save, ok: true, message: `You take charge at ${club.name}.` };
}

/** Turn an approach down: it is off the table, and the season goes on. */
export function declineJob(input: SaveGame, offerId: string): { save: SaveGame; ok: boolean; message: string } {
  const save: SaveGame = structuredClone(input);
  const c = save.career;
  if (!c) return { save, ok: false, message: "No career." };
  const offer = c.offers.find((o) => o.id === offerId);
  if (!offer) return { save, ok: false, message: "That offer is no longer on the table." };
  c.offers = c.offers.filter((o) => o.id !== offerId);
  return { save, ok: true, message: `You turn down ${clubName(save, offer.clubId)}.` };
}
