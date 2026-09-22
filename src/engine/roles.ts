import type { FormationSlot, Player, PlayerAttrs, Position, RoleId } from "./types";

/**
 * Roles — an FM-style vocabulary (26 roles) where each starting slot gets one.
 * A role re-weights which attributes matter for that player's attacking and
 * defensive contribution, plus biases for shooter selection (`shot`), finishing
 * quality (`finish`) and being credited an assist (`assist`). `lane` describes
 * whether the role belongs in a wide or central slot — the UI flags off-lane
 * picks, and formation templates default to on-lane roles.
 */
export interface RoleDef {
  label: string;
  short: string;
  group: Position;
  lane: "wide" | "central" | "any";
  desc: string;
  atk: Partial<Record<keyof PlayerAttrs, number>>;
  def: Partial<Record<keyof PlayerAttrs, number>>;
  shot: number;
  finish: number;
  assist: number;
}

export const ROLE_DEFS: Record<RoleId, RoleDef> = {
  keeper: {
    label: "Shot Stopper", short: "GK", group: "GK", lane: "any",
    desc: "Stays home and makes the saves.",
    atk: {},
    def: { reflexes: 0.7, handling: 0.3 },
    shot: 0, finish: 1, assist: 1
  },
  sweeper: {
    label: "Sweeper Keeper", short: "SK", group: "GK", lane: "any",
    desc: "Plays behind the line and starts moves.",
    atk: {},
    def: { reflexes: 0.55, handling: 0.25, passing: 0.2 },
    shot: 0, finish: 1, assist: 1
  },

  stopper: {
    label: "Stopper", short: "STOP", group: "DF", lane: "central",
    desc: "Defends the box. No frills.",
    atk: { pace: 0.4, passing: 0.35, physical: 0.25 },
    def: { defending: 0.5, physical: 0.3, pace: 0.2 },
    shot: 0.5, finish: 0.95, assist: 0.7
  },
  bpd: {
    label: "Ball-Playing Defender", short: "BPD", group: "DF", lane: "central",
    desc: "Defends, then looks for the quick through-ball.",
    atk: { passing: 0.55, pace: 0.25, physical: 0.2 },
    def: { defending: 0.4, passing: 0.25, physical: 0.2, pace: 0.15 },
    shot: 0.7, finish: 0.95, assist: 1.1
  },
  ncb: {
    label: "No-Nonsense Centre-Back", short: "NCB", group: "DF", lane: "central",
    desc: "Wins it, clears it, never risks it.",
    atk: { physical: 0.45, pace: 0.3, defending: 0.25 },
    def: { defending: 0.6, physical: 0.32, pace: 0.08 },
    shot: 0.3, finish: 0.9, assist: 0.5
  },
  fb: {
    label: "Full-Back", short: "FB", group: "DF", lane: "wide",
    desc: "Keeps the defensive line stable — advances only when it's safe.",
    atk: { pace: 0.4, passing: 0.35, physical: 0.25 },
    def: { pace: 0.35, defending: 0.35, physical: 0.2, passing: 0.1 },
    shot: 0.75, finish: 0.95, assist: 1
  },
  wb: {
    label: "Wing-Back", short: "WB", group: "DF", lane: "wide",
    desc: "Bombs up the flank to put crosses in.",
    atk: { pace: 0.45, passing: 0.35, physical: 0.1, shooting: 0.1 },
    def: { pace: 0.35, defending: 0.3, physical: 0.2, passing: 0.15 },
    shot: 0.9, finish: 0.95, assist: 1.15
  },
  ifb: {
    label: "Inverted Full-Back", short: "IFB", group: "DF", lane: "central",
    desc: "Tucks in to make a back three so the other full-back can attack.",
    atk: { passing: 0.5, defending: 0.2, physical: 0.15, pace: 0.15 },
    def: { defending: 0.45, physical: 0.25, passing: 0.15, pace: 0.15 },
    shot: 0.4, finish: 0.9, assist: 0.9
  },
  lib: {
    label: "Libero", short: "LIB", group: "DF", lane: "central",
    desc: "Carries the ball out of defence.",
    atk: { passing: 0.45, pace: 0.2, physical: 0.2, shooting: 0.15 },
    def: { defending: 0.35, passing: 0.3, physical: 0.2, pace: 0.15 },
    shot: 0.8, finish: 0.9, assist: 1.15
  },

  b2b: {
    label: "Box-to-Box Midfielder", short: "B2B", group: "MF", lane: "central",
    desc: "All-action engine from box to box.",
    atk: { passing: 0.3, pace: 0.25, shooting: 0.25, defending: 0.2 },
    def: { physical: 0.35, defending: 0.3, pace: 0.2, passing: 0.15 },
    shot: 1, finish: 1, assist: 0.95
  },
  cm: {
    label: "Central Midfielder", short: "CM", group: "MF", lane: "central",
    desc: "Balanced. Links everything.",
    atk: { passing: 0.3, shooting: 0.2, pace: 0.2, defending: 0.15, physical: 0.15 },
    def: { defending: 0.3, physical: 0.25, passing: 0.25, pace: 0.2 },
    shot: 0.9, finish: 1, assist: 1
  },
  dlp: {
    label: "Deep-Lying Playmaker", short: "DLP", group: "MF", lane: "central",
    desc: "Sets the tempo from deep.",
    atk: { passing: 0.55, pace: 0.15, shooting: 0.15, physical: 0.15 },
    def: { defending: 0.3, physical: 0.25, passing: 0.3, pace: 0.15 },
    shot: 0.7, finish: 0.95, assist: 1.4
  },
  anc: {
    label: "Anchor", short: "ANC", group: "MF", lane: "central",
    desc: "Shields the back four. Breaks up play.",
    atk: { passing: 0.3, physical: 0.3, defending: 0.25, pace: 0.15 },
    def: { defending: 0.5, physical: 0.35, passing: 0.15 },
    shot: 0.35, finish: 0.9, assist: 0.8
  },
  bwm: {
    label: "Ball-Winning Midfielder", short: "BWM", group: "MF", lane: "central",
    desc: "Wins it back, gives it simple.",
    atk: { physical: 0.3, defending: 0.25, passing: 0.25, pace: 0.2 },
    def: { defending: 0.45, physical: 0.35, pace: 0.15, passing: 0.05 },
    shot: 0.55, finish: 0.95, assist: 0.7
  },
  mez: {
    label: "Mezzala", short: "MEZ", group: "MF", lane: "central",
    desc: "Drifts half-wide and arrives in the box.",
    atk: { pace: 0.3, shooting: 0.25, passing: 0.25, physical: 0.2 },
    def: { defending: 0.25, physical: 0.3, pace: 0.25, passing: 0.2 },
    shot: 1.05, finish: 1, assist: 1.1
  },
  playmaker: {
    label: "Advanced Playmaker", short: "AP", group: "MF", lane: "central",
    desc: "Runs the game between the lines.",
    atk: { passing: 0.55, shooting: 0.2, pace: 0.15, defending: 0.1 },
    def: { passing: 0.3, defending: 0.25, physical: 0.25, pace: 0.2 },
    shot: 0.85, finish: 1, assist: 1.45
  },
  ss: {
    label: "Shadow Striker", short: "SS", group: "MF", lane: "central",
    desc: "Runs beyond the striker into the box.",
    atk: { shooting: 0.35, pace: 0.3, passing: 0.2, physical: 0.15 },
    def: { defending: 0.3, physical: 0.3, passing: 0.2, pace: 0.2 },
    shot: 1.1, finish: 1.05, assist: 0.95
  },
  w: {
    label: "Winger", short: "W", group: "MF", lane: "wide",
    desc: "Beats his man and delivers.",
    atk: { pace: 0.4, passing: 0.4, shooting: 0.1, physical: 0.1 },
    def: { pace: 0.4, defending: 0.3, physical: 0.2, passing: 0.1 },
    shot: 1, finish: 0.95, assist: 1.35
  },
  iw: {
    label: "Inverted Winger", short: "IW", group: "MF", lane: "wide",
    desc: "Starts wide, cuts inside, shoots.",
    atk: { pace: 0.35, shooting: 0.35, passing: 0.2, defending: 0.1 },
    def: { pace: 0.3, defending: 0.3, physical: 0.25, passing: 0.15 },
    shot: 1.2, finish: 1.08, assist: 1.05
  },

  poacher: {
    label: "Poacher", short: "POA", group: "FW", lane: "central",
    desc: "Lives on the last shoulder. Give him a yard.",
    atk: { shooting: 0.55, pace: 0.35, passing: 0.1 },
    def: { defending: 0.45, physical: 0.4, pace: 0.15 },
    shot: 1.25, finish: 1.12, assist: 0.6
  },
  af: {
    label: "Advanced Forward", short: "AF", group: "FW", lane: "central",
    desc: "Runs the channels, leads the line.",
    atk: { shooting: 0.45, pace: 0.4, physical: 0.15 },
    def: { defending: 0.4, physical: 0.4, pace: 0.2 },
    shot: 1.15, finish: 1.05, assist: 0.85
  },
  cf: {
    label: "Complete Forward", short: "CF", group: "FW", lane: "central",
    desc: "Scores, links, battles — all of it.",
    atk: { shooting: 0.35, pace: 0.25, physical: 0.2, passing: 0.2 },
    def: { defending: 0.4, physical: 0.4, pace: 0.2 },
    shot: 1.1, finish: 1.15, assist: 0.95
  },
  dlf: {
    label: "Deep-Lying Forward", short: "DLF", group: "FW", lane: "central",
    desc: "Drops deep, holds it up, creates.",
    atk: { passing: 0.4, shooting: 0.3, physical: 0.3 },
    def: { defending: 0.35, physical: 0.45, pace: 0.2 },
    shot: 0.9, finish: 1, assist: 1.25
  },
  target: {
    label: "Target Man", short: "TM", group: "FW", lane: "central",
    desc: "Aerial focal point. Win it, hold it, finish.",
    atk: { physical: 0.45, shooting: 0.35, passing: 0.2 },
    def: { physical: 0.55, defending: 0.3, pace: 0.15 },
    shot: 0.95, finish: 1, assist: 0.8
  },
  presser: {
    label: "Pressing Forward", short: "PF", group: "FW", lane: "central",
    desc: "Hunts defenders. First line of defence.",
    atk: { pace: 0.4, shooting: 0.35, physical: 0.25 },
    def: { physical: 0.4, pace: 0.3, defending: 0.3 },
    shot: 1.05, finish: 0.95, assist: 0.8
  },
  inside: {
    label: "Inside Forward", short: "IF", group: "FW", lane: "wide",
    desc: "Wide forward who attacks the box.",
    atk: { pace: 0.35, shooting: 0.4, passing: 0.15, physical: 0.1 },
    def: { defending: 0.35, physical: 0.4, pace: 0.25 },
    shot: 1.2, finish: 1.05, assist: 0.95
  },

  hb: {
    label: "Half Back", short: "HB", group: "MF", lane: "central",
    desc: "Sits in front of the defence — drops between the centre-backs when his team attacks.",
    atk: { passing: 0.35, physical: 0.3, defending: 0.2, pace: 0.15 },
    def: { defending: 0.5, physical: 0.3, passing: 0.2 },
    shot: 0.3, finish: 0.9, assist: 0.8
  },
  reg: {
    label: "Regista", short: "REG", group: "MF", lane: "central",
    desc: "Runs the game from deep — free to try the pass nobody else sees.",
    atk: { passing: 0.6, shooting: 0.2, pace: 0.1, physical: 0.1 },
    def: { defending: 0.25, passing: 0.35, physical: 0.2, pace: 0.2 },
    shot: 0.75, finish: 0.95, assist: 1.5
  },
  car: {
    label: "Carrilero", short: "CAR", group: "MF", lane: "central",
    desc: "Shuttles across midfield, covering the flank behind an attacking full-back.",
    atk: { passing: 0.3, pace: 0.25, physical: 0.2, defending: 0.15 },
    def: { defending: 0.38, physical: 0.28, pace: 0.22, passing: 0.12 },
    shot: 0.7, finish: 0.95, assist: 0.9
  },
  treq: {
    label: "Trequartista", short: "TREQ", group: "MF", lane: "central",
    desc: "Free spirit between the lines — roams anywhere and doesn't track back.",
    atk: { passing: 0.45, shooting: 0.3, pace: 0.15, physical: 0.1 },
    def: { defending: 0.2, passing: 0.3, physical: 0.25, pace: 0.25 },
    shot: 1.0, finish: 1.08, assist: 1.4
  },
  dw: {
    label: "Defensive Winger", short: "DW", group: "MF", lane: "wide",
    desc: "Presses the full-back relentlessly and tracks him all day.",
    atk: { pace: 0.4, passing: 0.35, physical: 0.15, defending: 0.1 },
    def: { pace: 0.3, defending: 0.35, physical: 0.25, passing: 0.1 },
    shot: 0.8, finish: 0.9, assist: 1.0
  },
  f9: {
    label: "False Nine", short: "F9", group: "FW", lane: "central",
    desc: "Drops into midfield to drag defenders out, then turns and attacks the space.",
    atk: { passing: 0.45, shooting: 0.3, pace: 0.15, physical: 0.1 },
    def: { defending: 0.3, physical: 0.35, pace: 0.2, passing: 0.15 },
    shot: 1.0, finish: 1.05, assist: 1.2
  }
};

