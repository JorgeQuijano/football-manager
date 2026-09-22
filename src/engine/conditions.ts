import type { MatchConditions, PitchDef, PitchId, RefDef, SaveGame, WeatherDef, WeatherId } from "./types";
import { hashSeed, mulberry32 } from "./rng";

/**
 * Weather: each one bends conversion, turnovers, corners, fouls and cards.
 * Everything is 1.0 = neutral, so "dry" plays exactly like the pre-0.19 engine.
 */
export const WEATHERS: Record<WeatherId, WeatherDef> = {
  dry: {
    id: "dry",
    label: "Dry",
    short: "Dry",
    tint: "#8B98A5",
    conversion: 1,
    turnover: 1,
    corner: 1,
    fouls: 1,
    cards: 1,
    blurb: "Firm and fast — perfect conditions for football."
  },
  wet: {
    id: "wet",
    label: "Wet",
    short: "Wet",
    tint: "#5BA8FF",
    conversion: 0.96,
    turnover: 1.12,
    corner: 1.08,
    fouls: 1.06,
    cards: 1.1,
    blurb: "Slick underfoot — the ball skids and the tackles fly in."
  },
  rain: {
    id: "rain",
    label: "Heavy rain",
    short: "Rain",
    tint: "#3D7EDB",
    conversion: 0.9,
    turnover: 1.3,
    corner: 1.16,
    fouls: 1.12,
    cards: 1.2,
    blurb: "Heavy rain — mistimed touches, scrambled clearances, chaos in both boxes."
  },
  wind: {
    id: "wind",
    label: "Windy",
    short: "Wind",
    tint: "#9AA6B2",
    conversion: 0.9,
    turnover: 1.05,
    corner: 0.92,
    fouls: 1,
    cards: 1.05,
    blurb: "A swirling wind turns crosses and long shots into a lottery."
  },
  frost: {
    id: "frost",
    label: "Frosty",
    short: "Frost",
    tint: "#9BE8FF",
    conversion: 0.94,
    turnover: 1.18,
    corner: 1.02,
    fouls: 1.05,
    cards: 1.1,
    blurb: "Frozen ground — hard bounces, heavy legs, and everything stings."
  }
};

/** Pitch wear grows through the season; heavy pitches make a mess of first touches. */
export const PITCHES: Record<PitchId, PitchDef> = {
  good: { id: "good", label: "Good pitch", turnover: 1, conversion: 1, blurb: "Well grassed and true." },
  worn: { id: "worn", label: "Worn pitch", turnover: 1.08, conversion: 1, blurb: "Bald patches in the goalmouths by now." },
  heavy: { id: "heavy", label: "Heavy pitch", turnover: 1.18, conversion: 0.97, blurb: "Cut up badly — the ball stops where it lands." }
};

export const REFS: RefDef[] = [
  { id: "ref-doyle", name: "M. Doyle", label: "strict", strictness: 1.45, pen: 1.25 },
  { id: "ref-whitfield", name: "A. Whitfield", label: "lenient", strictness: 0.65, pen: 0.85 },
  { id: "ref-okafor", name: "S. Okafor", label: "balanced", strictness: 1, pen: 1 },
  { id: "ref-lindqvist", name: "E. Lindqvist", label: "strict", strictness: 1.35, pen: 1.15 },
  { id: "ref-marsh", name: "T. Marsh", label: "lenient", strictness: 0.7, pen: 0.9 },
  { id: "ref-iwu", name: "C. Iwu", label: "balanced", strictness: 1.05, pen: 1 },
  { id: "ref-berisha", name: "L. Berisha", label: "balanced", strictness: 0.95, pen: 0.95 },
  { id: "ref-hartley", name: "P. Hartley", label: "strict", strictness: 1.3, pen: 1.2 }
];

/** Neutral conditions (test fixtures, legacy states): dry, a balanced ref, a good pitch. */
export const DEFAULT_CONDITIONS: MatchConditions = { weather: "dry", ref: "ref-okafor", pitch: "good" };

export const weatherOf = (id: WeatherId | undefined): WeatherDef => WEATHERS[id ?? "dry"] ?? WEATHERS.dry;
export const pitchOf = (id: PitchId | undefined): PitchDef => PITCHES[id ?? "good"] ?? PITCHES.good;
export const refOf = (id: string | undefined): RefDef => REFS.find((r) => r.id === id) ?? REFS[2];

/** The round's weather: dry most weeks, with the odd storm (seeded, same for the whole division). */
export function conditionsFor(save: Pick<SaveGame, "seed" | "season">, round: number): MatchConditions {
  const rng = mulberry32(hashSeed(save.seed, "conditions", save.season, round));
  const roll = rng();
  const weather: WeatherId =
    roll < 0.38 ? "dry" : roll < 0.64 ? "wet" : roll < 0.78 ? "rain" : roll < 0.92 ? "wind" : "frost";
  const ref = REFS[Math.floor(rng() * REFS.length)]?.id ?? REFS[2].id;
  // pitch wear grows through the season, and a soaking makes it worse
  let pitch: PitchId = round <= 6 ? "good" : round <= 12 ? "worn" : "heavy";
  if (weather === "rain" && pitch === "good") pitch = "worn";
  if (weather === "rain" && pitch === "worn") pitch = "heavy";
  return { weather, ref, pitch };
}

/** One-line summary for cards and panels, e.g. "Heavy rain · Ref: M. Doyle (strict) · Worn pitch". */
export function conditionLine(c: MatchConditions): string {
  const w = weatherOf(c.weather);
  const r = refOf(c.ref);
  const p = pitchOf(c.pitch);
  return `${w.label} · Ref: ${r.name} (${r.label}) · ${p.label}`;
}

/** The combined match modifiers for a conditions set. */
export function conditionEffects(c: MatchConditions) {
  const w = weatherOf(c.weather);
  const p = pitchOf(c.pitch);
  const r = refOf(c.ref);
  return {
    weather: w,
    pitch: p,
    ref: r,
    conversion: w.conversion * p.conversion,
    turnover: w.turnover * p.turnover,
    corner: w.corner,
    fouls: w.fouls,
    cards: w.cards * r.strictness,
    pen: r.pen
  };
}
