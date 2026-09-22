import type {
  FormationDef,
  Lineup,
  Mentality,
  Player,
  Position,
  RoleId
} from "./types";
import { BENCH_SLOTS, T } from "./tuning";
import { defaultRoleFor, laneFits, roleAttack, roleDefense, ROLE_GROUPS } from "./roles";
import { roleTemplate } from "./formations";

const clamp = (v: number, lo = 1, hi = 99) => Math.round(Math.max(lo, Math.min(hi, v)));
const cond = (p: Player) => 0.72 + 0.28 * (p.condition / 100);

export function overallFor(p: Player): number {
  const a = p.attrs;
  switch (p.pos) {
    case "GK":
      return clamp(a.reflexes * 0.55 + a.handling * 0.3 + a.physical * 0.15);
    case "DF":
      return clamp(a.defending * 0.45 + a.pace * 0.2 + a.physical * 0.2 + a.passing * 0.15);
    case "MF":
      return clamp(a.passing * 0.4 + a.pace * 0.2 + a.defending * 0.2 + a.shooting * 0.2);
    case "FW":
      return clamp(a.shooting * 0.55 + a.pace * 0.3 + a.passing * 0.15);
  }
}

/** Attack contribution. With a role, uses the role's attribute weights. */
export function attackScore(p: Player, role?: RoleId): number {
  if (role) return roleAttack(p, role);
  const a = p.attrs;
  switch (p.pos) {
    case "GK":
      return 0;
    case "DF":
      return a.pace * 0.45 + a.passing * 0.35 + a.physical * 0.2;
    case "MF":
      return a.passing * 0.4 + a.pace * 0.25 + a.shooting * 0.2 + a.defending * 0.15;
    case "FW":
      return a.shooting * 0.45 + a.pace * 0.3 + a.passing * 0.25;
  }
}

/** Defensive contribution. With a role, uses the role's attribute weights. */
export function defenseScore(p: Player, role?: RoleId): number {
  if (role) return roleDefense(p, role);
  const a = p.attrs;
  switch (p.pos) {
    case "GK":
      return a.reflexes * 0.65 + a.handling * 0.35;
    case "DF":
      return a.defending * 0.5 + a.physical * 0.25 + a.pace * 0.25;
    case "MF":
      return a.defending * 0.35 + a.physical * 0.3 + a.pace * 0.2 + a.passing * 0.15;
    case "FW":
      return a.defending * 0.4 + a.physical * 0.4 + a.pace * 0.2;
  }
}

/** Team attack strength — mean of outfield contributions, condition- and mentality-adjusted. */
export function attackStrength(players: Player[], roles: RoleId[], mentality: Mentality): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.pos === "GK") continue;
    sum += attackScore(p, roles[i] ?? defaultRoleFor(p.pos)) * cond(p);
    n++;
  }
  if (!n) return 25;
  return (sum / n) * T.mentality[mentality].att;
}

/** Team defence strength — mean across the XI. */
export function defenseStrength(players: Player[], roles: RoleId[], mentality: Mentality): number {
  if (!players.length) return 25;
  let sum = 0;
  for (let i = 0; i < players.length; i++) {
    sum += defenseScore(players[i], roles[i] ?? defaultRoleFor(players[i].pos)) * cond(players[i]);
  }
  return (sum / players.length) * T.mentality[mentality].def;
}

/** 1 = natural, lower = worse fit. Used for sorting pickers and auto-picks. */
export function suitability(p: Player, slot: Position): number {
  if ((p.pos === "GK") !== (slot === "GK")) return 0.5;
  if (p.pos === slot) return 1;
  const order: Position[] = ["DF", "MF", "FW"];
  const d = Math.abs(order.indexOf(p.pos) - order.indexOf(slot));
  return d === 1 ? 0.92 : 0.85;
}

/**
 * How good a player is for a specific slot + role + condition.
 * Used by the picker ordering, "Top pick" badges and rest suggestions.
 */
