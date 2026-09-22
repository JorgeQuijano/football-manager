import type { MatchResult, Player, SaveGame } from "./types";
import { hasTrait } from "./traits";
import { formOf } from "./stats";
import { wageDemand } from "./transfers";
import { pushNews } from "./training";
import { overallFor } from "./ratings";
import { fanMoraleFactor } from "./media";

/** Neutral morale: everything that reads morale is calibrated so 60 = no effect. */
export const MORALE_START = 60;
/** Below this, a player stops talking terms unless you pay over the odds. */
export const MORALE_TALKS = 30;
/** Below this for a few rounds in a row, a transfer request lands. */
export const MORALE_REQUEST = 25;
/** Above this, a transfer request is withdrawn. */
export const MORALE_RECONCILE = 50;

export const MOODS: { min: number; label: string; tint: string }[] = [
  { min: 85, label: "Delighted", tint: "#2ED573" },
  { min: 70, label: "Happy", tint: "#7BE495" },
  { min: 55, label: "Content", tint: "#8B98A5" },
  { min: 40, label: "Unsettled", tint: "#FFB020" },
  { min: 25, label: "Unhappy", tint: "#FF8A5C" },
  { min: 0, label: "Miserable", tint: "#FF6B6B" }
];

export const moodOf = (m: number) => MOODS.find((x) => m >= x.min) ?? MOODS[MOODS.length - 1];

/** Match-level edge: scales finishing, creativity, defending and keeping. Neutral at 60. */
export const moraleEdge = (p: Player): number => 1 + ((p.morale ?? MORALE_START) - MORALE_START) * 0.0015;

/** Training/development multiplier. Neutral at 60. */
export const moraleDev = (m: number): number => 1 + (m - MORALE_START) * 0.002;

