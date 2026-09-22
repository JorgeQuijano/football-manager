import type { Player, Position, RoleId } from "./types";
import { hashSeed } from "./rng";

/**
 * Per-role movement behaviour for the 2D match view. Values are the *role's*
 * instructions; player attributes scale them in `motionFor`.
 *
 * - push/drop: pitch-units beyond base toward the opponent goal (push, in
 *   possession) or toward own goal (drop, out of possession)
 * - width: lateral bias in possession, −1 = inside/central … +1 = hugs the line
 * - roam: freedom to wander around the base spot
 * - press: eagerness to close down the ball (out of possession, 0..1)
 * - support: eagerness to offer for the pass (in possession, 0..1)
 * - recovery: how hard the player runs back in transition (0..1)
 * - break: how hard the player runs forward in transition (0..1)
 */
export interface RoleMotion {
  press: number;
  support: number;
  push: number;
  drop: number;
  width: number;
  roam: number;
  recovery: number;
  break: number;
}

export const ROLE_MOTION: Record<RoleId, RoleMotion> = {
  // goalkeepers — barely leave the box
  keeper: { press: 0.05, support: 0.0, push: 0.0, drop: 0.0, width: 0.0, roam: 2, recovery: 0.2, break: 0.0 },
  sweeper: { press: 0.1, support: 0.2, push: 2.0, drop: 0.0, width: 0.0, roam: 4, recovery: 0.3, break: 0.1 },

  // defenders
  stopper: { press: 0.55, support: 0.2, push: 4, drop: 6, width: 0.0, roam: 5, recovery: 0.9, break: 0.3 },
  bpd: { press: 0.35, support: 0.5, push: 6, drop: 8, width: 0.0, roam: 6, recovery: 0.8, break: 0.4 },
  ncb: { press: 0.3, support: 0.1, push: 2, drop: 10, width: 0.0, roam: 3, recovery: 0.9, break: 0.15 },
  fb: { press: 0.6, support: 0.6, push: 9, drop: 6, width: 0.55, roam: 8, recovery: 0.9, break: 0.5 },
  wb: { press: 0.65, support: 0.8, push: 14, drop: 5, width: 0.8, roam: 10, recovery: 0.95, break: 0.65 },
  ifb: { press: 0.6, support: 0.7, push: 6, drop: 7, width: -0.5, roam: 7, recovery: 0.85, break: 0.35 },
  lib: { press: 0.25, support: 0.7, push: 8, drop: 9, width: 0.0, roam: 5, recovery: 0.8, break: 0.3 },

  // midfielders
  b2b: { press: 0.7, support: 0.85, push: 12, drop: 6, width: 0.1, roam: 12, recovery: 0.9, break: 0.7 },
  cm: { press: 0.6, support: 0.7, push: 8, drop: 7, width: 0.0, roam: 9, recovery: 0.85, break: 0.5 },
  dlp: { press: 0.4, support: 1.0, push: 4, drop: 9, width: 0.0, roam: 7, recovery: 0.75, break: 0.3 },
  anc: { press: 0.55, support: 0.6, push: 1, drop: 10, width: 0.0, roam: 4, recovery: 0.85, break: 0.2 },
  bwm: { press: 0.9, support: 0.35, push: 3, drop: 8, width: 0.0, roam: 8, recovery: 0.9, break: 0.3 },
  mez: { press: 0.6, support: 0.8, push: 11, drop: 5, width: 0.45, roam: 11, recovery: 0.8, break: 0.6 },
  playmaker: { press: 0.3, support: 1.0, push: 10, drop: 4, width: 0.2, roam: 10, recovery: 0.6, break: 0.5 },
  ss: { press: 0.45, support: 0.7, push: 15, drop: 3, width: 0.0, roam: 8, recovery: 0.6, break: 0.75 },
  w: { press: 0.55, support: 0.75, push: 12, drop: 5, width: 0.75, roam: 9, recovery: 0.8, break: 0.7 },
  iw: { press: 0.5, support: 0.75, push: 13, drop: 4, width: -0.4, roam: 8, recovery: 0.7, break: 0.75 },
  hb: { press: 0.5, support: 0.55, push: 1, drop: 10, width: 0.0, roam: 3, recovery: 0.85, break: 0.15 },
  reg: { press: 0.35, support: 1.0, push: 5, drop: 8, width: 0.0, roam: 10, recovery: 0.7, break: 0.3 },
  car: { press: 0.6, support: 0.7, push: 7, drop: 7, width: 0.35, roam: 4, recovery: 0.9, break: 0.35 },
  dw: { press: 0.9, support: 0.5, push: 8, drop: 7, width: 0.7, roam: 6, recovery: 0.95, break: 0.5 },
  treq: { press: 0.1, support: 0.95, push: 10, drop: 2, width: 0.1, roam: 14, recovery: 0.25, break: 0.45 },

  // forwards
  poacher: { press: 0.25, support: 0.5, push: 16, drop: 1, width: 0.0, roam: 4, recovery: 0.35, break: 0.8 },
  af: { press: 0.45, support: 0.55, push: 15, drop: 3, width: 0.1, roam: 6, recovery: 0.5, break: 0.85 },
  cf: { press: 0.5, support: 0.7, push: 14, drop: 4, width: 0.0, roam: 7, recovery: 0.55, break: 0.7 },
  dlf: { press: 0.4, support: 0.9, push: 11, drop: 4, width: 0.0, roam: 9, recovery: 0.6, break: 0.55 },
  target: { press: 0.35, support: 0.6, push: 13, drop: 2, width: 0.0, roam: 5, recovery: 0.4, break: 0.6 },
  presser: { press: 1.0, support: 0.5, push: 13, drop: 3, width: 0.15, roam: 10, recovery: 0.7, break: 0.75 },
  inside: { press: 0.5, support: 0.7, push: 14, drop: 4, width: -0.55, roam: 8, recovery: 0.65, break: 0.8 },
  f9: { press: 0.45, support: 1.0, push: 8, drop: 6, width: 0.0, roam: 11, recovery: 0.55, break: 0.5 }
};

