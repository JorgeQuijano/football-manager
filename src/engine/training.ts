import type {
  AttrKey,
  Intensity,
  Player,
  PlayerAttrs,
  Position,
  SaveGame,
  TrainingPlan,
  TrainingUnit
} from "./types";
import { hashSeed, mulberry32, pick, randInt, type Rng } from "./rng";
import { overallFor, squadOf } from "./ratings";
import { hasTrait, TRAITS } from "./traits";

export const ATTR_KEYS: AttrKey[] = [
  "pace",
  "shooting",
  "passing",
  "defending",
  "physical",
  "reflexes",
  "handling"
];

export const ATTR_SHORT: Record<AttrKey, string> = {
  pace: "PAC",
  shooting: "SHO",
  passing: "PAS",
  defending: "DEF",
  physical: "PHY",
  reflexes: "REF",
  handling: "HAN"
};

export const ATTR_LABEL: Record<AttrKey, string> = {
  pace: "Pace",
  shooting: "Shooting",
  passing: "Passing",
  defending: "Defending",
  physical: "Physical",
  reflexes: "Reflexes",
  handling: "Handling"
};

/** Team-focus training units: label, one-line blurb, per-position attribute weights. */
export const UNITS: Record<
  TrainingUnit,
  { label: string; blurb: string; weights: Record<Position, Partial<Record<AttrKey, number>>> }
> = {
  balanced: {
    label: "Balanced",
    blurb: "An even spread across every area — no attribute is neglected.",
    weights: {
      GK: { reflexes: 0.4, handling: 0.4, physical: 0.2 },
      DF: { defending: 0.4, physical: 0.25, pace: 0.2, passing: 0.15 },
      MF: { passing: 0.35, physical: 0.2, defending: 0.2, pace: 0.15, shooting: 0.1 },
      FW: { shooting: 0.4, pace: 0.3, passing: 0.15, physical: 0.15 }
    }
  },
  attacking: {
    label: "Attacking",
    blurb: "Shooting, movement and finishing — your forwards grow fastest.",
    weights: {
      GK: { pace: 0.5, passing: 0.3, physical: 0.2 },
      DF: { passing: 0.4, pace: 0.35, physical: 0.25 },
      MF: { shooting: 0.4, passing: 0.3, pace: 0.3 },
      FW: { shooting: 0.5, pace: 0.35, physical: 0.15 }
    }
  },
  defending: {
    label: "Defending",
    blurb: "Tackling, positioning and reading the game at the back.",
    weights: {
      GK: { reflexes: 0.45, handling: 0.45, physical: 0.1 },
      DF: { defending: 0.6, physical: 0.25, pace: 0.15 },
      MF: { defending: 0.5, physical: 0.3, passing: 0.2 },
      FW: { defending: 0.6, physical: 0.4 }
    }
  },
  passing: {
    label: "Passing",
    blurb: "Ball work, distribution and keeping possession under pressure.",
    weights: {
      GK: { handling: 0.5, passing: 0.4, reflexes: 0.1 },
      DF: { passing: 0.55, defending: 0.25, physical: 0.2 },
      MF: { passing: 0.65, physical: 0.15, defending: 0.2 },
      FW: { passing: 0.55, shooting: 0.25, pace: 0.2 }
    }
  },
  physical: {
    label: "Physical",
    blurb: "Strength and stamina work — physical duels and late-game legs.",
    weights: {
      GK: { physical: 0.7, reflexes: 0.3 },
      DF: { physical: 0.7, pace: 0.3 },
      MF: { physical: 0.7, pace: 0.3 },
      FW: { physical: 0.75, pace: 0.25 }
    }
  },
  setpieces: {
    label: "Set pieces",
    blurb: "Dead-ball delivery and finishing — corners and free kicks.",
    weights: {
      GK: { handling: 0.6, physical: 0.4 },
      DF: { shooting: 0.5, physical: 0.5 },
      MF: { passing: 0.6, shooting: 0.4 },
      FW: { shooting: 0.65, passing: 0.35 }
    }
  },
  recovery: {
    label: "Recovery",
    blurb: "Light work and treatment — fresher legs, less progress on the training pitch.",
    weights: {
      GK: { reflexes: 0.5, handling: 0.5 },
      DF: { defending: 0.5, physical: 0.5 },
      MF: { passing: 0.5, physical: 0.5 },
      FW: { shooting: 0.5, pace: 0.5 }
    }
  }
};

export const INTENSITIES: Record<
  Intensity,
  { label: string; blurb: string; growth: number; recovery: number }
