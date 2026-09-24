import { describe, expect, it } from "vitest";
import { GAIT, gaitBand, jockeyDistance, newMotion, separate, stepPlayer } from "./motion";
import { FRAME_MAX_DT, frameStep } from "./frame-clock";

const angDiff = (a: number, b: number) => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};

const run = (m: ReturnType<typeof newMotion>, tx: number, ty: number, secs: number, o: Partial<Parameters<typeof stepPlayer>[3]> = {}) => {
  const dt = 1 / 60;
  for (let i = 0; i < secs * 60; i++) {
    stepPlayer(m, tx, ty, { dt, pace: 1, stamina: 100, urgency: 1, ...o });
  }
};

describe("match-feel motion: bodies with physics, not sliders", () => {
  it("eases in: it takes time to reach top speed, and speed is capped", () => {
    const m = newMotion(50, 95);
    stepPlayer(m, 50, 5, { dt: 1 / 60, pace: 1, stamina: 100, urgency: 1 });
    const first = Math.hypot(m.vx, m.vy);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(GAIT.walk); // nowhere near sprinting from a standing start
    // a long chase: he gets up to running speed and never exceeds his gait
    let peak = 0;
    for (let i = 0; i < 60 * 12; i++) {
      stepPlayer(m, 50, 5, { dt: 1 / 60, pace: 1, stamina: 100, urgency: 1 });
      peak = Math.max(peak, Math.hypot(m.vx, m.vy));
    }
    expect(peak).toBeGreaterThan(GAIT.run);
    expect(peak).toBeLessThanOrEqual(GAIT.sprint * 1.001);
    // and he arrives
    expect(Math.hypot(m.x - 50, m.y - 5)).toBeLessThan(1);
  });

  it("turns in arcs rather than snapping to a new line", () => {
    const m = newMotion(50, 50);
    run(m, 50, 20, 2); // up to speed heading north
    const before = m.heading;
    // now demand a reversal
    stepPlayer(m, 50, 80, { dt: 1 / 60, pace: 1, stamina: 100, urgency: 1 });
    const afterOne = m.heading;
    expect(angDiff(afterOne, before)).toBeLessThan(0.5); // cannot flip in a frame
    // and a hard change of direction costs him speed before he can re-accelerate
    const turned = Math.hypot(m.vx, m.vy);
    expect(turned).toBeLessThan(GAIT.sprint);
    run(m, 50, 80, 9);
    expect(Math.hypot(m.x - 50, m.y - 80)).toBeLessThan(2.5);
  });

  it("arrives and stops instead of buzzing around the target", () => {
    const m = newMotion(30, 70);
    run(m, 60, 40, 9); // 42 units away, and he takes the corner wide
    expect(Math.hypot(m.x - 60, m.y - 40)).toBeLessThan(0.8);
    expect(Math.hypot(m.vx, m.vy)).toBeLessThan(GAIT.walk);
    // …and he stays there
    run(m, 60, 40, 3);
    expect(Math.hypot(m.x - 60, m.y - 40)).toBeLessThan(1.2);
  });

  it("walk, jog, run and sprint are all reachable — a match is not one speed", () => {
    const peak = (m: ReturnType<typeof newMotion>, tx: number, ty: number) => {
      let top = 0;
      for (let i = 0; i < 60 * 6; i++) {
        stepPlayer(m, tx, ty, { dt: 1 / 60, pace: 1, stamina: 100, urgency: 1 });
        top = Math.max(top, Math.hypot(m.vx, m.vy));
      }
      return top;
    };
    const short = peak(newMotion(50, 50), 50, 46); // a few steps away
    expect(gaitBand(short)).not.toBe("sprint");
    expect(short).toBeLessThan(GAIT.run);
    const long = peak(newMotion(20, 50), 80, 50); // a sixty-unit chase
    expect(gaitBand(long)).toBe("sprint");
  });

  it("tired legs are slower than fresh ones", () => {
    const fresh = newMotion(30, 50);
    const tired = newMotion(30, 50);
    run(fresh, 70, 50, 3, { stamina: 100 });
    run(tired, 70, 50, 3, { stamina: 5 });
    expect(Math.hypot(tired.vx, tired.vy)).toBeLessThan(Math.hypot(fresh.vx, fresh.vy));
  });

  it("a jockeying defender holds a gap instead of climbing into the shirt", () => {
    const d = newMotion(50, 55);
    for (let i = 0; i < 60 * 5; i++) {
      stepPlayer(d, 50, 50, {
        dt: 1 / 60,
        pace: 1,
        stamina: 100,
        urgency: 1.1,
        jockey: true,
        standOff: jockeyDistance(0.8),
        faceX: 50,
        faceY: 50
      });
    }
    const gap = Math.hypot(d.x - 50, d.y - 50);
    expect(gap).toBeGreaterThan(0.7);
    expect(gap).toBeLessThan(2.2);
    // and he is looking at his man
    expect(angDiff(d.heading, Math.atan2(50 - d.y, 50 - d.x))).toBeLessThan(0.25);
  });

  it("keeps bodies out of each other", () => {
    const bodies = [newMotion(50, 50), newMotion(50.1, 50.05), newMotion(50.2, 50.1)];
    const pushes = separate(bodies, 1.05);
    expect(pushes).toBeGreaterThan(0);
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        expect(Math.hypot(bodies[i].x - bodies[j].x, bodies[i].y - bodies[j].y)).toBeGreaterThanOrEqual(1.04);
      }
    }
  });

  it("faces the ball when it is near, even standing still", () => {
    const m = newMotion(50, 50, 0);
    run(m, 50, 54, 3, { faceX: 40, faceY: 60 });
    const want = Math.atan2(60 - m.y, 40 - m.x);
    expect(angDiff(m.heading, want)).toBeLessThan(0.35);
  });
});

describe("pause freezes the whole board (v0.42.1)", () => {
  it("hands the tick no time at all while paused, and refreshes the timestamp", () => {
    const paused = frameStep(5_000, 4_000, false);
    expect(paused.dt).toBe(0); // the bodies, intents, ball phases and flashes all ride on this
    expect(paused.last).toBe(5_000); // …so a long pause cannot become a jump on resume
    // simulate the pause: the loop keeps running and refreshing `last` each frame
    let last = paused.last;
    for (let t2 = 5_016; t2 < 20_000; t2 += 16) last = frameStep(t2, last, false).last;
    const resumed = frameStep(20_016, last, true);
    expect(resumed.dt).toBeGreaterThan(0);
    expect(resumed.dt).toBeLessThan(0.05); // a normal frame after 15 s of sitting still — not a jump
    expect(resumed.dt).toBeLessThanOrEqual(FRAME_MAX_DT);
  });

  it("clamps a stalled frame instead of teleporting everyone", () => {
    expect(frameStep(10_000, 9_000, true).dt).toBe(FRAME_MAX_DT);
  });

  it("with no time, a body does not move — ball parked, men parked", () => {
    const m = newMotion(50, 50);
    run(m, 50, 50, 0.5); // get it moving
    const before = { x: m.x, y: m.y };
    for (let i = 0; i < 120; i++) stepPlayer(m, 30, 30, { dt: 0, pace: 1, stamina: 100, urgency: 1 });
    expect(m.x).toBe(before.x);
    expect(m.y).toBe(before.y);
    // …and it starts moving again the moment time comes back
    run(m, 30, 30, 1.5);
    expect(Math.hypot(m.x - before.x, m.y - before.y)).toBeGreaterThan(2);
  });
});
