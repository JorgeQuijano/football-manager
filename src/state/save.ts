import { del, get, set } from "idb-keyval";
import type { SaveGame } from "@/engine";
import { defaultRoleFor, FORMATIONS, ROLE_GROUPS } from "@/engine";

const KEY = "fm-save-v1";

/** Repair saves written by older versions: backfill missing or invalid slot roles. */
export function normalizeSave(save: SaveGame): SaveGame {
  const slots = FORMATIONS[save.lineup?.formation] ?? [];
  if (slots.length) {
    const roles = save.lineup.roles;
    save.lineup.roles = slots.map((slot, i) => {
      const r = roles?.[i];
      return r && ROLE_GROUPS[slot].includes(r) ? r : defaultRoleFor(slot);
    });
  }
  return save;
}

export async function loadSave(): Promise<SaveGame | null> {
  try {
    const raw = await get<SaveGame>(KEY);
    if (!raw || raw.saveVersion !== 1 || !Array.isArray(raw.players)) return null;
    return normalizeSave(raw);
  } catch {
    return null;
  }
}

export async function persistSave(save: SaveGame | null): Promise<void> {
  try {
    if (save) await set(KEY, save);
    else await del(KEY);
  } catch {
    // storage unavailable (private mode etc.) — game still works in memory
  }
}

export function exportSaveFile(save: SaveGame): void {
  const blob = new Blob([JSON.stringify(save, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `touchline-s${save.season}-seed${save.seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseSaveFile(text: string): SaveGame | null {
  try {
    const data = JSON.parse(text);
    if (
      data &&
      data.saveVersion === 1 &&
      Array.isArray(data.clubs) &&
      Array.isArray(data.players) &&
      Array.isArray(data.fixtures)
    ) {
      return normalizeSave(data as SaveGame);
    }
    return null;
  } catch {
    return null;
  }
}
