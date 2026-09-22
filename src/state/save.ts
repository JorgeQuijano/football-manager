import { del, get, set } from "idb-keyval";
import type { SaveGame } from "@/engine";
import {
  autoLineup,
  builtinFormation,
  cleanSetPieces,
  contractFor,
  defaultRoleFor,
  ensureDev,
  emptyAwards,
  emptyHistory,
  emptyMedia,
  FANS_START,
  policyFor,
  HEADLINES_CAP,
  MORALE_START,
  RESPECT_START,
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
  // history & awards (v0.17): backfill, repair partially-written states
  if (!save.history || typeof save.history !== "object") {
    save.history = emptyHistory();
  } else {
    const h = save.history;
    if (!Array.isArray(h.seasons)) h.seasons = [];
    if (typeof h.titles !== "number" || !Number.isFinite(h.titles)) h.titles = 0;
    if (!h.allTime || typeof h.allTime !== "object") h.allTime = emptyHistory().allTime;
    else {
      const base = emptyHistory().allTime;
      for (const k of Object.keys(base) as Array<keyof typeof base>) {
        if (h.allTime[k] === undefined) (h.allTime as Record<string, unknown>)[k] = base[k];
      }
    }
    h.seasons = h.seasons.filter((s) => s && typeof s.season === "number" && typeof s.champion?.clubId === "string");
  }
  if (!save.awards || typeof save.awards !== "object") {
    save.awards = emptyAwards();
  } else {
    if (!Array.isArray(save.awards.rounds)) save.awards.rounds = [];
    if (save.awards.bestWin === undefined) save.awards.bestWin = null;
    save.awards.rounds = save.awards.rounds.filter((r) => r && typeof r.rating === "number");
  }
  for (const p of save.players) {
    if (p.totals !== undefined && (typeof p.totals !== "object" || p.totals === null)) delete p.totals;
    if (p.titles !== undefined && (typeof p.titles !== "number" || !Number.isFinite(p.titles))) delete p.titles;
    // morale & mood state (v0.18): old saves start neutral
    if (typeof p.morale !== "number" || !Number.isFinite(p.morale)) p.morale = MORALE_START;
    p.morale = Math.max(5, Math.min(100, p.morale));
    if (!Array.isArray(p.recentMin)) p.recentMin = [];
    p.recentMin = p.recentMin.filter((n) => typeof n === "number" && Number.isFinite(n)).slice(0, 8);
    if (typeof p.unhappyRounds !== "number" || !Number.isFinite(p.unhappyRounds)) delete p.unhappyRounds;
    if (p.transferRequest !== true) delete p.transferRequest;
    if (typeof p.lastTalk !== "number" || !Number.isFinite(p.lastTalk)) delete p.lastTalk;
    if (p.talkKind !== "praise" && p.talkKind !== "warn") delete p.talkKind;
  }
  // player detail (v0.25): match sharpness, wear, caps, retraining, moves, targets, armband
  if (!Array.isArray(save.discipline)) save.discipline = [];
  if (save.captain && !save.players.some((x) => x.id === save.captain && x.clubId === save.userClubId)) save.captain = undefined;
  if (save.vice && !save.players.some((x) => x.id === save.vice && x.clubId === save.userClubId)) save.vice = undefined;
  for (const p of save.players) {
    if (typeof p.sharpness !== "number" || p.sharpness < 0 || p.sharpness > 100) p.sharpness = 85;
    if (typeof p.jaded !== "number" || p.jaded < 0 || p.jaded > 100) p.jaded = 0;
    if (typeof p.caps !== "number" || p.caps < 0) p.caps = 0;
    if (p.altPos && !Array.isArray(p.altPos)) p.altPos = undefined;
    if (p.altPos) p.altPos = p.altPos.filter((x) => ["GK", "DF", "MF", "FW"].includes(x));
    if (p.retrain && (!["GK", "DF", "MF", "FW"].includes(p.retrain.pos) || typeof p.retrain.progress !== "number")) {
      p.retrain = undefined;
    }
    if (p.moveProgress && (typeof p.moveProgress.trait !== "string" || typeof p.moveProgress.progress !== "number")) {
      p.moveProgress = undefined;
    }
    if (p.traits && p.traits.length >= 2) {
      // someone who has his two traits isn't learning a third
      p.moveProgress = undefined;
    }
    if (p.target && !["goals", "apps", "rating"].includes(p.target.kind)) p.target = undefined;
    if (p.target && typeof p.target.value !== "number") p.target = undefined;
  }
  // market & contracts (v0.24): debts, the board's policy, pre-contracts, loan sanity
  if (!Array.isArray(save.debts)) save.debts = [];
  save.debts = save.debts.filter((d) => d && typeof d.amount === "number" && typeof d.clubId === "string");
  if (!Array.isArray(save.preContracts)) save.preContracts = [];
  save.preContracts = save.preContracts.filter((pc) => pc && typeof pc.playerId === "string" && typeof pc.wage === "number");
  if (!save.policy || typeof save.policy !== "object" || typeof save.policy.label !== "string") {
    save.policy = policyFor(save, save.season);
  }
  for (const p of save.players) {
    const c = p.contract;
    if (c && c.signingBonus !== undefined && (typeof c.signingBonus !== "number" || c.signingBonus < 0)) delete c.signingBonus;
    // a loan record must agree with where the player actually is
    if (p.loan && p.loan.toClubId !== p.clubId && p.loan.fromClubId !== p.clubId) p.loan = undefined;
  }
  if (!Array.isArray(save.recentResults)) save.recentResults = [];
  save.recentResults = save.recentResults
    .filter((r) => r && typeof r.round === "number" && typeof r.oppId === "string")
    .slice(0, 8);
  // media & press (v0.20): backfill the newsroom, repair a half-written state
  if (!save.media || typeof save.media !== "object") {
    save.media = emptyMedia();
  } else {
    const m = save.media;
    if (typeof m.fans !== "number" || !Number.isFinite(m.fans)) m.fans = FANS_START;
    if (typeof m.respect !== "number" || !Number.isFinite(m.respect)) m.respect = RESPECT_START;
    m.fans = Math.max(0, Math.min(100, m.fans));
    m.respect = Math.max(0, Math.min(100, m.respect));
    if (!Array.isArray(m.headlines)) m.headlines = [];
    m.headlines = m.headlines
      .filter((h) => h && typeof h.text === "string" && typeof h.round === "number")
      .slice(0, HEADLINES_CAP);
    if (!Array.isArray(m.promises)) m.promises = [];
    m.promises = m.promises.filter((p) => p && typeof p.round === "number");
    if (typeof m.pressCount !== "number" || !Number.isFinite(m.pressCount)) m.pressCount = 0;
    if (typeof m.skipped !== "number" || !Number.isFinite(m.skipped)) m.skipped = 0;
    const press = m.press as { questions?: unknown; idx?: unknown } | null | undefined;
    if (
      !press ||
      typeof press !== "object" ||
      !Array.isArray(press.questions) ||
      typeof press.idx !== "number" ||
      press.idx >= press.questions.length
    ) {
      m.press = null;
    }
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