> = {
  light: { label: "Light", blurb: "Fresh legs, slower progress.", growth: 0.7, recovery: 1.15 },
  normal: { label: "Normal", blurb: "Balanced week-to-week work.", growth: 1.0, recovery: 1.0 },
  heavy: { label: "Heavy", blurb: "Fast progress, tired legs — and the odd training knock.", growth: 1.35, recovery: 0.8 }
};

/** Attribute points per round at neutral factors (young, playing, fresh, normal). */
const BASE = 0.16;
/** Declines are a touch slower than youth growth. */
const DECLINE_SCALE = 1.0;
/** Fraction of a match (in minutes) at which development is at full rate. */
const FULL_MINUTES = 30;

/** Growth appetite by age: strong in teens, a plateau, then decline. */
export function ageGrowth(age: number): number {
  if (age <= 18) return 1.6;
  if (age <= 21) return 1.35;
  if (age <= 23) return 1.1;
  if (age <= 26) return 0.8;
  if (age <= 29) return 0.45;
  if (age <= 31) return 0.1;
  if (age <= 33) return -0.5;
  if (age <= 35) return -1.1;
  return -1.5;
}

const minutesFactor = (minutes: number): number =>
  minutes >= FULL_MINUTES ? 1 : minutes > 0 ? 0.6 : 0.35;

const conditionFactor = (condition: number): number =>
  condition >= 70 ? 1 : condition >= 40 ? 0.75 : 0.5;

/** Which attributes decline with age (and how much of the loss lands on each). */
const DECLINE_WEIGHTS: Record<Position, Partial<Record<AttrKey, number>>> = {
  GK: { pace: 0.35, physical: 0.3, reflexes: 0.25, handling: 0.1 },
  DF: { pace: 0.45, physical: 0.35, defending: 0.12, passing: 0.08 },
  MF: { pace: 0.45, physical: 0.35, passing: 0.12, shooting: 0.08 },
  FW: { pace: 0.5, physical: 0.3, shooting: 0.12, passing: 0.08 }
};

/** The overall ceiling a player can reach (deterministic from his id). */
export function peakFor(p: Player): number {
  const ovr = overallFor(p);
  const rng = mulberry32(hashSeed(p.id, "peak"));
  const room =
    p.age <= 18
      ? 20 + Math.floor(rng() * 12)
      : p.age <= 21
        ? 13 + Math.floor(rng() * 9)
        : p.age <= 23
          ? 8 + Math.floor(rng() * 7)
          : p.age <= 26
            ? 4 + Math.floor(rng() * 5)
            : p.age <= 29
              ? 1 + Math.floor(rng() * 3)
              : rng() < 0.5
                ? 0
                : 1;
  return Math.min(96, Math.round(ovr + room));
}

/** Backfill schema v0.12 fields on any player (idempotent). */
export function ensureDev(p: Player): void {
  if (typeof p.peak !== "number" || !Number.isFinite(p.peak)) p.peak = peakFor(p);
  if (!p.dev || typeof p.dev !== "object") p.dev = {};
  if (!p.devSeason || typeof p.devSeason !== "object") p.devSeason = {};
  if (p.focus !== null && (typeof p.focus !== "string" || !ATTR_KEYS.includes(p.focus as AttrKey))) {
    p.focus = null;
  }
}

const normWeights = (w: Partial<Record<AttrKey, number>>): Partial<Record<AttrKey, number>> => {
  let sum = 0;
  for (const k of ATTR_KEYS) sum += w[k] ?? 0;
  if (sum <= 0) return {};
  const out: Partial<Record<AttrKey, number>> = {};
  for (const k of ATTR_KEYS) if ((w[k] ?? 0) > 0) out[k] = (w[k] ?? 0) / sum;
  return out;
};

const applyDelta = (p: Player, attr: AttrKey, delta: number): void => {
  const FLOOR = 20;
  const CEIL = 99;
  let acc = (p.dev[attr] ?? 0) + delta;
  let whole = 0;
  if (acc >= 1) {
    if (p.attrs[attr] < CEIL) {
      whole = 1;
      p.attrs[attr] += 1;
      acc -= 1;
    } else acc = 0.9;
  } else if (acc <= -1) {
    if (p.attrs[attr] > FLOOR) {
      whole = -1;
      p.attrs[attr] -= 1;
      acc += 1;
    } else acc = -0.9;
  }
  p.dev[attr] = acc;
  if (whole !== 0) p.devSeason[attr] = (p.devSeason[attr] ?? 0) + whole;
};

/**
 * One round of development for a single player. Mutates `p` (attrs, dev, devSeason).
 * Deterministic given the rng stream (seeded per player/season/round by the caller).
 */
