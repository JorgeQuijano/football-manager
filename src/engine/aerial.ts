import type { Player, Position, SaveGame } from "./types";
import { hashSeed, mulberry32 } from "./rng";

/**
 * Height and the aerial game (v0.34.0).
 *
 * Height is a *public* fact — everybody can see a man is 190cm — so it lives on
 * the player, is generated deterministically from his id (no RNG-stream draws, so
 * every existing world and golden test keeps its exact values), and is shown in
 * the sheet. It never gets trained; what a manager coaches is the timing.
 *
 * The aerial score folds height and physical into one number (the way FM folds
 * height into jumping reach), and it is what decides:
 *   - who attacks a delivery from a corner or a crossed free kick,
 *   - whether he beats the best defender in the air (a duel, not a solo act),
 *   - and whether an open-play cross ends on his head.
 */

/** Typical heights in cm by position — keepers and centre-halves biggest. */
const BASE: Record<Position, [number, number]> = {
  GK: [186, 198],
  DF: [178, 195],
  MF: [169, 189],
  FW: [172, 193]
};

/** Deterministic height for a player: same id, same centimetres, always. */
export function heightFor(id: string, pos: Position): number {
  const rng = mulberry32(hashSeed("height", id, pos));
  const [lo, hi] = BASE[pos];
  // a slight bell: most players sit near the middle of their position's band
  const t = (rng() + rng() + rng()) / 3;
  return Math.round(lo + t * (hi - lo));
}

/** Fill in a height for anyone who hasn't got one (old saves, imports). */
export function ensureHeight(p: Player): number {
  if (!p.height) p.height = heightFor(p.id, p.pos);
  return p.height;
}

export const heightOf = (p: Player): number => p.height ?? heightFor(p.id, p.pos);

/** A short read for the sheet: "tower", "good in the air", "small and quick". */
export function heightLine(p: Player): string {
  const h = heightOf(p);
  if (h >= 193) return `${h} cm · a tower`;
  if (h >= 188) return `${h} cm · a handful in the air`;
  if (h >= 182) return `${h} cm`;
  if (h >= 176) return `${h} cm · neat and mobile`;
  return `${h} cm · small and quick`;
}

/**
 * 0–100 aerial score: 55% height (170cm → ~0, 198cm → ~100, normalised over the
 * real generation band) and 45% physical. This is the number that wins headers.
 */
export function aerialOf(p: Player): number {
  const h = heightOf(p);
  const hn = Math.max(0, Math.min(1, (h - 170) / 26));
  return Math.round(hn * 55 + (p.attrs.physical / 100) * 45);
}

/** Aerial, readable on the same 1–20 scale as everything else. */
export const aerial20 = (p: Player): number =>
  Math.max(1, Math.min(20, Math.round(1 + (aerialOf(p) / 100) * 19)));

/**
 * The duel: how the attacker's head compares with whoever is marking him, both
 * measured against their own side's average (so a tower against a tower is a fair
 * fight, and a tower against a small man is a mismatch). Mean-neutral by
 * construction: the goal volume of the match engine does not move because of it.
 */
export function duelFactor(att: Player, marker: Player): number {
  // both sides send their best header, so this is an absolute comparison: whoever
  // is genuinely bigger in the air wins the duel. The swing is gentle (±25% at the
  // extremes of the height range) so the match engine's goal volume does not move.
  const d = aerialOf(att) - aerialOf(marker);
  return Math.max(0.8, Math.min(1.25, 1 + d / 200));
}

/** Who is best in the air out of these players? */
export function bestAerial(players: Player[]): Player | undefined {
  return [...players].sort((a, b) => aerialOf(b) - aerialOf(a))[0];
}

/** Weight for picking a header target: tall and physical men get on the end of things. */
export function headerWeight(p: Player): number {
  const a = aerialOf(p);
  return Math.pow(a / 50, 1.6) + 0.15;
}

/** Should this open-play move be a cross aimed at a head? Wide positions cross more. */
export function crossShareFor(wideChain: boolean, hasTarget: boolean): number {
  if (!hasTarget) return 0.03;
  return wideChain ? 0.2 : 0.06;
}

/** One week of extra aerial work in training: nothing — but the coach watches it. */
export function aerialSummary(save: SaveGame, clubId: string): { best: Player | undefined; tallest: number } {
  const squad = save.players.filter((p) => p.clubId === clubId);
  return {
    best: bestAerial(squad),
    tallest: squad.reduce((m, p) => Math.max(m, heightOf(p)), 0)
  };
}
