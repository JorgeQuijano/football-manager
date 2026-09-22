import type {
  CornerRoutine,
  FreeKickRoutine,
  SaveGame,
  SetPiecePlan
} from "./types";
import { hashSeed, mulberry32, pick } from "./rng";

/** Attacking corner routines: label, one-line blurb and the numbers the sim uses. */
export const CORNER_ROUTINES: Record<
  CornerRoutine,
  {
    label: string;
    blurb: string;
    /** goal-chance multiplier */
    goal: number;
    /** chance a failed corner comes straight back (second phase) */
    recycle: number;
    /** who the delivery targets */
    header: "physical" | "shooting" | "balanced";
  }
> = {
  near_post: {
    label: "Near post",
    blurb: "Flick-on at the near post — the big men attack the first ball, fewer second phases.",
    goal: 1.3,
    recycle: 0.75,
    header: "physical"
  },
  far_post: {
    label: "Far post",
    blurb: "Deep delivery to the far post — a balanced routine that keeps the second ball alive.",
    goal: 1.0,
    recycle: 1.0,
    header: "balanced"
  },
  short: {
    label: "Short corner",
    blurb: "Worked short to keep the ball — a low direct threat but the move keeps going.",
    goal: 0.35,
    recycle: 1.9,
    header: "balanced"
  },
  edge: {
    label: "Edge of the box",
    blurb: "Pulled back to the edge for a finisher — fewer headers, sharper shooting.",
    goal: 0.6,
    recycle: 1.4,
    header: "shooting"
  }
};

export const FK_ROUTINES: Record<
  FreeKickRoutine,
  { label: string; blurb: string; goal: number; delivery: boolean }
> = {
  direct: {
    label: "Shot",
    blurb: "Go for goal — your best striker of a dead ball takes it on.",
    goal: 1.0,
    delivery: false
  },
  crossed: {
    label: "Cross it in",
    blurb: "Whipped delivery into the box — a headed chance like a corner.",
    goal: 1.1,
    delivery: true
  },
  short: {
    label: "Work it short",
    blurb: "Played short to keep possession — almost never a direct threat.",
    goal: 0.2,
    delivery: false
  }
};

export const routineKey = (kind: "corner" | "freekick", routine: string): string =>
  `${kind}:${routine}`;

/** A fresh plan: the balanced default routines, no nominated takers, familiar enough to work. */
export function defaultSetPieces(): SetPiecePlan {
  return {
    corner: "far_post",
    freekick: "direct",
    takers: { corner: null, freekick: null, penalty: null },
    familiarity: { "corner:far_post": 60, "freekick:direct": 60 }
  };
}

/** AI clubs pick a routine deterministically per season (no takers, familiar). */
export function aiSetPieces(save: SaveGame, clubId: string): SetPiecePlan {
  const rng = mulberry32(hashSeed(save.seed, "aisept", clubId, save.season));
  const corner = pick(rng, ["near_post", "far_post", "short", "edge"] as CornerRoutine[]);
  const freekick = pick(rng, ["direct", "crossed", "short"] as FreeKickRoutine[]);
  return {
    corner,
    freekick,
    takers: { corner: null, freekick: null, penalty: null },
    familiarity: { [routineKey("corner", corner)]: 60, [routineKey("freekick", freekick)]: 60 }
  };
}

export const familiarityOf = (
  plan: SetPiecePlan | undefined,
  kind: "corner" | "freekick",
  routine: string
): number => Math.max(0, Math.min(100, plan?.familiarity?.[routineKey(kind, routine)] ?? 25));

/** How well a routine is grooved: 0.9 (never trained) up to 1.0 (second nature). */
export const familiarityFactor = (fam: number): number => 0.9 + 0.1 * (fam / 100);

/** Rounds of practice: the active routines get more familiar (faster if training set pieces). */
export function growFamiliarity(save: SaveGame, rounds = 1): void {
  const plan = save.setpieces;
  if (!plan) return;
  const bump = (4 + (save.training?.unit === "setpieces" ? 3 : 0)) * rounds;
  for (const [kind, routine] of [
    ["corner", plan.corner],
    ["freekick", plan.freekick]
  ] as const) {
    const key = routineKey(kind, routine);
    plan.familiarity[key] = Math.min(100, (plan.familiarity[key] ?? 25) + bump);
  }
}

/** The set-piece plan a club plays with: the user's own, or a deterministic AI routine. */
export const planForClub = (save: SaveGame, clubId: string): SetPiecePlan =>
  clubId === save.userClubId ? (save.setpieces ?? defaultSetPieces()) : aiSetPieces(save, clubId);

/** Validate/normalise a stored plan (used by normalizeSave and the UI actions). */
export function cleanSetPieces(plan: SetPiecePlan | undefined, playerIds: Set<string>): SetPiecePlan {
  const base = defaultSetPieces();
  if (!plan || typeof plan !== "object") return base;
  const corner = (["near_post", "far_post", "short", "edge"] as string[]).includes(plan.corner)
    ? plan.corner
    : base.corner;
  const freekick = (["direct", "crossed", "short"] as string[]).includes(plan.freekick)
    ? plan.freekick
    : base.freekick;
  const taker = (id: unknown) => (typeof id === "string" && playerIds.has(id) ? id : null);
  const fam: Partial<Record<string, number>> = {};
  for (const [k, v] of Object.entries(plan.familiarity ?? {})) {
    if (typeof v === "number" && Number.isFinite(v)) fam[k] = Math.max(0, Math.min(100, v));
  }
  if (fam[routineKey("corner", corner)] === undefined) fam[routineKey("corner", corner)] = 25;
  if (fam[routineKey("freekick", freekick)] === undefined) fam[routineKey("freekick", freekick)] = 25;
  return {
    corner,
    freekick,
    takers: {
      corner: taker(plan.takers?.corner),
      freekick: taker(plan.takers?.freekick),
      penalty: taker(plan.takers?.penalty)
    },
    familiarity: fam
  };
}
