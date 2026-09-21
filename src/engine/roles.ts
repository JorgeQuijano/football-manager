import type { Player, PlayerAttrs, Position, RoleId } from "./types";

/**
 * Roles: each starting slot gets one. A role re-weights which attributes
 * matter for that player's attacking and defensive contribution, plus small
 * shooter-selection (`shot`) and finishing (`finish`) biases.
 */
export interface RoleDef {
  label: string;
  short: string;
  group: Position;
  atk: Partial<Record<keyof PlayerAttrs, number>>;
  def: Partial<Record<keyof PlayerAttrs, number>>;
  shot: number;
  finish: number;
}

export const ROLE_DEFS: Record<RoleId, RoleDef> = {
  keeper: {
    label: "Shot Stopper", short: "GK", group: "GK",
    atk: {},
    def: { reflexes: 0.7, handling: 0.3 },
    shot: 0, finish: 1
  },
  sweeper: {
    label: "Sweeper Keeper", short: "SK", group: "GK",
    atk: {},
    def: { reflexes: 0.55, handling: 0.25, passing: 0.2 },
    shot: 0, finish: 1
  },
  stopper: {
    label: "Stopper", short: "STOP", group: "DF",
    atk: { pace: 0.4, passing: 0.35, physical: 0.25 },
    def: { defending: 0.5, physical: 0.3, pace: 0.2 },
    shot: 0.5, finish: 0.95
  },
  bpd: {
    label: "Ball-Playing Defender", short: "BPD", group: "DF",
    atk: { passing: 0.55, pace: 0.25, physical: 0.2 },
    def: { defending: 0.4, passing: 0.25, physical: 0.2, pace: 0.15 },
    shot: 0.7, finish: 0.95
  },
  wb: {
    label: "Wing-Back", short: "WB", group: "DF",
    atk: { pace: 0.45, passing: 0.35, physical: 0.1, shooting: 0.1 },
    def: { pace: 0.35, defending: 0.3, physical: 0.2, passing: 0.15 },
    shot: 0.9, finish: 0.95
  },
  b2b: {
    label: "Box-to-Box", short: "B2B", group: "MF",
    atk: { passing: 0.3, pace: 0.25, shooting: 0.25, defending: 0.2 },
    def: { physical: 0.35, defending: 0.3, pace: 0.2, passing: 0.15 },
    shot: 1, finish: 1
  },
  playmaker: {
    label: "Playmaker", short: "AP", group: "MF",
    atk: { passing: 0.55, shooting: 0.2, pace: 0.15, defending: 0.1 },
    def: { passing: 0.3, defending: 0.25, physical: 0.25, pace: 0.2 },
    shot: 0.85, finish: 1
  },
  bwm: {
    label: "Ball-Winner", short: "BWM", group: "MF",
    atk: { physical: 0.3, defending: 0.25, passing: 0.25, pace: 0.2 },
    def: { defending: 0.45, physical: 0.35, pace: 0.15, passing: 0.05 },
    shot: 0.55, finish: 0.95
  },
  poacher: {
    label: "Poacher", short: "POA", group: "FW",
    atk: { shooting: 0.55, pace: 0.35, passing: 0.1 },
    def: { defending: 0.45, physical: 0.4, pace: 0.15 },
    shot: 1.25, finish: 1.12
  },
  target: {
    label: "Target Man", short: "TM", group: "FW",
    atk: { physical: 0.45, shooting: 0.35, passing: 0.2 },
    def: { physical: 0.55, defending: 0.3, pace: 0.15 },
    shot: 0.95, finish: 1
  },
  presser: {
    label: "Pressing Forward", short: "PF", group: "FW",
    atk: { pace: 0.4, shooting: 0.35, physical: 0.25 },
    def: { physical: 0.4, pace: 0.3, defending: 0.3 },
    shot: 1.05, finish: 0.95
  }
};

/** Roles selectable per slot position (first entry is the default). */
export const ROLE_GROUPS: Record<Position, RoleId[]> = {
  GK: ["keeper", "sweeper"],
  DF: ["stopper", "bpd", "wb"],
  MF: ["b2b", "playmaker", "bwm"],
  FW: ["poacher", "target", "presser"]
};

export function defaultRoleFor(pos: Position): RoleId {
  return ROLE_GROUPS[pos][0];
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
  wb: { shooting: 0.75, pace: 0.25 },
  b2b: { shooting: 0.7, pace: 0.15, physical: 0.15 },
  playmaker: { shooting: 0.7, passing: 0.2, pace: 0.1 },
  bwm: { shooting: 0.6, physical: 0.4 },
  poacher: { shooting: 0.8, pace: 0.2 },
  target: { shooting: 0.45, physical: 0.5, pace: 0.05 },
  presser: { shooting: 0.6, pace: 0.3, physical: 0.1 }
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