export function developPlayer(p: Player, plan: TrainingPlan, minutes: number, rng: Rng): void {
  ensureDev(p);
  const ag = ageGrowth(p.age);
  const intensity = INTENSITIES[plan.intensity];
  const room = p.peak - overallFor(p);

  // --- growth (steered by the training unit + the player's individual focus) ---
  if (ag > 0 && room > 0) {
    const taper = Math.min(1, room / 4); // the last couple of points are hard
    const mood = 1 + ((p.morale ?? 60) - 60) * 0.002; // moraleDev (engine/morale.ts) — inline to avoid an import cycle
    const gain =
      BASE * ag * minutesFactor(minutes) * conditionFactor(p.condition) * intensity.growth * taper * mood;
    const w = { ...UNITS[plan.unit].weights[p.pos] };
    if (p.focus) w[p.focus] = (w[p.focus] ?? 0) + 0.6;
    const nw = normWeights(w);
    for (const k of ATTR_KEYS) {
      const share = nw[k];
      if (!share) continue;
      const jitter = 0.85 + rng() * 0.3;
      applyDelta(p, k, gain * share * jitter);
    }
  }

  // --- decline (ageing legs, mostly pace and physical) ---
  if (ag < 0) {
    const loss = BASE * -ag * DECLINE_SCALE;
    const dw = DECLINE_WEIGHTS[p.pos];
    for (const k of ATTR_KEYS) {
      const share = dw[k];
      if (!share) continue;
      const jitter = 0.85 + rng() * 0.3;
      applyDelta(p, k, -loss * share * jitter);
    }
  }
}

/** The training plan an AI club follows this season (deterministic, no storage needed). */
export function aiPlan(save: SaveGame, clubId: string): TrainingPlan {
  const rng = mulberry32(hashSeed(save.seed, "aiunit", clubId, save.season));
  const units: TrainingUnit[] = [
    "balanced",
    "attacking",
    "defending",
    "passing",
    "physical",
    "setpieces",
    "recovery"
  ];
  return { unit: pick(rng, units), intensity: "normal" };
}

export const planFor = (save: SaveGame, clubId: string): TrainingPlan =>
  clubId === save.userClubId ? save.training : clubId === "" ? { unit: "recovery", intensity: "light" } : aiPlan(save, clubId);

/**
 * A round of development for every player in the world (called from completeRound).
 * `minutesById` = minutes played in the round that just finished.
 */
export function developRound(input: SaveGame, minutesById: Record<string, number>): SaveGame {
  const save: SaveGame = structuredClone(input);
  for (const p of save.players) {
    const plan = planFor(save, p.clubId);
    const rng = mulberry32(hashSeed(save.seed, "dev", p.id, save.season, save.round));
    developPlayer(p, plan, minutesById[p.id] ?? 0, rng);
  }

  // heavy training weeks occasionally cost you a body
  if (save.training.intensity === "heavy") {
    const rng = mulberry32(hashSeed(save.seed, "devknock", save.season, save.round));
    if (rng() < 0.03) {
      const squad = squadOf(save.players, save.userClubId).filter((p) => p.injuredWeeks === 0);
      if (squad.length) {
        const victim = pick(rng, squad);
        victim.injuredWeeks = 1;
        pushNews(save, `${victim.name} picked up a knock in a heavy training week (out ~1 match).`);
      }
    }
  }
  return save;
}

export const pushNews = (save: SaveGame, line: string): void => {
  save.devNews.unshift(line);
  if (save.devNews.length > 12) save.devNews.length = 12;
};

/** Units that can teach a trait, and the attribute bar a player must clear to learn it. */
export const TRAIN_TRAITS: Record<
  TrainingUnit,
  Array<{ trait: Player["traits"][number]; attr: AttrKey; min: number }>
> = {
  balanced: [],
  attacking: [{ trait: "shoots_on_sight", attr: "shooting", min: 62 }],
  passing: [{ trait: "killer_balls", attr: "passing", min: 62 }],
  defending: [
    { trait: "marks_tightly", attr: "defending", min: 62 },
    { trait: "dives_in", attr: "physical", min: 66 }
  ],
  physical: [
    { trait: "presses_hard", attr: "physical", min: 66 },
    { trait: "arrives_in_box", attr: "shooting", min: 60 }
  ],
  setpieces: [{ trait: "dead_ball", attr: "shooting", min: 58 }],
  recovery: [{ trait: "leader", attr: "physical", min: 60 }]
};

