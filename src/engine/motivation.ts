import type { Fixture, Player, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";
import { formOf } from "./stats";
import { hasTrait } from "./traits";
import { TALK_COOLDOWN, minutesShare, STATUS_WANT, squadStatus } from "./morale";
import { pushNews } from "./training";
import { computeTable } from "./league";

/**
 * Motivation (v0.28): individual talks that read the player, squad meetings that
 * read the moment, and the big matches where both of them matter most.
 */

// --- individual talks ------------------------------------------------------------------------

export type PlayerTalkKind = "praise" | "reassure" | "challenge" | "warn";

export interface TalkOption {
  kind: PlayerTalkKind;
  label: string;
  blurb: string;
  /** does it lift him, steady him, or sting? */
  mood: "lift" | "steady" | "sting";
}

export const TALK_OPTIONS: TalkOption[] = [
  { kind: "praise", label: "Praise him", blurb: "Tell him how good he is. Lands hardest on a man playing well.", mood: "lift" },
  { kind: "reassure", label: "Reassure him", blurb: "Take the pressure off. For a worried player in a bad patch.", mood: "steady" },
  { kind: "challenge", label: "Challenge him", blurb: "Tell him he can do more. Pumps up a confident player for the next two games.", mood: "lift" },
  { kind: "warn", label: "Warn him", blurb: "Read the riot act. Works on a player who knows he's been poor.", mood: "sting" }
];

const now = (save: SaveGame): number => save.season * 1000 + save.round;
export const talksCooling = (p: Player, save: SaveGame): boolean => (p.lastTalk ?? -9999) > now(save) - TALK_COOLDOWN;

/** What he needs to hear, read off his form, mood and minutes. */
export function talkAdvice(save: SaveGame, p: Player): { kind: PlayerTalkKind; why: string } | null {
  if (talksCooling(p, save)) return null;
  const f = formOf(p);
  const morale = p.morale ?? 60;
  const share = minutesShare(p.recentMin);
  const want = STATUS_WANT[squadStatus(save, p)];
  if (share !== null && share < want * 0.7 && morale < 45) {
    return { kind: "reassure", why: "He isn't playing and he's unhappy — a word to keep him onside." };
  }
  if (f !== null && f <= 5.8 && morale >= 50) {
    return { kind: "reassure", why: "His form is poor but his head is up — take the pressure off." };
  }
  if (f !== null && f <= 5.8) {
    return { kind: "warn", why: "Playing badly and he knows it — he needs the truth." };
  }
  if (f !== null && f >= 6.8 && morale >= 60) {
    return { kind: "challenge", why: "Flying and confident — ask him for even more." };
  }
  if (f !== null && f >= 6.8) {
    return { kind: "praise", why: "A man in this form should hear it." };
  }
  if (morale >= 70) return { kind: "challenge", why: "Happy and settled — a nudge to raise his level." };
  return { kind: "praise", why: "A quiet word of encouragement." };
}

/** The players who'd benefit most from a conversation right now. */
export function talkSuggestions(save: SaveGame, limit = 3): { player: Player; kind: PlayerTalkKind; why: string }[] {
  const out: { player: Player; kind: PlayerTalkKind; why: string }[] = [];
  for (const p of save.players) {
    if (p.clubId !== save.userClubId || p.injuredWeeks > 0) continue;
    const advice = talkAdvice(save, p);
    if (!advice) continue;
    out.push({ player: p, kind: advice.kind, why: advice.why });
  }
  return out.slice(0, limit);
}

export interface TalkOutcome {
  ok: boolean;
  message: string;
  delta: number;
  morale: number;
}

/** Have the conversation. Outcomes read the player, not a dice roll. */
export function individualTalk(
  input: SaveGame,
  playerId: string,
  kind: PlayerTalkKind
): { save: SaveGame; resp: TalkOutcome } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) {
    return { save: input, resp: { ok: false, message: "He's not your player.", delta: 0, morale: 0 } };
  }
  if (talksCooling(p, input)) {
    return {
      save: input,
      resp: { ok: false, message: "You've spoken to him recently — let it breathe for a few matches.", delta: 0, morale: p.morale ?? 60 }
    };
  }
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  const f = formOf(pp);
  const inForm = f !== null && f >= 6.8;
  const poor = f !== null && f <= 5.8;
  const morale = pp.morale ?? 60;
  let delta = 0;
  let message = "";
  let pump = 0;

  if (kind === "praise") {
    if (inForm) {
      delta = 7;
      message = `${pp.name} is buzzing — praise lands perfectly when he's playing like this.`;
    } else if (poor) {
      delta = 1;
      message = `${pp.name} nods politely, but he knows he's not playing well.`;
    } else {
      delta = 4;
      message = `${pp.name} appreciates the kind words.`;
    }
  } else if (kind === "warn") {
    if (poor) {
      delta = 6;
      message = `${pp.name} takes it on the chin — exactly the wake-up call he needed.`;
    } else if (inForm) {
      delta = -8;
      message = `${pp.name} is furious. Criticising your best performer rarely lands.`;
    } else {
      delta = -4;
      message = `${pp.name} isn't happy about being singled out.`;
    }
  } else if (kind === "reassure") {
    if (poor && morale >= 50) {
      delta = 5;
      message = `${pp.name} looks relieved — the pressure was starting to show.`;
    } else if (morale < 40) {
      delta = 1;
      message = `${pp.name} listens, but the words don't land while things are this bad.`;
    } else {
      delta = 2;
      message = `${pp.name} appreciates you taking the weight off him.`;
    }
  } else {
    // challenge: for a confident player it's fuel; for a fragile one it's a burden
    if (morale >= 60 && (inForm || morale >= 70)) {
      delta = 4;
      pump = 0.015;
      message = `${pp.name} grins: "watch me." He's out to prove a point for the next two games.`;
    } else if (morale < 45) {
      delta = -5;
      message = `${pp.name} shrinks. He has enough on his plate without being asked for more.`;
    } else {
      delta = 2;
      message = `${pp.name} takes the challenge on board.`;
    }
  }

  if (hasTrait(pp, "leader")) delta = kind === "warn" ? Math.round(delta * 0.6) : delta + 2;
  if (pp.age <= 21 && kind === "challenge") delta += 1;

  pp.morale = Math.max(0, Math.min(100, morale + delta));
  pp.lastTalk = now(save);
  pp.talkKind = kind;
  if (pump > 0) pp.pumped = { until: save.round + 2, amount: pump };
  return { save, resp: { ok: true, message, delta, morale: pp.morale } };
}

