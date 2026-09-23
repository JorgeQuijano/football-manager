import type { AttrKey, SaveGame } from "./types";
import { ATTR_KEYS } from "./training";

/**
 * The attribute display scale (v0.33.0).
 *
 * Internally an attribute is a fine-grained number (1–99, realistically 42–82
 * for a senior pro, developing in fractions of a point). Nobody can read that:
 * "is 68 good?" Nothing in the sim can tell 74 from 76 either.
 *
 * So the UI shows a 1–20 scale, the way a scout talks. Two tricks, both borrowed
 * from the genre:
 *   - the NUMBER is absolute (anchored to the world's ceiling), so 20 means
 *     "best there is" wherever you look;
 *   - the COLOUR is relative (ranked against the division you are in), so you can
 *     see at a glance who is strong *for this league*.
 *
 * Nothing here is stored: the save keeps its fine-grained values, the engine
 * keeps its resolution, and a display change can never touch a result.
 */

/** The floor the generator can produce (a filler keeper's unused attributes). */
export const ATTR20_FLOOR = 20;
/** The ceiling a player can reach: the best possible attribute in this world. */
export const ATTR20_CEILING = 96;
export const ATTR20_MAX = 20;

/** Internal → display. Monotone, clamped, and exactly anchored at both ends. */
export function to20(v: number): number {
  const t = (v - ATTR20_FLOOR) / (ATTR20_CEILING - ATTR20_FLOOR);
  return Math.max(1, Math.min(ATTR20_MAX, Math.round(1 + (ATTR20_MAX - 1) * t)));
}

/** Display → internal (midpoint of the band). Used by tests and tooltips. */
export function from20(d: number): number {
  const t = (Math.max(1, Math.min(ATTR20_MAX, d)) - 1) / (ATTR20_MAX - 1);
  return Math.round(ATTR20_FLOOR + t * (ATTR20_CEILING - ATTR20_FLOOR));
}

export type AttrBand = "elite" | "good" | "average" | "poor" | "weak";

export const BAND_LABEL: Record<AttrBand, string> = {
  elite: "Elite for this league",
  good: "Above the league",
  average: "League average",
  poor: "Below the league",
  weak: "Well below the league"
};

/** Tailwind colour per band (Tunnel theme). */
export const BAND_COLOUR: Record<AttrBand, string> = {
  elite: "text-[var(--positive)]",
  good: "text-[var(--positive)]",
  average: "text-foreground",
  poor: "text-[var(--warn)]",
  weak: "text-[var(--danger)]"
};

export const BAND_BAR: Record<AttrBand, string> = {
  elite: "bg-[var(--positive)]",
  good: "bg-[var(--positive)]",
  average: "bg-primary/50",
  poor: "bg-[var(--warn)]",
  weak: "bg-[var(--danger)]"
};

/** Per-attribute thresholds across every player in the world. Cached per save object. */
const cache = new WeakMap<SaveGame, Record<string, number[]>>();

function thresholds(save: SaveGame): Record<string, number[]> {
  const hit = cache.get(save);
  if (hit) return hit;
  const out: Record<string, number[]> = {};
  for (const k of ATTR_KEYS) {
    // keepers are ranked against keepers: an outfielder's unused handling (a 20-24
    // filler) would otherwise drag the whole scale down and make every keeper elite
    const keeperAttr = k === "reflexes" || k === "handling";
    const pool = save.players.filter((p) => (keeperAttr ? p.pos === "GK" : p.pos !== "GK"));
    const pop = pool.length >= 5 ? pool : save.players;
    const vals = pop.map((p) => p.attrs[k as AttrKey] ?? 0).sort((a, b) => b - a);
    const at = (frac: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * frac))] ?? 0;
    // [elite, good, poor, weak] cut points, high to low (values sorted descending)
    out[k] = [at(0.1), at(0.3), at(0.7), at(0.9)];
  }
  cache.set(save, out);
  return out;
}

/** Where this value sits in the division, for that attribute. */
export function attrBand(save: SaveGame, key: AttrKey, v: number): AttrBand {
  const [elite, good, poorCut, weakCut] = thresholds(save)[key] ?? [0, 0, 0, 0];
  if (v >= elite) return "elite";
  if (v >= good) return "good";
  if (v >= poorCut) return "average";
  if (v >= weakCut) return "poor";
  return "weak";
}

/** One attribute, ready for the screen. `text` is always the thing to print. */
export interface AttrDisplay {
  /** 1–20, the top of the read (for a single value: the value) */
  d: number;
  /** 1–20, the bottom of the read (same as `d` when there is no range) */
  dLo: number;
  /** what to print: "14" or "13–15" */
  text: string;
  band: AttrBand;
  label: string;
  colour: string;
}

const pack = (save: SaveGame, key: AttrKey, mid: number, d: number, dLo: number): AttrDisplay => {
  const band = attrBand(save, key, mid);
  return {
    d,
    dLo,
    text: dLo === d ? String(d) : `${dLo}–${d}`,
    band,
    label: BAND_LABEL[band],
    colour: BAND_COLOUR[band]
  };
};

/** One attribute, ready for the screen. */
export function readAttr(save: SaveGame, key: AttrKey, v: number): AttrDisplay {
  const d = to20(v);
  return pack(save, key, v, d, d);
}

/** A scouted range ([lo, hi] internal) as 1–20. Collapses when the scout is sure. */
export function readRange(save: SaveGame, key: AttrKey, lo: number, hi: number): AttrDisplay {
  return pack(save, key, (lo + hi) / 2, to20(hi), to20(lo));
}

/**
 * Overall and potential read on the same 1–20 scale as the attributes, so the
 * whole game speaks one language: an OVR of 14 is a good player, a POT of 18 is
 * a player who can become very good. (FM hides these behind stars; we show stars
 * *and* a number, but the number has to be the same dialect as the attributes.)
 */
export const to20ovr = (v: number): number => to20(v);

/** A scouted overall/potential range as text: "13–15". */
export const ovrRange20 = (lo: number, hi: number): string => {
  const a = to20(lo);
  const b = to20(hi);
  return a === b ? String(b) : `${a}–${b}`;
};

/** How full the bar is: the 1–20 band stretched over the full width. */
export function barPct(d: number): number {
  return Math.max(3, Math.min(100, ((d - 1) / (ATTR20_MAX - 1)) * 100));
}