/**
 * Season-end trait learning: young players who played regularly and trained a
 * suitable unit can pick up a related trait (max 2 traits per player).
 */
export function learnTraits(save: SaveGame): void {
  for (const p of save.players) {
    if (p.clubId === "" || p.age > 23 || p.apps < 12) continue;
    if ((p.traits?.length ?? 0) >= 2) continue;
    const plan = planFor(save, p.clubId);
    const cand = TRAIN_TRAITS[plan.unit].find(
      (c) => p.attrs[c.attr] >= c.min && !hasTrait(p, c.trait)
    );
    if (!cand) continue;
    const rng = mulberry32(hashSeed(save.seed, "learn", p.id, save.season));
    if (rng() < 0.16) {
      p.traits = [...(p.traits ?? []), cand.trait];
      if (p.clubId === save.userClubId) {
        pushNews(save, `${p.name} (${p.age}) has developed the trait ${TRAITS[cand.trait].label}.`);
      }
    }
  }
}

/** Reset the per-season development tracker (called at season rollover). */
export function resetSeasonDev(save: SaveGame): void {
  for (const p of save.players) {
    ensureDev(p);
    p.devSeason = {};
  }
}

/** A fresh academy graduate (deterministic per season/club/index). */
export function makeYouth(save: SaveGame, clubId: string, idx: number): Player {
  const season = save.season;
  const rng = mulberry32(hashSeed("youth", save.seed, clubId, season, idx));
  const pos = pick(rng, ["GK", "DF", "DF", "MF", "MF", "FW"] as const);
  const base = randInt(rng, 30, 44);
  const j = (v: number) => Math.max(20, Math.min(99, v + randInt(rng, -4, 4)));
  const attrs: PlayerAttrs =
    pos === "GK"
      ? { handling: j(base + 10), reflexes: j(base + 8), physical: j(base + 4), passing: j(base - 4), pace: j(base - 6), defending: j(base - 12), shooting: j(base - 20) }
      : pos === "DF"
        ? { defending: j(base + 10), physical: j(base + 6), pace: j(base + 2), passing: j(base - 2), shooting: j(base - 16), reflexes: j(20), handling: j(20) }
        : pos === "MF"
          ? { passing: j(base + 10), pace: j(base + 2), defending: j(base - 2), shooting: j(base - 2), physical: j(base - 4), reflexes: j(20), handling: j(20) }
          : { shooting: j(base + 10), pace: j(base + 6), passing: j(base - 4), defending: j(base - 18), physical: j(base - 2), reflexes: j(20), handling: j(20) };
  const name = `${pick(rng, ["Alfie", "Ben", "Cole", "Dex", "Eli", "Gus", "Hugo", "Ivan", "Jonah", "Kai", "Leo", "Max"])} ${pick(rng, ["Abara", "Blake", "Cross", "Dunn", "Ellis", "Field", "Gray", "Holt", "Isle", "Jones"])}`;
  const p: Player = {
    id: `py-${clubId}-${season}-${idx}`,
    clubId,
    name,
    age: randInt(rng, 16, 18),
    pos,
    attrs,
    traits: [],
    contract: { wage: 500, until: season + 3 },
    peak: 0,
    morale: 60,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: []
  };
  p.peak = Math.min(96, Math.round(overallFor(p) + 22 + Math.floor(rng() * 14)));
  return p;
}

/** Pre-season academy intake for every club (+ AI squad trimming to 26). */
export function youthIntake(save: SaveGame): void {
  if (save.players.some((p) => p.id === `py-${save.clubs[0].id}-${save.season}-0`)) return; // idempotent
  for (const club of save.clubs) {
    const rng = mulberry32(hashSeed("youthn", save.seed, club.id, save.season));
    const n = club.id === save.userClubId ? 1 : 1 + (rng() < 0.5 ? 1 : 0);
    const kids: Player[] = [];
    for (let i = 0; i < n; i++) {
      const kid = makeYouth(save, club.id, i);
      kids.push(kid);
      save.players.push(kid);
    }
    if (club.id === save.userClubId) {
      for (const k of kids) pushNews(save, `Academy: ${k.name} (${k.age}, ${k.pos}) steps up to the first team.`);
    } else {
      // AI clubs release their weakest fringe players to stay at 26
      const squad = squadOf(save.players, club.id);
      if (squad.length > 26) {
        const worst = squad
          .slice()
          .sort((a, b) => a.peak - b.peak || overallFor(a) - overallFor(b))
          .slice(0, squad.length - 26);
        for (const w of worst) {
          const live = save.players.find((x) => x.id === w.id)!;
          live.clubId = "";
        }
      }
    }
  }
}
