import type {
  AttrKey,
  Player,
  Position,
  SaveGame,
  Scout,
  ScoutKnowledge,
  ScoutRequest,
  ScoutingState
} from "./types";
import { hashSeed, mulberry32, randInt } from "./rng";
import { overallFor, squadOf } from "./ratings";
import { marketValue, wageDemand } from "./transfers";

export const MAX_SCOUTS = 3;
/** Knowledge level at which a report is "extensive" (exact numbers). */
export const KNOWLEDGE_FULL = 75;
/** Per-round cost of an active job (charged from the scouting budget). */
export const REQUEST_COST: Record<"player" | "focus", number> = { player: 20_000, focus: 10_000 };
/** Knowledge you start with when a focus surfaces someone. */
export const DISCOVERY_LEVEL = 25;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round5 = (v: number) => Math.round(v * 2) / 2;

/** Season scouting budget derived from the transfer budget. */
export const scoutingBudgetFor = (transferBudget: number): number =>
  Math.max(300_000, Math.round((transferBudget * 0.15) / 50_000) * 50_000);

const FIRST = ["Graham", "Vic", "Ron", "Des", "Alan", "Kenny", "Terry", "Joe", "Mal", "Ray", "Frank", "Stan"];
const LAST = ["Baxter", "Cole", "Dixon", "Ellery", "Fenn", "Grove", "Hartley", "Ingram", "Jarvis", "Kirby", "Lomax", "Mercer"];

/** A deterministic scouting candidate. */
export function makeScout(seed: number, idx: number): Scout {
  const rng = mulberry32(hashSeed("scout", seed, idx));
  const judging = randInt(rng, 45, 88);
  const speed = Math.round((0.8 + rng() * 0.4) * 100) / 100;
  return {
    id: `sc-${idx}`,
    name: `${FIRST[randInt(rng, 0, FIRST.length - 1)]} ${LAST[randInt(rng, 0, LAST.length - 1)]}`,
    judging,
    speed,
    fee: Math.round((80_000 + judging * 2_400 + speed * 40_000) / 10_000) * 10_000
  };
}

/** The starting scouting department: two hired scouts + a hiring pool. */
export function initScouting(seed: number, transferBudget: number): ScoutingState {
  const all = Array.from({ length: 6 }, (_, i) => makeScout(seed, i));
  return {
    scouts: all.slice(0, 2),
    pool: all.slice(2),
    requests: [],
    knowledge: {},
    reports: [],
    shortlist: [],
    budget: scoutingBudgetFor(transferBudget)
  };
}

// --- knowledge & estimates -----------------------------------------------------------

/** 0-100: how well your club knows this player (your own players are always known). */
export function knowledgeOf(save: SaveGame, playerId: string): number {
  const p = save.players.find((x) => x.id === playerId);
  if (p && p.clubId === save.userClubId) return 100;
  return clamp(save.scouting?.knowledge?.[playerId]?.level ?? 0, 0, 100);
}

/** Average ability of your best XI — the yardstick for star ratings. */
export function squadAvgOvr(save: SaveGame): number {
  const squad = squadOf(save.players, save.userClubId).slice().sort((a, b) => overallFor(b) - overallFor(a));
  const xi = squad.slice(0, 11);
  if (!xi.length) return 60;
  return xi.reduce((sum, p) => sum + overallFor(p), 0) / xi.length;
}

/** 0.5-5 stars, relative to your squad (your average player is 2.5). */
export const starsFor = (value: number, baseline: number): number =>
  clamp(round5(2.5 + (value - baseline) / 3.2), 0.5, 5);

export type ScoreTier = "none" | "brief" | "detailed" | "extensive";

export const tierFor = (level: number): ScoreTier =>
  level >= KNOWLEDGE_FULL ? "extensive" : level >= 50 ? "detailed" : level >= DISCOVERY_LEVEL ? "brief" : "none";

export interface PlayerEstimate {
  level: number;
  tier: ScoreTier;
  scoutName: string | null;
  stars: number | null;
  starsRange: [number, number] | null;
  potStars: number | null;
  potStarsRange: [number, number] | null;
  exactOvr: number | null;
  exactPot: number | null;
  ovrRange: [number, number] | null;
  potRange: [number, number] | null;
  valueRange: [number, number] | null;
  wageRange: [number, number] | null;
  attrs: Partial<Record<AttrKey, [number, number]>> | null;
  exactFocus: AttrKey | null | undefined;
  traits: Player["traits"] | null;
}

