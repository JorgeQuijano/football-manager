/**
 * Match-feel motion layer (v0.31.0). Presentation only: nothing here feeds back
 * into the simulation, so results stay deterministic — this is purely how the
 * twenty-two bodies travel between the positions the engine already chose.
 *
 * A player is a point with velocity, an acceleration budget and a turn rate.
 * He picks a gait (walk / jog / run / sprint), leans into acceleration, faces the
 * ball when he is close to it, and dances on the spot when he is standing off.
 */

export interface Motion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** visual facing, radians; 0 = toward +x (right on screen) */
  heading: number;
  /** physical direction of travel (the steering angle the velocity follows) */
  steer: number;
  /** 0..1 — how hard he is moving, for lean and bob */
  effort: number;
  /** footfall phase, advanced by distance travelled */
  step: number;
}

export const newMotion = (x: number, y: number, heading = Math.PI / 2): Motion => ({
  x,
  y,
  vx: 0,
  vy: 0,
  heading,
  steer: heading,
  effort: 0,
  step: 0
});

/** Gait bands in pitch units per second (the pitch is 100 long, so ≈ metres). */
export const GAIT = { walk: 1.7, jog: 3.6, run: 6.4, sprint: 8.8 };

/** Which band is he in? Used for the lean, the bob and the commentary feel. */
export function gaitBand(speed: number): "stand" | "walk" | "jog" | "run" | "sprint" {
  if (speed < 0.25) return "stand";
  if (speed < GAIT.walk + 0.55) return "walk";
  if (speed < GAIT.jog + 1.1) return "jog";
  if (speed < GAIT.run + 1.2) return "run";
  return "sprint";
}

export interface StepOpts {
  dt: number;
  /** top speed multiplier from pace, role and instructions (≈0.8–1.15) */
  pace: number;
  /** 0-100 legs: tired players fade late (engine/match.ts stamina) */
  stamina: number;
  /** how badly he wants to get there right now (1 = normal) */
  urgency: number;
  /** standing off an opponent: hold a jockey distance instead of arriving */
  jockey?: boolean;
  /** face the ball when he is within this many units (default 5) */
  faceX?: number;
  faceY?: number;
  /** he is on the ball: keep the ball slightly ahead and slow the arrival */
  carrying?: boolean;
  /** keep this far from the target (jockey) */
  standOff?: number;
}

const lerpAngle = (a: number, b: number, t: number): number => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, Math.max(0, t));
};

const norm = (a: number): number => {
  let x = a % (Math.PI * 2);
  if (x > Math.PI) x -= Math.PI * 2;
  if (x < -Math.PI) x += Math.PI * 2;
  return x;
};

/**
 * Advance one player toward a target. Speed is capped by gait and stamina,
 * acceleration is capped per frame (so he eases in and out), and he cannot
 * change direction faster than his turn rate — which is what makes the arcs.
 */