// --- pledges: promised minutes ----------------------------------------------------------------

/** "You'll get at least 30 minutes next round" — and he will remember. */
export function pledgeMinutes(input: SaveGame, playerId: string): { save: SaveGame; resp: TalkOutcome } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) {
    return { save: input, resp: { ok: false, message: "He's not your player.", delta: 0, morale: 0 } };
  }
  if (p.injuredWeeks > 0 || p.suspension > 0) {
    return { save: input, resp: { ok: false, message: "He can't play next round — don't promise what you can't deliver.", delta: 0, morale: p.morale ?? 60 } };
  }
  if (p.pledge) return { save: input, resp: { ok: false, message: "You've already promised him minutes.", delta: 0, morale: p.morale ?? 60 } };
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  pp.pledge = { round: save.round + 1, minutes: 30 };
  pp.morale = Math.min(100, (pp.morale ?? 60) + 3);
  return {
    save,
    resp: { ok: true, message: `${pp.name} is promised at least 30 minutes next round — he'll hold you to it.`, delta: 3, morale: pp.morale }
  };
}

/** At the end of the next round: did he get the minutes? */
export function settlePledges(save: SaveGame, minutesById: Record<string, number>): void {
  for (const p of save.players) {
    if (!p.pledge || p.pledge.round !== save.round) continue;
    const played = minutesById[p.id] ?? 0;
    if (played >= p.pledge.minutes) {
      p.morale = Math.min(100, (p.morale ?? 60) + 6);
      if (p.clubId === save.userClubId) pushNews(save, `You kept your word to ${p.name} — he got his ${p.pledge.minutes} minutes.`);
    } else {
      p.morale = Math.max(0, (p.morale ?? 60) - 8);
      p.unhappyRounds = (p.unhappyRounds ?? 0) + 1;
      if (p.clubId === save.userClubId) {
        pushNews(save, `${p.name} is angry — you promised him minutes and he got ${played}.`);
      }
    }
    p.pledge = undefined;
  }
}

// --- team meetings ------------------------------------------------------------------------------

export interface MeetingTheme {
  id: string;
  label: string;
  blurb: string;
  best: string;
}