/** Roles selectable per slot position (first entry is the generic fallback). */
export const ROLE_GROUPS: Record<Position, RoleId[]> = {
  GK: ["keeper", "sweeper"],
  DF: ["stopper", "bpd", "ncb", "fb", "wb", "ifb", "lib"],
  MF: ["b2b", "cm", "dlp", "anc", "bwm", "mez", "playmaker", "ss", "w", "iw", "hb", "reg", "car", "dw", "treq"],
  FW: ["poacher", "af", "cf", "dlf", "target", "presser", "inside", "f9"]
};

export function defaultRoleFor(pos: Position): RoleId {
  return ROLE_GROUPS[pos][0];
}

/** Which lane a slot sits in (used for role fit, defaults, and UI hints). */
export function slotLane(slot: FormationSlot): "wide" | "central" | "any" {
  if (slot.pos === "GK") return "any";
  return Math.abs(slot.x - 50) >= 32 ? "wide" : "central";
}

/** Does this role suit this slot's lane? */
export function laneFits(role: RoleId, slot: FormationSlot): boolean {
  const rl = ROLE_DEFS[role].lane;
  const sl = slotLane(slot);
  return rl === "any" || sl === "any" || rl === sl;
}

/**
 * Finishing weight vectors — what counts as a good shot, per role.
 * Target men finish with physique; poachers with pure shooting.
 */