export function stepPlayer(m: Motion, tx: number, ty: number, o: StepOpts): void {
  const dt = Math.min(0.05, o.dt);
  let dx = tx - m.x;
  let dy = ty - m.y;
  let dist = Math.hypot(dx, dy);

  // stand-off: a jockeying defender wants a gap, not the shirt
  const standOff = o.jockey ? Math.max(0.9, o.standOff ?? 1.15) : (o.standOff ?? 0);
  if (standOff > 0 && dist > 0.001 && dist < standOff * 3) {
    const want = dist - standOff;
    dx = (dx / dist) * want;
    dy = (dy / dist) * want;
    dist = Math.abs(want);
  }

  // how fast could he be going right now
  const staminaScale = 0.84 + 0.16 * Math.min(1, Math.max(0, o.stamina / 100));
  const top = GAIT.sprint * o.pace * staminaScale * Math.min(1.25, Math.max(0.55, o.urgency));
  const speedNow = Math.hypot(m.vx, m.vy);

  // arrive smoothly: ease down hard over the last couple of units, hold a jockey stand-off
  let want: number;
  if (o.carrying) want = Math.min(top * 0.72, Math.max(0.9, dist * 1.5));
  else if (dist < 2.5) want = Math.max(0, dist - 0.08) * 2.0;
  else want = Math.min(top, dist * 1.35);
  want = Math.min(want, top);

  // direction we would like to travel
  const dirX = dist > 0.02 ? dx / dist : Math.cos(m.heading);
  const dirY = dist > 0.02 ? dy / dist : Math.sin(m.heading);

  // steering: rotate toward the wanted heading, limited by turn rate
  const wantedHeading = Math.atan2(dirY, dirX);
  const angleErr = Math.abs(norm(wantedHeading - m.heading));
  // up close he turns on a sixpence (the bearing spins fast near the target);
  // out in the open a turn at speed is a wide arc
  const near = Math.min(1, dist / 3);
  const turnRate = (13 - 7 * Math.min(1, speedNow / GAIT.sprint)) + 14 * (1 - near);
  // the steering angle is state: rotate it toward the bearing and travel along it
  m.steer = lerpAngle(m.steer, wantedHeading, dt * turnRate);
  const heading = m.steer;

  // acceleration budget: heavier when starting, lighter when already flying
  const accel = 7.4 * o.pace * (1.25 - 0.45 * Math.min(1, speedNow / GAIT.sprint));
  // he mostly runs where he is looking, but a footballer also adjusts his path:
  // a share of the acceleration goes straight down the line to the target, and
  // that share grows as he closes in, so he settles instead of orbiting
  const direct = 0.28 + 0.3 * (1 - near);
  const ax = (Math.cos(heading) * (1 - direct) + dirX * direct) * accel;
  const ay = (Math.sin(heading) * (1 - direct) + dirY * direct) * accel;
  let vx = m.vx + ax * dt;
  let vy = m.vy + ay * dt;

  // a sharp change of direction costs him speed, like a real player chopping his feet
  const cruise = want * (1 - 0.45 * Math.min(1, angleErr / Math.PI));
  const sp = Math.hypot(vx, vy);
  if (sp > cruise && sp > 0) {
    vx = (vx / sp) * cruise;
    vy = (vy / sp) * cruise;
  }

  // arrived and shuffling: plant the feet rather than jitter on the spot
  if (dist < 0.3 && want < 0.7) {
    vx = 0;
    vy = 0;
  }

  m.x += vx * dt;
  m.y += vy * dt;
  m.vx = vx;
  m.vy = vy;

  const speed = Math.hypot(vx, vy);
  m.effort = Math.min(1, speed / GAIT.sprint);
  // footfall: the bob runs on distance travelled, so it always matches the gait
  m.step = (m.step + speed * dt * 1.35) % (Math.PI * 2);

  // facing (visual): the ball wins when it is near, otherwise the direction of travel
  let look = m.steer;
  if (o.faceX !== undefined && o.faceY !== undefined) {
    const bd = Math.hypot(o.faceX - m.x, o.faceY - m.y);
    const faceRange = o.jockey ? 12 : 5.5;
    if (bd < faceRange || speed < 0.4) look = Math.atan2(o.faceY - m.y, o.faceX - m.x);
  }
  m.heading = lerpAngle(m.heading, look, dt * (speed > 1.2 ? 7 : 11));
}

/**
 * Keep bodies apart: any two within `min` push each other half the overlap.
 * Purely cosmetic — the shape the engine wants is honoured within a jostle.
 */
export function separate(bodies: Motion[], min = 0.95): number {
  let pushes = 0;
  // three relaxation passes: one is not enough when three bodies are in the same spot
  for (let pass = 0; pass < 3; pass++) {
    let moved = 0;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= min || d < 0.0001) continue;
        const push = (min - d) * 0.55; // a touch of overshoot so one pass settles it
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        pushes++;
        moved++;
      }
    }
    if (!moved) break;
  }
  return pushes;
}

/** Stand-off distance a jockeying defender keeps, from role and pace. */
export function jockeyDistance(press: number): number {
  return 0.95 + (1 - Math.min(1, Math.max(0, press))) * 0.7;
}