export const MEETING_THEMES: MeetingTheme[] = [
  { id: "standards", label: "Hold the standards", blurb: "No let-up: the levels stay where they are.", best: "a squad in a good place" },
  { id: "together", label: "Stick together", blurb: "Rally the group through a rough patch.", best: "a poor run" },
  { id: "ambition", label: "Aim higher", blurb: "Tell them the target has moved.", best: "a push at the top" },
  { id: "badge", label: "Nobody is above the badge", blurb: "Lay the law down on commitment.", best: "unrest in the dressing room" },
  { id: "fans", label: "Give the fans something", blurb: "Lean on the crowd and the shirt.", best: "a restless crowd" },
  { id: "recover", label: "Rest and recover", blurb: "An easy week — the season is long.", best: "a tired squad" }
];

const avgMorale = (save: SaveGame): number => {
  const squad = save.players.filter((p) => p.clubId === save.userClubId);
  if (!squad.length) return 60;
  return squad.reduce((a, p) => a + (p.morale ?? 60), 0) / squad.length;
};

const avgCondition = (save: SaveGame): number => {
  const squad = save.players.filter((p) => p.clubId === save.userClubId);
  if (!squad.length) return 100;
  return squad.reduce((a, p) => a + p.condition, 0) / squad.length;
};

const leaguePos = (save: SaveGame): number => {
  const table = computeTable(save.fixtures, save.clubs);
  return table.findIndex((r) => r.clubId === save.userClubId) + 1;
};

const recentForm = (save: SaveGame): string =>
  (save.recentResults ?? [])
    .slice(0, 3)
    .map((r) => (r.gf > r.ga ? "W" : r.gf === r.ga ? "D" : "L"))
    .join("");

/** How a theme reads right now. */
export function meetingFit(save: SaveGame, themeId: string): { fit: "strong" | "even" | "risky"; why: string } {
  const morale = avgMorale(save);
  const cond = avgCondition(save);
  const pos = leaguePos(save);
  const form = recentForm(save);
  const unrest = save.players.filter((p) => p.clubId === save.userClubId && (p.transferRequest || p.transferListed)).length;
  const fans = save.media?.fans ?? 55;
  switch (themeId) {
    case "standards":
      if (morale >= 62) return { fit: "strong", why: "They're in a good place — hold them to it." };
      if (morale < 50) return { fit: "risky", why: "Standards talk to a struggling group can feel like a lecture." };
      return { fit: "even", why: "A steady message for a steady group." };
    case "together":
      if (morale < 52 || form.startsWith("LL")) return { fit: "strong", why: "They need to hear it — the run has been rough." };
      if (morale >= 70) return { fit: "risky", why: "There's no crisis here; they may wonder what you're worried about." };
      return { fit: "even", why: "Harmless, mildly useful." };
    case "ambition":
      if (pos <= 3) return { fit: "strong", why: `Sitting ${pos === 1 ? "top" : pos + "th"} — the target is real.` };
      if (pos >= 7) return { fit: "risky", why: "Talking titles from down here invites an eye-roll." };
      return { fit: "even", why: "Ambitious, if not yet credible." };
    case "badge":
      if (unrest > 0) return { fit: "strong", why: `${unrest} player${unrest === 1 ? "" : "s"} unsettled — the message lands.` };
      if (morale >= 70) return { fit: "risky", why: "A dressing-down nobody asked for." };
      return { fit: "even", why: "A reminder of who pays the wages." };
    case "fans":
      if (fans < 50) return { fit: "strong", why: "The crowd are restless — they'll respond to that." };
      if (fans >= 70) return { fit: "risky", why: "The fans are already with you; this can sound hollow." };
      return { fit: "even", why: "A standard call to arms." };
    default:
      if (cond < 70) return { fit: "strong", why: "Legs are heavy — an easy week is exactly right." };
      if (cond >= 85) return { fit: "risky", why: "They're fresh; a soft week can read as complacency." };
      return { fit: "even", why: "Sensible, if unexciting." };
  }
}

export const meetingAvailable = (save: SaveGame): boolean =>
  !save.meeting || save.season * 1000 + save.round - (save.meeting.season * 1000 + save.meeting.round) >= 2;

export interface MeetingOutcome {
  ok: boolean;
  message: string;
  fit: "strong" | "even" | "risky";
  lines: string[];
}