const ATTR_KEYS: AttrKey[] = ["pace", "shooting", "passing", "defending", "physical", "reflexes", "handling"];

/**
 * What your club *thinks* it knows about a player: ranges that tighten with knowledge
 * and scout accuracy — and that a poor scout can bias in either direction.
 */
export function estimateFor(save: SaveGame, p: Player): PlayerEstimate {
  const own = p.clubId === save.userClubId;
  const k = save.scouting?.knowledge?.[p.id];
  const level = own ? 100 : clamp(k?.level ?? 0, 0, 100);
  const tier = own ? "extensive" : tierFor(level);
  const baseline = squadAvgOvr(save);
  const scout = k?.by ? save.scouting?.scouts.find((s) => s.id === k.by) ?? save.scouting?.pool.find((s) => s.id === k.by) : undefined;
  const acc = scout ? scout.judging : 60;
  const errF = 1.35 - 0.7 * (acc / 100); // 0.65 (elite) .. 1.35 (poor)
  const ovr = overallFor(p);
  const value = marketValue(p);

  if (tier === "none") {
    return {
      level,
      tier,
      scoutName: null,
      stars: null,
      starsRange: null,
      potStars: null,
      potStarsRange: null,
      exactOvr: null,
      exactPot: null,
      ovrRange: null,
      potRange: null,
      valueRange: null,
      wageRange: null,
      attrs: null,
      exactFocus: undefined,
      traits: null
    };
  }

  // a stable bias per (player, scout) — a poor scout is consistently wrong about a player
  const brng = mulberry32(hashSeed("scoutbias", p.id, scout?.id ?? "none"));
  const bias = (1 - acc / 100) * (brng() * 2 - 1) * 6;

  const estOvr = ovr + bias;
  const estPot = p.peak + bias;
  const stars = starsFor(estOvr, baseline);
  const potStars = starsFor(estPot, baseline);

  if (tier === "brief") {
    return {
      level,
      tier,
      scoutName: scout?.name ?? null,
      stars,
      starsRange: [clamp(stars - 1, 0.5, 5), clamp(stars + 1, 0.5, 5)],
      potStars,
      potStarsRange: [clamp(potStars - 1, 0.5, 5), clamp(potStars + 1, 0.5, 5)],
      exactOvr: null,
      exactPot: null,
      ovrRange: null,
      potRange: null,
      valueRange: [Math.round((value * 0.55) / 10_000) * 10_000, Math.round((value * 1.45) / 10_000) * 10_000],
      wageRange: null,
      attrs: null,
      exactFocus: undefined,
      traits: null
    };
  }

  const w = tier === "detailed" ? 6 * errF : 0;

  if (tier === "detailed") {
    return {
      level,
      tier,
      scoutName: scout?.name ?? null,
      stars,
      starsRange: [clamp(stars - 0.5, 0.5, 5), clamp(stars + 0.5, 0.5, 5)],
      potStars,
      potStarsRange: [clamp(potStars - 0.5, 0.5, 5), clamp(potStars + 0.5, 0.5, 5)],
      exactOvr: null,
      exactPot: null,
      ovrRange: [Math.round(estOvr - w / 2), Math.round(estOvr + w / 2)],
      potRange: [Math.round(estPot - w / 2), Math.round(estPot + w / 2)],
      valueRange: [
        Math.round((value * 0.8) / 10_000) * 10_000,
        Math.round((value * 1.2) / 10_000) * 10_000
      ],
      wageRange: [
        Math.round((wageDemand(p) * 0.75) / 100) * 100,
        Math.round((wageDemand(p) * 1.25) / 100) * 100
      ],
      attrs: Object.fromEntries(
        ATTR_KEYS.map((a) => [a, [Math.round(clamp(p.attrs[a] + bias - w / 2, 20, 99)), Math.round(clamp(p.attrs[a] + bias + w / 2, 20, 99))]])
      ) as Partial<Record<AttrKey, [number, number]>>,
      exactFocus: undefined,
      traits: null
    };
  }

  // extensive: exact numbers
  return {
    level,
    tier,
    scoutName: scout?.name ?? null,
    stars,
    starsRange: null,
    potStars,
    potStarsRange: null,
    exactOvr: ovr,
    exactPot: p.peak,
    ovrRange: null,
    potRange: null,
    valueRange: [Math.round((value * 0.95) / 10_000) * 10_000, Math.round((value * 1.05) / 10_000) * 10_000],
    wageRange: [p.contract.wage, p.contract.wage],
    attrs: Object.fromEntries(ATTR_KEYS.map((a) => [a, [p.attrs[a], p.attrs[a]]])) as Partial<
      Record<AttrKey, [number, number]>
    >,
    exactFocus: p.focus,
    traits: p.traits
  };
}