export function slotScoreFor(p: Player, slot: Position, role?: RoleId, condWeight = 0.25): number {
  const r = role ?? defaultRoleFor(slot);
  const attW = slot === "FW" ? 0.7 : slot === "MF" ? 0.5 : slot === "DF" ? 0.3 : 0.05;
  const base = attW * attackScore(p, r) + (1 - attW) * defenseScore(p, r);
  return base * suitability(p, slot) * (1 - condWeight + condWeight * (p.condition / 100));
}

export function isAvailable(p: Player): boolean {
  return p.injuredWeeks === 0 && p.suspension === 0;
}

export interface AutoPickOptions {
  freshest?: boolean;
  mentality?: Mentality;
}

/**
 * Fill every slot of a formation with the best available player.
 * `mentality` biases selection toward attack or defence; `freshest`
 * weighs condition, for rotation after a heavy schedule.
 */
export function autoLineup(players: Player[], def: FormationDef, opts: AutoPickOptions = {}): Lineup {
  const slots = def.slots.map((s) => s.pos);
  const roles = roleTemplate(def);
  const avail = players.filter(isAvailable);
  const used = new Set<string>();

  const scoreFor = (p: Player, slot: Position, i: number): number => {
    let s = overallFor(p) * suitability(p, slot);
    if (slot !== "GK" && (opts.mentality === "att" || opts.mentality === "def")) {
      const mix = 0.45;
      const r = roles[i] ?? defaultRoleFor(slot);
      const sided = opts.mentality === "att" ? attackScore(p, r) : defenseScore(p, r);
      s = (1 - mix) * s + mix * sided;
    }
    if (opts.freshest) s *= 0.55 + 0.45 * (p.condition / 100);
    return s;
  };

  const starters = slots.map((slot, i) => {
    const best = avail
      .filter((p) => !used.has(p.id))
      .sort((x, y) => scoreFor(y, slot, i) - scoreFor(x, slot, i))[0];
    if (!best) return null;
    used.add(best.id);
    return best.id;
  });

  const rest = avail
    .filter((p) => !used.has(p.id))
    .sort((x, y) => overallFor(y) - overallFor(x));
  const benchRest = rest.slice(0, BENCH_SLOTS);
  // make sure a GK rides the bench when one is available
  const benchGk = benchRest.find((p) => p.pos === "GK")
    ? null
    : rest.find((p) => p.pos === "GK");
  const bench: (string | null)[] = benchRest.map((p) => p.id);
  if (benchGk && bench.length >= BENCH_SLOTS) bench[BENCH_SLOTS - 1] = benchGk.id;
  else if (benchGk) bench.push(benchGk.id);
  while (bench.length < BENCH_SLOTS) bench.push(null);

  return { formation: def.id, starters, bench, mentality: opts.mentality ?? "bal", roles };
}

/** Problems with a user lineup — empty slots, wrong GK count, unavailable players. */
export function validateLineup(players: Player[], lineup: Lineup): string[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const problems: string[] = [];
  const starters = lineup.starters.filter((id): id is string => id !== null);
  if (starters.length < 11) problems.push(`Only ${starters.length}/11 players selected`);
  const seen = new Set<string>();
  for (const id of [...lineup.starters, ...lineup.bench]) {
    if (id === null) continue;
    if (seen.has(id)) problems.push("A player is picked twice");
    seen.add(id);
    const p = byId.get(id);
    if (!p) problems.push("Unknown player in lineup");
    else if (!isAvailable(p)) problems.push(`${p.name} is unavailable`);
  }
  const gkCount = starters.filter((id) => byId.get(id)?.pos === "GK").length;
  if (gkCount !== 1) problems.push(gkCount === 0 ? "No goalkeeper picked" : "Only one GK allowed");
  return [...new Set(problems)];
}

/**
 * Repair a lineup so it is playable: drop unavailable players, refill gaps with
 * the best available replacements. Used silently before simulating a match.
 * Slot roles are preserved and normalized.
 */
