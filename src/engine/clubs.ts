import type { Club, SaveGame } from "./types";
import { CLUB_DEFS, capacityFor } from "./generate";
import { CLUB_LORE } from "./onboarding";

/**
 * Editing the clubs (v0.37).
 *
 * The twenty clubs are generated from `CLUB_DEFS` (name, short, colour) and
 * `CLUB_LORE` (city, founding year, ground, honours, identity). The manager can
 * overwrite the public details — rename a club, move it, rename its ground —
 * and the save remembers it. Blank means "the club's own" — clearing a field
 * hands it back to the generator, so an edit is never destructive.
 *
 * Only presentation and identity are editable: strength, formation and the
 * facilities stay the game's business, so a rename is never a cheat.
 */

export interface ClubEdit {
  name?: string;
  short?: string;
  color?: string;
  city?: string;
  ground?: string;
  founded?: number;
  capacity?: number;
}

export const CLUB_LIMITS = {
  name: 30,
  short: 3,
  city: 20,
  ground: 26,
  founded: [1850, 2026] as [number, number],
  capacity: [1_000, 120_000] as [number, number]
};

/** what a club starts as, before any edits */
export function defaultClub(save: SaveGame, clubId: string): Required<ClubEdit> | undefined {
  const idx = save.clubs.findIndex((c) => c.id === clubId);
  if (idx < 0) return undefined;
  const def = CLUB_DEFS[idx];
  const lore = CLUB_LORE[clubId];
  return {
    name: def?.name ?? save.clubs[idx].name,
    short: def?.short ?? save.clubs[idx].short,
    color: def?.color ?? save.clubs[idx].color,
    city: lore?.city ?? "",
    ground: lore?.stadium ?? "",
    founded: lore?.founded ?? 1900,
    // the ground's original size is the generated one, not whatever is stored now
    capacity: capacityFor(
      leagueOf(save, clubId),
      clubId,
      CLUB_LORE[clubId]?.honours ?? save.clubs[idx].honours ?? 0,
      save.clubs[idx].strength
    )
  };
}

export const cleanName = (v: string): string => v.replace(/\s+/g, " ").trim().slice(0, CLUB_LIMITS.name);
export const cleanShort = (v: string): string =>
  v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CLUB_LIMITS.short);
export const cleanCity = (v: string): string => v.replace(/\s+/g, " ").trim().slice(0, CLUB_LIMITS.city);
export const cleanGround = (v: string): string => v.replace(/\s+/g, " ").trim().slice(0, CLUB_LIMITS.ground);
export const cleanCapacity = (v: number): number =>
  Number.isFinite(v)
    ? Math.max(CLUB_LIMITS.capacity[0], Math.min(CLUB_LIMITS.capacity[1], Math.round(v / 100) * 100))
    : 12_000;

export const cleanFounded = (v: number): number =>
  Number.isFinite(v) ? Math.max(CLUB_LIMITS.founded[0], Math.min(CLUB_LIMITS.founded[1], Math.round(v))) : 1900;

const isHex = (v: string): boolean => /^#[0-9a-fA-F]{6}$/.test(v);

/** Which nation a club belongs to (its league), for re-deriving generated values. */
function leagueOf(save: SaveGame, clubId: string): string {
  if (save.clubs.some((c) => c.id === clubId)) return save.nation ?? "eng";
  for (const w of save.world ?? []) if (w.clubs.some((c) => c.id === clubId)) return w.id;
  return save.nation ?? "eng";
}

export function editClub(input: SaveGame, clubId: string, patch: ClubEdit): SaveGame {
  const save: SaveGame = structuredClone(input);
  const club = save.clubs.find((c) => c.id === clubId);
  if (!club) return save;

  if (patch.name !== undefined) {
    const name = cleanName(patch.name);
    if (name) club.name = name;
  }
  if (patch.short !== undefined) {
    const short = cleanShort(patch.short);
    if (short) club.short = short;
  }
  if (patch.color !== undefined && isHex(patch.color)) club.color = patch.color;
  if (patch.city !== undefined) {
    const city = cleanCity(patch.city);
    if (city) club.city = city;
    else delete club.city;
  }
  if (patch.ground !== undefined) {
    const ground = cleanGround(patch.ground);
    if (ground) club.ground = ground;
    else delete club.ground;
  }
  if (patch.founded !== undefined) club.founded = cleanFounded(patch.founded);
  if (patch.capacity !== undefined) club.capacity = cleanCapacity(patch.capacity);
  return save;
}

/** hand a club back to the generator — everything the manager overwrote */
export function resetClub(input: SaveGame, clubId: string): SaveGame {
  const save: SaveGame = structuredClone(input);
  const club = save.clubs.find((c) => c.id === clubId);
  const def = defaultClub(save, clubId);
  if (!club || !def) return save;
  club.name = def.name;
  club.short = def.short;
  club.color = def.color;
  if (def.capacity) club.capacity = def.capacity;
  delete club.city;
  delete club.ground;
  delete club.founded;
  return save;
}

/** has the manager touched this club? */
export function isEdited(club: Club, save: SaveGame): boolean {
  const def = defaultClub(save, club.id);
  if (!def) return false;
  return (
    club.name !== def.name ||
    club.short !== def.short ||
    club.color !== def.color ||
    !!club.city ||
    !!club.ground ||
    club.founded !== undefined ||
    (def.capacity !== undefined && club.capacity !== def.capacity)
  );
}
