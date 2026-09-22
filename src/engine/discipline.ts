import type { Player, SaveGame } from "./types";
import { pushInbox } from "./inbox";
import { pushNews } from "./training";

/** A fifth yellow brings a one-match ban; every fifth after that, another. */
export const YELLOW_BAN_AT = 5;
/** A straight red for a reckless lunge: two matches, not one. */
export const STRAIGHT_RED_BAN = 2;

/** Which ban does this card count take him to? 0 means no new ban. */
export function banForCrossing(before: number, after: number): number {
  const was = Math.floor(before / YELLOW_BAN_AT);
  const now = Math.floor(after / YELLOW_BAN_AT);
  return now > was ? 1 : 0;
}

/** How many yellows he still has to lose before the next ban (0 = he's on the edge). */
export function yellowsToBan(p: Pick<Player, "yellows">): number {
  const y = p.yellows ?? 0;
  return YELLOW_BAN_AT - (y % YELLOW_BAN_AT);
}

/** The one-line read for a player's discipline, or null when there's nothing to say. */
export function yellowBanLine(p: Pick<Player, "yellows" | "suspension">): string | null {
  if ((p.suspension ?? 0) > 0) {
    return `${p.suspension} match${p.suspension > 1 ? "es" : ""} suspended`;
  }
  const left = yellowsToBan(p);
  if (left === 1) return "one booking from a ban";
  if (left === 2) return `${YELLOW_BAN_AT - 2} yellows — walking a tightrope`;
  return null;
}

/**
 * Apply the card consequences for one player after a match: an accumulation ban,
 * a warning when he's one booking away, and the words for the news feed.
 * Mutates the player and pushes news/inbox items; call once per player per match.
 */
export function applyCardPenalties(
  save: SaveGame,
  p: Player,
  opts: { before: number; after: number; redKind?: "straight" | "second"; notify?: boolean }
): { banned: boolean; result: string | null } {
  let banned = false;
  let result: string | null = null;
  const tell = opts.notify !== false;
  if (opts.redKind === "second") {
    p.suspension = Math.max(p.suspension ?? 0, 1);
    banned = true;
    result = `${p.name} is banned for one match after two yellows.`;
    if (!tell) return { banned, result };
    pushNews(save, result);
    pushInbox(save, {
      kind: "discipline",
      title: `${p.name} suspended — second yellow`,
      body: "Two bookings in one game is a red: one match out.",
      playerId: p.id
    });
    return { banned, result };
  }
  if (opts.redKind === "straight") {
    p.suspension = Math.max(p.suspension ?? 0, STRAIGHT_RED_BAN);
    banned = true;
    result = `${p.name} banned for ${STRAIGHT_RED_BAN} matches (red card).`;
    if (!tell) return { banned, result };
    pushNews(save, result);
    pushInbox(save, {
      kind: "discipline",
      title: `${p.name} banned — ${STRAIGHT_RED_BAN} matches`,
      body: "The red card carries a longer ban than a second booking.",
      playerId: p.id
    });
    return { banned, result };
  }
  const cross = banForCrossing(opts.before, opts.after);
  if (cross > 0) {
    p.suspension = Math.max(p.suspension ?? 0, cross);
    banned = true;
    result = `${p.name} picks up a ${cross}-match ban after his ${opts.after}th yellow of the season.`;
    if (!tell) return { banned, result };
    pushNews(save, result);
    pushInbox(save, {
      kind: "discipline",
      title: `${p.name} suspended — ${opts.after} yellows`,
      body: `${YELLOW_BAN_AT} bookings is a ban. He sits out the next match.`,
      playerId: p.id
    });
    return { banned, result };
  }
  // one from the edge: warn, exactly once per threshold
  if (!tell) return { banned, result };
  if (opts.after === YELLOW_BAN_AT - 1 && opts.after > opts.before) {
    result = `${p.name} is a booking away from a ban.`;
    pushInbox(save, {
      kind: "discipline",
      title: `${p.name} one booking from a ban`,
      body: `He's on ${opts.after} yellows — one more and he sits out.`,
      playerId: p.id
    });
  } else if (opts.after === YELLOW_BAN_AT * 2 - 1 && opts.after > opts.before) {
    result = `${p.name} is a booking away from another ban.`;
    pushInbox(save, {
      kind: "discipline",
      title: `${p.name} one booking from a ban`,
      body: `He's on ${opts.after} yellows — one more and he sits out again.`,
      playerId: p.id
    });
  }
  return { banned, result };
}

/** The players walking the tightrope: one booking from sitting out. */
export function onTheEdge(players: Player[], clubId: string): Player[] {
  return players
    .filter((p) => p.clubId === clubId && (p.suspension ?? 0) === 0 && yellowsToBan(p) === 1)
    .sort((a, b) => (b.yellows ?? 0) - (a.yellows ?? 0));
}