// --- jobs ---------------------------------------------------------------------------

export const busyScoutIds = (save: SaveGame): Set<string> =>
  new Set(save.scouting.requests.map((r) => r.scoutId));

export const freeScouts = (save: SaveGame): Scout[] => {
  const busy = busyScoutIds(save);
  return save.scouting.scouts.filter((s) => !busy.has(s.id));
};

/** Queue a full report on one player. Returns an error message, or null on success. */
export function scoutPlayer(save: SaveGame, playerId: string): string | null {
  const st = save.scouting;
  const p = save.players.find((x) => x.id === playerId);
  if (!p) return "Player not found.";
  if (p.clubId === save.userClubId) return "You already know your own players inside out.";
  if (st.requests.some((r) => r.kind === "player" && r.playerId === playerId)) return "Already scouting him.";
  if (knowledgeOf(save, playerId) >= KNOWLEDGE_FULL) return "Your reports on him are already extensive.";
  const scout = freeScouts(save)[0];
  if (!scout) return "Every scout is busy — cancel a job or hire another scout.";
  st.requests.push({ id: `sr-${save.season}-${save.round}-${st.requests.length}`, kind: "player", playerId, scoutId: scout.id });
  return null;
}

/** Start a recruitment focus (a filter your scouts work through). */
export function addFocus(
  save: SaveGame,
  filter: { pos: Position | "any"; maxAge: number; minPotStars: number }
): string | null {
  const st = save.scouting;
  const scout = freeScouts(save)[0];
  if (!scout) return "Every scout is busy — cancel a job or hire another scout.";
  st.requests.push({
    id: `sr-${save.season}-${save.round}-${st.requests.length}`,
    kind: "focus",
    scoutId: scout.id,
    pos: filter.pos,
    maxAge: clamp(Math.round(filter.maxAge), 16, 40),
    minPotStars: clamp(filter.minPotStars, 0.5, 5)
  });
  return null;
}

export function cancelRequest(save: SaveGame, id: string): void {
  save.scouting.requests = save.scouting.requests.filter((r) => r.id !== id);
}

export function hireScout(save: SaveGame, scoutId: string): string | null {
  const st = save.scouting;
  if (st.scouts.length >= MAX_SCOUTS) return `You can only employ ${MAX_SCOUTS} scouts.`;
  const cand = st.pool.find((s) => s.id === scoutId);
  if (!cand) return "He is no longer available.";
  if (st.budget < cand.fee) return `Not enough scouting budget — his fee is £${Math.round(cand.fee / 1000)}k.`;
  st.budget -= cand.fee;
  st.pool = st.pool.filter((s) => s.id !== scoutId);
  st.scouts.push(cand);
  return null;
}

export function dismissScout(save: SaveGame, scoutId: string): void {
  const st = save.scouting;
  st.scouts = st.scouts.filter((s) => s.id !== scoutId);
  st.requests = st.requests.filter((r) => r.scoutId !== scoutId);
}

export function toggleShortlist(save: SaveGame, playerId: string): void {
  const st = save.scouting;
  st.shortlist = st.shortlist.includes(playerId)
    ? st.shortlist.filter((id) => id !== playerId)
    : [playerId, ...st.shortlist].slice(0, 20);
}

/** Move money from the transfer budget into this season's scouting budget. */
export function topUpScouting(save: SaveGame, amount: number): string | null {
  const fin = save.finances[save.userClubId];
  if (!fin) return "No club finances.";
  if (fin.transfer < amount) return `Only £${Math.round(fin.transfer / 1000)}k left in the transfer budget.`;
  fin.transfer -= amount;
  save.scouting.budget += amount;
  return null;
}

