import { del, get, set } from "idb-keyval";
import type { SaveGame } from "@/engine";
import {
  autoLineup,
  builtinFormation,
  cleanSetPieces,
  contractFor,
  defaultRoleFor,
  ensureDev,
  freshFinances,
  hashSeed,
  initScouting,
  mulberry32,
  resolveFormation,
  ROLE_GROUPS,
  scoutingBudgetFor,
  squadOf,
  TRAITS,
  traitsFor,
  validateFormation
} from "@/engine";

const KEY = "fm-save-v1";

/**
 * Repair saves written by older versions:
 * - backfill / validate customFormations
 * - backfill and normalize slot roles
 * - fall back to a built-in shape if the stored formation no longer exists
 */
export function normalizeSave(save: SaveGame): SaveGame {
  for (const p of save.players) {
    if (typeof p.assists !== "number") p.assists = 0;
    // traits: keep valid stored ones, otherwise regenerate deterministically
    const stored = Array.isArray(p.traits) ? p.traits : null;
    const valid = stored ? stored.filter((t) => typeof t === "string" && t in TRAITS) : null;
    if (!stored || stored.length > 2 || valid!.length !== stored.length) {
      p.traits = traitsFor(p, mulberry32(hashSeed(p.id, "traits")));
    }
    // contracts: backfill deterministically for pre-0.11 saves
    if (!p.contract || typeof p.contract.wage !== "number" || typeof p.contract.until !== "number") {
      p.contract = contractFor(p, save.season);
    }
    // training/development fields (v0.12): peak, dev accumulators, individual focus
    ensureDev(p);
    // match stats (v0.15): season accumulators, form guide, recent-match log
    if (typeof p.mins !== "number") p.mins = 0;
    if (typeof p.yellows !== "number") p.yellows = 0;
    if (typeof p.reds !== "number") p.reds = 0;
    if (typeof p.ratingSum !== "number") p.ratingSum = 0;
    if (typeof p.ratingCount !== "number") p.ratingCount = 0;
    if (!Array.isArray(p.form)) p.form = [];
    if (!Array.isArray(p.history)) p.history = [];
  }
  if (!save.training || typeof save.training !== "object") {
    save.training = { unit: "balanced", intensity: "normal" };
  }
  if (!Array.isArray(save.devNews)) save.devNews = [];
  save.setpieces = cleanSetPieces(save.setpieces, new Set(save.players.map((p) => p.id)));
  if (!save.finances || typeof save.finances !== "object") save.finances = freshFinances(save);
  // scouting (v0.16): backfill the department, drop jobs pointing at players/scouts that are gone
  if (!save.scouting || typeof save.scouting !== "object") {
    save.scouting = initScouting(save.seed, save.finances[save.userClubId]?.transfer ?? 1_000_000);
  } else {
    const sc = save.scouting;
    if (!Array.isArray(sc.scouts)) sc.scouts = [];
    if (!Array.isArray(sc.pool)) sc.pool = [];
    if (!Array.isArray(sc.requests)) sc.requests = [];
    if (!Array.isArray(sc.reports)) sc.reports = [];
    if (!Array.isArray(sc.shortlist)) sc.shortlist = [];
    if (!sc.knowledge || typeof sc.knowledge !== "object") sc.knowledge = {};
    if (typeof sc.budget !== "number" || !Number.isFinite(sc.budget)) sc.budget = scoutingBudgetFor(save.finances[save.userClubId]?.transfer ?? 1_000_000);
    const ids = new Set(save.players.map((p) => p.id));
    sc.requests = sc.requests.filter(
      (r) => r && typeof r.id === "string" && sc.scouts.some((s) => s.id === r.scoutId) && (r.kind !== "player" || ids.has(r.playerId))
    );
    sc.reports = sc.reports.filter((id) => ids.has(id));
    sc.shortlist = sc.shortlist.filter((id) => ids.has(id));
    for (const id of Object.keys(sc.knowledge)) if (!ids.has(id)) delete sc.knowledge[id];
  }
  if (!Array.isArray(save.offers)) save.offers = [];
  save.offers = save.offers.filter(
    (o) =>
      o &&
      typeof o.id === "string" &&
      typeof o.fee === "number" &&
      save.players.some((p) => p.id === o.playerId && p.clubId === save.userClubId)
  );
  if (!Array.isArray(save.transferLog)) save.transferLog = [];
  if (save.pending && !save.players.some((p) => p.id === save.pending!.playerId)) {
    save.pending = undefined;
  }
  if (!Array.isArray(save.customFormations)) save.customFormations = [];
  save.customFormations = save.customFormations.filter(
    (f) =>
      f &&
      typeof f.id === "string" &&
      typeof f.name === "string" &&
      validateFormation(f).length === 0
  );

  if (save.live) {
    const l = save.live;
    const fx = l?.state
      ? save.fixtures.find(
          (f) =>
            f.round === l.state.round &&
            f.homeId === l.state.homeId &&
            f.awayId === l.state.awayId &&
            !f.played
        )
      : undefined;
    const ok =
      !!fx &&
      l.state.round === save.round &&
      !!l.base &&
      !!l.state &&
      Array.isArray(l.changes) &&
      Array.isArray(l.state.timeline) &&
      (l.half === 1 || l.half === 2) &&
      typeof l.playhead === "number" &&
      typeof l.state.minute === "number";
    if (!ok) save.live = undefined;
    else l.playhead = Math.max(0, Math.min(l.state.total, l.playhead));
  }

  const def = resolveFormation(save.lineup?.formation, save.customFormations);
  if (!def) {
    save.lineup = autoLineup(squadOf(save.players, save.userClubId), builtinFormation("4-3-3"), {
      mentality: save.lineup?.mentality ?? "bal"
    });
    return save;
  }

  const slots = def.slots.map((s) => s.pos);
  const roles = save.lineup.roles;
  save.lineup.roles = slots.map((slot, i) => {
    const r = roles?.[i];
    return r && ROLE_GROUPS[slot].includes(r) ? r : defaultRoleFor(slot);
  });
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
