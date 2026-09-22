import type { InboxItem, InboxKind, SaveGame } from "./types";

/**
 * The inbox: one feed for everything the club has to tell you. Every line the game
 * used to put in the news ticker lands here too, with a category you can filter on
 * and an unread count the UI badges.
 */

export const INBOX_CAP = 60;

export const INBOX_KINDS: { id: InboxKind; label: string }[] = [
  { id: "match", label: "Matches" },
  { id: "transfer", label: "Transfers" },
  { id: "press", label: "Press" },
  { id: "discipline", label: "Discipline" },
  { id: "board", label: "Board" },
  { id: "club", label: "Club" }
];

export function pushInbox(
  save: SaveGame,
  item: { kind: InboxKind; title: string; body?: string; playerId?: string; screen?: string; round?: number }
): void {
  save.inboxSeq = (save.inboxSeq ?? 0) + 1;
  const entry: InboxItem = {
    id: `in-${save.inboxSeq}`,
    season: save.season,
    round: item.round ?? save.round,
    kind: item.kind,
    title: item.title,
    read: false,
    ...(item.body ? { body: item.body } : {}),
    ...(item.playerId ? { playerId: item.playerId } : {}),
    ...(item.screen ? { screen: item.screen } : {})
  };
  save.inbox = [entry, ...(save.inbox ?? [])].slice(0, INBOX_CAP);
}

export const inboxFor = (save: SaveGame, kind?: InboxKind): InboxItem[] =>
  (save.inbox ?? []).filter((i) => !kind || i.kind === kind);

export const inboxUnread = (save: SaveGame): number => (save.inbox ?? []).filter((i) => !i.read).length;

export function markInboxRead(input: SaveGame, id: string): SaveGame {
  const save = structuredClone(input);
  const item = (save.inbox ?? []).find((i) => i.id === id);
  if (item) item.read = true;
  return save;
}

export function markAllInboxRead(input: SaveGame): SaveGame {
  const save = structuredClone(input);
  for (const i of save.inbox ?? []) i.read = true;
  return save;
}

/** Open an item: mark it read and tell the UI where to go. */
export function openInboxItem(input: SaveGame, id: string): { save: SaveGame; screen?: string; playerId?: string } {
  const save = markInboxRead(input, id);
  const item = (save.inbox ?? []).find((i) => i.id === id);
  return { save, screen: item?.screen, playerId: item?.playerId };
}