// --- the weekly loop ------------------------------------------------------------------

/** Players a focus could look at: right position, young enough, good enough for the brief. */
function focusCandidates(save: SaveGame, req: Extract<ScoutRequest, { kind: "focus" }>): Player[] {
  const scout = save.scouting.scouts.find((s) => s.id === req.scoutId);
  const judging = scout?.judging ?? 60;
  const baseline = squadAvgOvr(save);
  const error = (1 - judging / 100) * 1.5; // poor scouts bring back weaker players (and miss gems)
  return save.players.filter(
    (p) =>
      p.clubId !== save.userClubId &&
      (req.pos === "any" || p.pos === req.pos) &&
      p.age <= req.maxAge &&
      starsFor(p.peak, baseline) >= req.minPotStars - error
  );
}

/**
 * One round of scouting: active jobs make progress (paid from the budget), focuses
 * surface new names and polish their best leads, knowledge fades when unwatched.
 */
export function scoutingTick(save: SaveGame): void {
  const st = save.scouting;
  if (!st) return;
  const covered = new Set<string>();
  const completed: string[] = [];

  for (const req of st.requests) {
    const scout = st.scouts.find((s) => s.id === req.scoutId);
    if (!scout) continue;
    const cost = req.kind === "player" ? REQUEST_COST.player : REQUEST_COST.focus;
    if (st.budget < cost) continue; // budget exhausted — the job pauses
    st.budget -= cost;

    if (req.kind === "player") {
      covered.add(req.playerId);
      const k: ScoutKnowledge = st.knowledge[req.playerId] ?? { level: 0, seen: save.season };
      const rng = mulberry32(hashSeed(save.seed, "scoutprog", req.playerId, save.season, save.round));
      k.level = Math.min(100, k.level + Math.round((11 + rng() * 5) * scout.speed));
      // a first look always yields at least a brief report
      if (k.level < DISCOVERY_LEVEL) k.level = DISCOVERY_LEVEL;
      k.seen = save.season;
      k.by = scout.id;
      st.knowledge[req.playerId] = k;
      if (k.level >= KNOWLEDGE_FULL) {
        completed.push(req.id);
        st.reports = [req.playerId, ...st.reports.filter((x) => x !== req.playerId)].slice(0, 12);
      }
    } else {
      const cands = focusCandidates(save, req);
      const known = cands.filter((p) => st.knowledge[p.id]);
      const fresh = cands.filter((p) => !st.knowledge[p.id] || (st.knowledge[p.id].level ?? 0) < DISCOVERY_LEVEL);
      // polish the best leads
      const polish = known
        .slice()
        .sort((a, b) => (st.knowledge[b.id]?.level ?? 0) - (st.knowledge[a.id]?.level ?? 0))
        .slice(0, 3);
      for (const p of polish) {
        const k = st.knowledge[p.id];
        k.level = Math.min(100, k.level + Math.round(5 * scout.speed));
        k.seen = save.season;
        k.by = scout.id;
        covered.add(p.id);
      }
      // surface one new name a round
      if (fresh.length) {
        const rng = mulberry32(hashSeed(save.seed, "scoutfind", req.id, save.season, save.round));
        const target = fresh[Math.floor(rng() * fresh.length)];
        st.knowledge[target.id] = { level: DISCOVERY_LEVEL, seen: save.season, by: scout.id };
        st.reports = [target.id, ...st.reports.filter((x) => x !== target.id)].slice(0, 12);
        covered.add(target.id);
      }
    }
  }

  if (completed.length) st.requests = st.requests.filter((r) => !completed.includes(r.id));

  // knowledge fades when nobody is watching (never below a brief report)
  for (const [id, k] of Object.entries(st.knowledge)) {
    if (covered.has(id) || st.shortlist.includes(id)) continue;
    const p = save.players.find((x) => x.id === id);
    if (p && p.clubId === save.userClubId) continue;
    if (k.level > DISCOVERY_LEVEL) k.level = Math.max(DISCOVERY_LEVEL, k.level - 2);
  }

  // shortlisted players get a slow trickle of fresh eyes
  for (const id of st.shortlist) {
    const k = st.knowledge[id];
    if (k && k.level < KNOWLEDGE_FULL) k.level = Math.min(KNOWLEDGE_FULL, k.level + 1);
  }
}
