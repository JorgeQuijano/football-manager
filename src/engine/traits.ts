import type { Player, Position, TraitId } from "./types";
import { pickWeighted, type Rng } from "./rng";

/**
 * Player traits — FM-style behavioural quirks (0–2 per player) that bend the
 * match engine, the decision layer and the movement model the way a real
 * player's habits would. Traits are generated deterministically from each
 * player's id, so old saves can backfill them and nothing in the sim drifts.
 *
 * Hooks:
 *   - match.ts: shooter / assist / foul / set-piece weighting
 *   - intents.ts: decision weights (press / cover / runs / holding back)
 *   - motion.ts: roaming, push and recovery nudges
 */

export const TRAITS: Record<
  TraitId,
  { label: string; short: string; blurb: string; groups: Position[] }
> = {
  shoots_on_sight: {
    label: "Shoots on Sight",
    short: "Shoots",
    blurb: "Lets fly the moment there's half a sight of goal.",
    groups: ["MF", "FW"]
  },
  killer_balls: {
    label: "Tries Killer Balls",
    short: "Killer balls",
    blurb: "Always looks for the pass that breaks the line.",
    groups: ["DF", "MF"]
  },
  presses_hard: {
    label: "Presses Relentlessly",
    short: "Presses",
    blurb: "Hounds the ball whatever the scoreline.",
    groups: ["MF", "FW"]
  },
  marks_tightly: {
    label: "Marks Tightly",
    short: "Marks",
    blurb: "Sticks to his man and never gives him a yard.",
    groups: ["DF", "MF"]
  },
  dives_in: {
    label: "Dives Into Tackles",
    short: "Dives in",
    blurb: "Goes to ground. Wins it or gives away the free kick.",
    groups: ["DF", "MF"]
  },
  stays_back: {
    label: "Stays Back",
    short: "Holds",
    blurb: "Holds his position while others chase the game.",
    groups: ["DF", "MF"]
  },
  arrives_in_box: {
    label: "Arrives in the Box",
    short: "Arrives",
    blurb: "Makes late runs to get on the end of things.",
    groups: ["MF", "FW"]
  },
  runs_with_ball: {
    label: "Drives With the Ball",
    short: "Drives",
    blurb: "Carries it forward himself rather than passing.",
    groups: ["MF", "FW"]
  },
  dead_ball: {
    label: "Dead-Ball Specialist",
    short: "Dead-ball",
    blurb: "Corners and free kicks are his.",
    groups: ["MF", "FW"]
  },
  leader: {
    label: "Leader",
    short: "Leader",
    blurb: "Sets the standard; drags the team through spells.",
    groups: ["GK", "DF", "MF", "FW"]
  }
};

export const hasTrait = (p: Player, t: TraitId): boolean =>
  (p.traits ?? []).includes(t);

/** Deterministic per-player trait generation (0-2 traits, attribute-weighted). */
export function traitsFor(p: Pick<Player, "id" | "pos" | "attrs" | "age">, rng: Rng): TraitId[] {
  const groups = (Object.keys(TRAITS) as TraitId[]).filter((t) =>
    TRAITS[t].groups.includes(p.pos)
  );
  const w = (t: TraitId): number => {
    const a = p.attrs;
    switch (t) {
      case "shoots_on_sight":
        return Math.max(0, a.shooting - 55) + 6;
      case "killer_balls":
        return Math.max(0, a.passing - 55) + 6;
      case "presses_hard":
        return Math.max(0, (a.pace + a.physical) / 2 - 55) + 8;
      case "marks_tightly":
        return Math.max(0, a.defending - 55) + 4;
      case "dives_in":
        return Math.max(0, 62 - a.defending) + 6;
      case "stays_back":
        return Math.max(0, 68 - a.physical) + 4;
      case "arrives_in_box":
        return Math.max(0, a.shooting - 52) + 4;
      case "runs_with_ball":
        return Math.max(0, a.pace - 54) + 4;
      case "dead_ball":
        return Math.max(0, a.passing - 62) + 4;
      case "leader":
        return Math.max(0, p.age - 25) * 3 + Math.max(0, a.physical - 60) + 2;
      default:
        return 1;
    }
  };
  const roll = rng();
  const count = roll < 0.22 ? 0 : roll < 0.82 ? 1 : 2;
  const out: TraitId[] = [];
  for (let i = 0; i < count && groups.length; i++) {
    const pick = pickWeighted(rng, groups.filter((t) => !out.includes(t)), w);
    if (!pick) break;
    out.push(pick);
  }
  return out;
}