export type SquadStatus = "star" | "rotation" | "fringe" | "youth";
const STATUS_WANT: Record<SquadStatus, number> = { star: 0.7, rotation: 0.45, fringe: 0.22, youth: 0.1 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Where a player sits in his club's pecking order — drives how much football he expects. */
export function squadStatus(save: SaveGame, p: Player): SquadStatus {
  if (p.clubId === "") return "fringe";
  const mates = [...save.players].filter((x) => x.clubId === p.clubId).sort((a, b) => overallFor(b) - overallFor(a));
  const rank = mates.findIndex((x) => x.id === p.id) + 1;
  if (p.age <= 20) return rank <= 6 ? "rotation" : "youth";
  if (rank <= 3) return "star";
  if (rank <= 11) return "rotation";
  if (rank <= 17) return "fringe";
  return "youth";
}

/** How much football he has actually had lately (recentMin, newest first). */
export const minutesShare = (recentMin: number[] | undefined): number => {
  const m = (recentMin ?? []).slice(0, 8);
  if (!m.length) return 0;
  const v: number[] = m.map((x) => (x >= 55 ? 1 : x >= 15 ? 0.45 : 0));
  return v.reduce((a, b) => a + b, 0) / v.length;
};

export interface MoraleFactor {
  label: string;
  val: number;
}

/**
 * Why a player feels the way he does — one entry per live factor. Pure read:
 * `moraleTick` sums `val`; the UI renders the list.
 */
export function moraleFactors(save: SaveGame, p: Player): MoraleFactor[] {
  const out: MoraleFactor[] = [];
  const status = squadStatus(save, p);
  const window = p.recentMin ?? [];
  const share = minutesShare(p.recentMin);
  const want = STATUS_WANT[status];
  const gap = share - want;
  if (window.length < 3) out.push({ label: "Settling into the season", val: 0.5 });
  else if (gap < -0.18) out.push({ label: "Wants more minutes", val: -4 });
  else if (gap < -0.05) out.push({ label: "Could do with more football", val: -1.6 });
  else if (gap > 0.25) out.push({ label: "Thriving with his minutes", val: 2 });
  else out.push({ label: "Happy with his role", val: 0.6 });

  const ratio = p.contract.wage / Math.max(1, wageDemand(p));
  if (ratio < 0.7) out.push({ label: "Feels badly underpaid", val: -3 });
  else if (ratio < 0.85) out.push({ label: "Underpaid for his ability", val: -1.6 });
  else if (ratio > 1.4) out.push({ label: "Well rewarded", val: 1 });

  if (p.contract.until <= save.season) out.push({ label: "Contract expires this season", val: -2 });
  if (p.injuredWeeks >= 3) out.push({ label: "Frustrated by injury", val: -1.5 });
  if (p.suspension > 0) out.push({ label: "Let the team down", val: -1.5 });

  const f = formOf(p);
  if (f !== null) {
    if (f >= 7.3) out.push({ label: "In fine form", val: 1.5 });
    else if (f <= 5.9) out.push({ label: "Struggling for form", val: -1.5 });
  }
  if (p.transferRequest) out.push({ label: "Wants to leave", val: -1 });
  if (p.clubId === save.userClubId) {
    const fan = fanMoraleFactor(save.media?.fans);
    if (fan) out.push(fan);
  }
  return out;
}

/** The run of recent results for the user's club (newest first) — atmosphere sugar. */
export function recentForm(save: SaveGame): ("W" | "D" | "L")[] {
  return (save.recentResults ?? []).map((r) =>
    r.gf > r.ga ? "W" : r.gf === r.ga ? "D" : "L"
  );
}

export interface Atmos {
  avg: number;
  label: string;
  tint: string;
  counts: { label: string; tint: string; n: number }[];
  unhappy: Player[];
  happy: Player[];
}

export function atmosphere(save: SaveGame, clubId = save.userClubId): Atmos {
  const squad = save.players.filter((p) => p.clubId === clubId);
  const avg = squad.length ? squad.reduce((a, p) => a + (p.morale ?? MORALE_START), 0) / squad.length : MORALE_START;
  const mood = moodOf(avg);
  const counts = MOODS.map((m) => ({ label: m.label, tint: m.tint, n: squad.filter((p) => moodOf(p.morale ?? MORALE_START) === m).length }));
  return {
    avg,
    label: mood.label,
    tint: mood.tint,
    counts,
    unhappy: squad.filter((p) => (p.morale ?? MORALE_START) < 40).sort((a, b) => (a.morale ?? 60) - (b.morale ?? 60)),
    happy: squad.filter((p) => (p.morale ?? MORALE_START) >= 70)
  };
}

/** The dressing-room leaders: ability, seniority and the Leader trait. */
/** The armband, a leader trait and experience all count towards a voice in the room. */
const leaderScore = (p: Player, captain?: string, vice?: string): number =>
  overallFor(p) +
  (hasTrait(p, "leader") ? 9 : 0) +
  (p.age >= 28 ? 4 : 0) +
  (p.id === captain ? 14 : p.id === vice ? 6 : 0);

export function leaders(save: SaveGame, clubId: string): Player[] {
  const club = clubId;
  const captain = save.captain && save.players.some((p) => p.id === save.captain && p.clubId === club) ? save.captain : undefined;
  const vice = save.vice && save.players.some((p) => p.id === save.vice && p.clubId === club) ? save.vice : undefined;
  return [...save.players]
    .filter((p) => p.clubId === club)
    .sort((a, b) => leaderScore(b, captain, vice) - leaderScore(a, captain, vice) || (a.id < b.id ? -1 : 1))
    .slice(0, 3);
}

export interface SocialGroup {
  id: string;
  label: string;
  blurb: string;
  players: Player[];
  avg: number;
  keyMan: Player | null;
}

/** Social groups at the user's club — where the dressing-room mood actually lives. */
export function socialGroups(save: SaveGame, clubId = save.userClubId): SocialGroup[] {
  const squad = save.players.filter((p) => p.clubId === clubId);
  const spec: [string, string, string, (p: Player) => boolean][] = [
    ["young", "Young guns", "The kids, all noise and no fear", (p) => p.age <= 21],
    ["core", "The core", "Peak-years players who set the standard", (p) => p.age >= 22 && p.age <= 29],
    ["vets", "Old guard", "Experienced heads — their mood travels", (p) => p.age >= 30]
  ];
  return spec
    .map(([id, label, blurb, f]) => {
      const players = squad.filter(f);
      const avg = players.length ? players.reduce((a, p) => a + (p.morale ?? MORALE_START), 0) / players.length : MORALE_START;
      return { id, label, blurb, players, avg, keyMan: leaders(save, clubId).find((l) => f(l)) ?? players[0] ?? null };
    })
    .filter((g) => g.players.length > 0);
}

/**
 * Per-round morale update for every club (called from `completeRound` once the
 * round's results are in). Deterministic: pure arithmetic on stored state.
 */
export function moraleTick(save: SaveGame, results: MatchResult[]): void {
  // 1. minutes + result for every player who played this round
  const minsByPlayer = new Map<string, number>();
  for (const r of results) for (const u of r.updates) minsByPlayer.set(u.playerId, u.minutes);

  for (const r of results) {
    const homeWon = r.homeGoals > r.awayGoals;
    const awayWon = r.awayGoals > r.homeGoals;
    for (const clubId of [r.homeId, r.awayId]) {
      const won = clubId === r.homeId ? homeWon : awayWon;
      const lost = clubId === r.homeId ? awayWon : homeWon;
      const resultDelta = won ? 1.8 : lost ? -1.8 : 0;
      for (const p of save.players) {
        if (p.clubId !== clubId) continue;
        const mins = minsByPlayer.get(p.id) ?? 0;
        p.recentMin = [mins, ...(p.recentMin ?? [])].slice(0, 8);
        const delta = moraleFactors(save, p).reduce((a, x) => a + x.val, 0) + resultDelta;
        p.morale = clamp((p.morale ?? MORALE_START) + delta, 5, 100);
      }
    }
  }

  // 2. the dressing room pulls everyone toward its leaders
  for (const club of save.clubs) {
    const squad = save.players.filter((p) => p.clubId === club.id);
    if (squad.length < 4) continue;
    const lead = leaders(save, club.id);
    const leadIds = new Set(lead.map((l) => l.id));
    if (!lead.length) continue;
    const leadAvg = lead.reduce((a, p) => a + (p.morale ?? MORALE_START), 0) / lead.length;
    for (const p of squad) {
      if (leadIds.has(p.id)) continue;
      const pull = clamp((leadAvg - (p.morale ?? MORALE_START)) * 0.06, -2, 2);
      p.morale = clamp((p.morale ?? MORALE_START) + pull, 5, 100);
    }
  }

  // 3. transfer requests (your club makes the news)
  const mine = save.players.filter((p) => p.clubId === save.userClubId);
  for (const p of mine) {
    const m = p.morale ?? MORALE_START;
    if (m < MORALE_REQUEST) p.unhappyRounds = (p.unhappyRounds ?? 0) + 1;
    else p.unhappyRounds = 0;
    if (!p.transferRequest && (p.unhappyRounds ?? 0) >= 3) {
      p.transferRequest = true;
      p.morale = clamp(m + 5, 5, 100);
      pushNews(save, `${p.name} has handed in a transfer request.`);
    } else if (p.transferRequest && m >= MORALE_RECONCILE) {
      p.transferRequest = false;
      pushNews(save, `${p.name} has withdrawn his transfer request.`);
    }
  }
}

export interface TalkResult {
  /** what happened, in plain language */
  message: string;
  delta: number;
  morale: number;
}

/** Rounds a player will accept between individual chats. */
export const TALK_COOLDOWN = 4;

/**
 * Praise or warn a player (FM-style interaction). Returns `{ error }` when the
 * chat isn't possible, otherwise the reaction.
 */
export function talkToPlayer(
  save: SaveGame,
  playerId: string,
  kind: "praise" | "warn"
): TalkResult | { error: string } {
  const p = save.players.find((x) => x.id === playerId);
  if (!p) return { error: "No such player." };
  if (p.clubId !== save.userClubId) return { error: "He's not your player." };
  const now = save.season * 1000 + save.round;
  if ((p.lastTalk ?? -9999) > now - TALK_COOLDOWN) {
    return { error: "You've spoken to him recently — let it breathe for a few matches." };
  }
  const f = formOf(p);
  const inForm = f !== null && f >= 6.8;
  const poor = f !== null && f <= 5.8;
  let delta: number;
  let message: string;
  if (kind === "praise") {
    if (inForm) {
      delta = 7;
      message = `${p.name} is buzzing — praise lands perfectly when he's playing like this.`;
    } else if (poor) {
      delta = 1;
      message = `${p.name} nods politely, but he knows he's not playing well.`;
    } else {
      delta = 4;
      message = `${p.name} appreciates the kind words.`;
    }
  } else {
    if (poor) {
      delta = 6;
      message = `${p.name} takes it on the chin — exactly the wake-up call he needed.`;
    } else if (inForm) {
      delta = -8;
      message = `${p.name} is furious. Criticising your best performer rarely lands.`;
    } else {
      delta = -4;
      message = `${p.name} isn't happy about being singled out.`;
    }
  }
  if (hasTrait(p, "leader")) delta = kind === "praise" ? delta + 2 : Math.round(delta * 0.6);
  p.morale = clamp((p.morale ?? MORALE_START) + delta, 5, 100);
  p.lastTalk = now;
  p.talkKind = kind;
  return { message, delta, morale: p.morale };
}