/** The meeting itself: the whole squad moves, with the odd exception. */
export function teamMeeting(input: SaveGame, themeId: string): { save: SaveGame; resp: MeetingOutcome } {
  const theme = MEETING_THEMES.find((t) => t.id === themeId);
  if (!theme) return { save: input, resp: { ok: false, message: "No such meeting.", fit: "even", lines: [] } };
  if (!meetingAvailable(input)) {
    return { save: input, resp: { ok: false, message: "You've had them in a meeting recently — let it settle.", fit: "even", lines: [] } };
  }
  const fit = meetingFit(input, themeId);
  const save = structuredClone(input);
  const squad = save.players.filter((p) => p.clubId === save.userClubId);
  const rng = mulberry32(hashSeed(save.seed, "meeting", save.season, save.round, themeId));
  const base = fit.fit === "strong" ? 5 : fit.fit === "even" ? 2 : -4;
  const lines: string[] = [];

  for (const p of squad) {
    let delta = base;
    if (hasTrait(p, "leader")) delta = base > 0 ? Math.round(base * 1.25) : base;
    if (p.age <= 21 && themeId === "ambition") delta += 1;
    if (themeId === "badge" && (p.transferRequest || p.transferListed)) {
      // a warning lands on the unsettled; the rest take the point
      delta += 2;
      p.unhappyRounds = Math.max(0, (p.unhappyRounds ?? 0) - 1);
    }
    if (themeId === "badge" && hasTrait(p, "leader") && p.morale !== undefined && (p.morale ?? 60) >= 75) {
      // a proud senior pro doesn't like being lectured
      delta -= 3;
      lines.push(`${p.name} bristles at being lectured.`);
    }
    if (themeId === "together" && (p.morale ?? 60) < 40 && delta > 0) {
      delta += 1; // the lowest moods get the most from it
      lines.push(`${p.name} looks up for the first time in weeks.`);
    }
    if (themeId === "recover") p.condition = Math.min(100, p.condition + 6);
    p.morale = Math.max(0, Math.min(100, (p.morale ?? 60) + delta));
  }
  // the crowd hears about it once, not once per player
  if (themeId === "fans" && base > 0 && save.media) save.media.fans = Math.min(100, save.media.fans + 3);

  save.meeting = { season: save.season, round: save.round, theme: themeId };
  const message =
    fit.fit === "strong"
      ? `${theme.label}: the room is with you. ${fit.why}`
      : fit.fit === "even"
        ? `${theme.label}: a steady meeting. ${fit.why}`
        : `${theme.label}: that landed badly. ${fit.why}`;
  pushNews(save, `Team meeting — ${theme.label.toLowerCase()}: ${fit.fit === "strong" ? "well received" : fit.fit === "even" ? "a normal week's work" : "it did not go down well"}.`);
  void rng;
  return { save, resp: { ok: true, message, fit: fit.fit, lines: lines.slice(0, 3) } };
}

// --- big matches ---------------------------------------------------------------------------------

export interface BigMatch {
  label: string;
  stakes: string;
}

/** Is this one of the fixtures that defines a season? */
export function bigMatchFor(save: SaveGame, fx: Fixture): BigMatch | null {
  if (fx.friendly || fx.round < 1) return null;
  const table = computeTable(save.fixtures, save.clubs);
  const mine = table.findIndex((r) => r.clubId === save.userClubId);
  if (mine < 0) return null;
  const oppId = fx.homeId === save.userClubId ? fx.awayId : fx.homeId;
  const theirs = table.findIndex((r) => r.clubId === oppId);
  if (theirs < 0) return null;
  const me = table[mine];
  const them = table[theirs];
  // early weeks aren't big matches yet — nobody has earned a position
  if (me.p < 3 || them.p < 3) return null;
  const rounds = (save.clubs.length - 1) * 2;
  const gap = table[0].pts - me.pts;

  if (fx.round === rounds && me.position <= 4 && gap <= 3) {
    return {
      label: "The decider",
      stakes:
        table[0].clubId === save.userClubId
          ? "One round left and you lead the league — finish the job."
          : `Last round: you're ${gap} point${gap === 1 ? "" : "s"} off the top. Win and hope.`
    };
  }
  if (theirs === 0 && mine <= 4 && me.pts >= them.pts - 4) {
    return { label: "Against the leaders", stakes: `The leaders are in town — ${gap <= 0 ? "you can go above them" : `${gap} points is the gap`}.` };
  }
  if (mine <= 3 && theirs <= 3 && Math.abs(me.pts - them.pts) <= 3) {
    return { label: "Title six-pointer", stakes: `Second play third (or better) — the winner takes the initiative.` };
  }
  return null;
}

/** Big matches lift the leaders and spook the vulnerable — raw, and loud on the pitch. */
export function bigMatchEdge(p: Player): number {
  const morale = p.morale ?? 60;
  if (hasTrait(p, "leader") || morale >= 75) return 1.02;
  if (p.age <= 21 || morale < 45) return 0.985;
  return 1;
}