export interface MotionProfile {
  speed: number; // max screen units per second (100 = length of the pitch)
  accel: number; // responsiveness (1/s)
  gk: boolean;
  roam: number;
  press: number;
  support: number;
  push: number;
  drop: number;
  width: number;
  recovery: number;
  break: number;
  seed: number; // stable per-player 0..1 phase offset so nobody moves in lockstep
}

const seedFrom = (id: string): number => (hashSeed(id) % 997) / 997;

/**
 * Fold a player's attributes and slot geometry into the role's movement
 * instructions: pace sets top speed and acceleration, physical sets stamina
 * (roaming + push), and wide slots keep the role's full width bias while
 * central slots damp it.
 */
export function motionFor(
  p: Player,
  role: RoleId,
  slot: { x: number; y: number; pos: Position }
): MotionProfile {
  const base = ROLE_MOTION[role] ?? ROLE_MOTION.cm;
  const gk = slot.pos === "GK";
  const pace = p.attrs.pace;
  const speed = gk ? 6.5 + pace * 0.035 : 8.5 + pace * 0.095;
  const accel = 3.5 + pace / 30 + p.attrs.physical / 45;
  const stam = 0.75 + p.attrs.physical / 200;
  const wide = Math.abs(slot.x - 50) >= 32;
  // trait nudges: drivers roam more, sitters push less, leaders recover harder
  const traits = p.traits ?? [];
  const roamX = traits.includes("runs_with_ball") ? 1.12 : 1;
  const pushX = traits.includes("stays_back") ? 0.85 : 1;
  const recX = traits.includes("leader") ? 1.1 : 1;
  return {
    speed,
    accel,
    gk,
    roam: base.roam * stam * (gk ? 0.5 : 1) * roamX,
    press: base.press,
    support: base.support,
    push: base.push * stam * pushX,
    drop: base.drop,
    width: wide ? base.width : base.width * 0.4,
    recovery: Math.min(1, base.recovery * recX),
    break: base.break,
    seed: seedFrom(p.id)
  };
}