const FIN: Record<RoleId, Partial<Record<keyof PlayerAttrs, number>>> = {
  keeper: { shooting: 0.5, pace: 0.5 },
  sweeper: { shooting: 0.5, pace: 0.5 },
  stopper: { shooting: 0.55, physical: 0.45 },
  bpd: { shooting: 0.7, physical: 0.3 },
  ncb: { shooting: 0.6, physical: 0.4 },
  fb: { shooting: 0.7, pace: 0.3 },
  wb: { shooting: 0.75, pace: 0.25 },
  ifb: { shooting: 0.65, physical: 0.35 },
  lib: { shooting: 0.6, passing: 0.2, physical: 0.2 },
  b2b: { shooting: 0.7, pace: 0.15, physical: 0.15 },
  cm: { shooting: 0.7, pace: 0.15, passing: 0.15 },
  dlp: { shooting: 0.7, passing: 0.2, pace: 0.1 },
  anc: { shooting: 0.6, physical: 0.4 },
  bwm: { shooting: 0.6, physical: 0.4 },
  mez: { shooting: 0.65, pace: 0.2, physical: 0.15 },
  playmaker: { shooting: 0.7, passing: 0.2, pace: 0.1 },
  ss: { shooting: 0.75, pace: 0.25 },
  w: { shooting: 0.65, pace: 0.35 },
  iw: { shooting: 0.7, pace: 0.3 },
  poacher: { shooting: 0.8, pace: 0.2 },
  af: { shooting: 0.7, pace: 0.3 },
  cf: { shooting: 0.45, physical: 0.3, pace: 0.25 },
  dlf: { shooting: 0.6, passing: 0.2, physical: 0.2 },
  target: { shooting: 0.45, physical: 0.5, pace: 0.05 },
  presser: { shooting: 0.6, pace: 0.3, physical: 0.1 },
  inside: { shooting: 0.75, pace: 0.25 },
  hb: { shooting: 0.55, physical: 0.45 },
  reg: { shooting: 0.7, passing: 0.25, pace: 0.05 },
  car: { shooting: 0.6, pace: 0.2, physical: 0.2 },
  treq: { shooting: 0.7, passing: 0.2, pace: 0.1 },
  dw: { shooting: 0.65, pace: 0.35 },
  f9: { shooting: 0.6, passing: 0.25, physical: 0.15 }
};

const KEYS = [
  "pace",
  "shooting",
  "passing",
  "defending",
  "physical",
  "reflexes",
  "handling"
] as const satisfies readonly (keyof PlayerAttrs)[];

const dot = (a: PlayerAttrs, w: Partial<Record<keyof PlayerAttrs, number>>): number => {
  let s = 0;
  for (const k of KEYS) s += a[k] * (w[k] ?? 0);
  return s;
};

export function roleAttack(p: Player, role: RoleId): number {
  return dot(p.attrs, ROLE_DEFS[role].atk);
}

export function roleDefense(p: Player, role: RoleId): number {
  return dot(p.attrs, ROLE_DEFS[role].def);
}

export function roleFinish(p: Player, role: RoleId): number {
  return dot(p.attrs, FIN[role]);
}