export function fixLineup(players: Player[], lineup: Lineup, def: FormationDef): Lineup {
  const byId = new Map(players.map((p) => [p.id, p]));
  const used = new Set<string>();

  const takeOk = (id: string | null): string | null => {
    if (!id || used.has(id)) return null;
    const p = byId.get(id);
    if (!p || !isAvailable(p)) return null;
    used.add(id);
    return id;
  };

  const slots = def.slots.map((s) => s.pos);
  const avail = players.filter(isAvailable);
  const starters = lineup.starters.slice(0, 11);

  // pass 1: keep what is still valid
  const kept = starters.map((id) => takeOk(id));
  // pass 2: fill empty slots
  const fixed = kept.map((id, i) => {
    if (id) return id;
    const slot = slots[i];
    const best = avail
      .filter((p) => !used.has(p.id))
      .sort(
        (x, y) =>
          overallFor(y) * suitability(y, slot) - overallFor(x) * suitability(x, slot)
      )[0];
    if (best) {
      used.add(best.id);
      return best.id;
    }
    return null;
  });

  const bench = lineup.bench.slice(0, BENCH_SLOTS).map((id) => takeOk(id));
  const filledBench = bench.map((id) => {
    if (id) return id;
    const best = avail
      .filter((p) => !used.has(p.id))
      .sort((x, y) => overallFor(y) - overallFor(x))[0];
    if (best) {
      used.add(best.id);
      return best.id;
    }
    return null;
  });

  const tpl = roleTemplate(def);
  const roles = slots.map((slot, i) => {
    const r = lineup.roles?.[i];
    return r && ROLE_GROUPS[slot].includes(r) ? r : tpl[i] ?? defaultRoleFor(slot);
  });

  return { ...lineup, starters: fixed, bench: filledBench, roles };
}

/**
 * Change formation while keeping the squad's players in place: players move to
 * the same position in the new shape where possible, overflow drops to the
 * bench, and only genuine gaps get auto-filled.
 */
export function remapLineup(
  players: Player[],
  lineup: Lineup,
  from: FormationDef,
  to: FormationDef
): Lineup {
  const oldSlots = from.slots.map((s) => s.pos);
  const newSlots = to.slots.map((s) => s.pos);
  const byId = new Map(players.map((p) => [p.id, p] as const));
  const starters: (string | null)[] = newSlots.map(() => null);
  const roles: RoleId[] = roleTemplate(to);
  const used = new Set<number>();

  for (let i = 0; i < newSlots.length; i++) {
    const want = newSlots[i];
    for (let j = 0; j < oldSlots.length; j++) {
      if (used.has(j) || oldSlots[j] !== want) continue;
      const id = lineup.starters[j];
      if (!id || !byId.has(id)) continue;
      starters[i] = id;
      const carried = lineup.roles?.[j];
      if (carried && ROLE_GROUPS[want].includes(carried) && laneFits(carried, to.slots[i])) {
        roles[i] = carried;
      }
      used.add(j);
      break;
    }
  }

  // overflow players go to empty bench spots if there is room
  const bench = [...lineup.bench];
  for (let j = 0; j < oldSlots.length; j++) {
    if (used.has(j)) continue;
    const id = lineup.starters[j];
    if (!id || !byId.has(id)) continue;
    const empty = bench.indexOf(null);
    if (empty >= 0) bench[empty] = id;
  }

  // an explicit role on a target slot (custom formations) is the formation's intent
  to.slots.forEach((slot, i) => {
    if (slot.role && ROLE_GROUPS[slot.pos].includes(slot.role)) roles[i] = slot.role;
  });

  return fixLineup(
    players,
    {
      formation: to.id,
      starters,
      bench,
      mentality: lineup.mentality,
      roles
    },
    to
  );
}

export function squadOf(players: Player[], clubId: string): Player[] {
  return players.filter((p) => p.clubId === clubId);
}

export function playerById(players: Player[], id: string): Player | undefined {
  return players.find((p) => p.id === id);
}
