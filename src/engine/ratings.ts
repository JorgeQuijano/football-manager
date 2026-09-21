import type { FormationId, Lineup, Player, Position } from "./types";
import { BENCH_SLOTS, FORMATIONS } from "./tuning";

const clamp = (v: number, lo = 1, hi = 99) => Math.round(Math.max(lo, Math.min(hi, v)));

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

export function attackScore(p: Player): number {
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

export function defenseScore(p: Player): number {
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

/** 1 = natural, lower = worse fit. Used for sorting pickers and auto-picks. */
export function suitability(p: Player, slot: Position): number {
  if ((p.pos === "GK") !== (slot === "GK")) return 0.5;
  if (p.pos === slot) return 1;
  const order: Position[] = ["DF", "MF", "FW"];
  const d = Math.abs(order.indexOf(p.pos) - order.indexOf(slot));
  return d === 1 ? 0.92 : 0.85;
}

export function isAvailable(p: Player): boolean {
  return p.injuredWeeks === 0 && p.suspension === 0;
}

/** Fill every slot of a formation with the best available player for that slot. */
export function autoLineup(players: Player[], formationId: FormationId): Lineup {
  const slots = FORMATIONS[formationId];
  const avail = players.filter(isAvailable);
  const used = new Set<string>();

  const starters = slots.map((slot) => {
    const best = avail
      .filter((p) => !used.has(p.id))
      .sort(
        (x, y) =>
          overallFor(y) * suitability(y, slot) - overallFor(x) * suitability(x, slot)
      )[0];
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

  return { formation: formationId, starters, bench, mentality: "bal" };
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
 */
export function fixLineup(players: Player[], lineup: Lineup): Lineup {
  const byId = new Map(players.map((p) => [p.id, p]));
  const used = new Set<string>();

  const takeOk = (id: string | null): string | null => {
    if (!id || used.has(id)) return null;
    const p = byId.get(id);
    if (!p || !isAvailable(p)) return null;
    used.add(id);
    return id;
  };

  const slots = FORMATIONS[lineup.formation];
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

  return { ...lineup, starters: fixed, bench: filledBench };
}

export function squadOf(players: Player[], clubId: string): Player[] {
  return players.filter((p) => p.clubId === clubId);
}

export function playerById(players: Player[], id: string): Player | undefined {
  return players.find((p) => p.id === id);
}
