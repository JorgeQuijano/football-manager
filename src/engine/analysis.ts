import type { MatchState, Stroke } from "./types";

/**
 * Match analysis (v0.45) — the calibration instrument for the match engine.
 *
 * Reads a finished (or in-progress) `MatchState` and derives the numbers the
 * engine team tunes against: passes, lengths, direction, completions, turnover
 * zones, shots and xG per side. Pure and deterministic: no RNG, no state.
 *
 * `pd`/`pc` on a stroke are the exact attempted-pass distances and completions
 * recorded by the possession model (v0.46+). Older or set-piece strokes fall
 * back to the recorded slot chain and the side's formation coordinates.
 */

export interface SideMatchReport {
  strokes: number;
  /** completed passes (pass links between two players) */
  passes: number;
  /** attempted passes — completions plus lost balls */
  attempts: number;
  /** completion share 0..1 */
  completion: number;
  shots: number;
  /** open-play shots (no set-piece tag) */
  shotsOpen: number;
  /** shots from set pieces (corners, free kicks, penalties) */
  shotsSet: number;
  goals: number;
  xg: number;
  /** turnovers won by this side */
  turnoversWon: number;
  /** of those, won in the attacking third (winner's frame y < 40) */
  wonHigh: number;
}

export interface MatchReport {
  home: SideMatchReport;
  away: SideMatchReport;
  /** attempted-pass distance mix in pitch units (x: 0-100) */
  passLength: { short: number; medium: number; long: number };
  /** pass direction in the attacking frame */
  direction: { fwd: number; lat: number; back: number };
  ends: { out: number; turnover: number; chance: number; foul: number; offside: number; held: number };
  /** home share of completed passes, 0..1 */
  possessionHome: number;
  passesPerPossession: number;
}

const SHORT = 15;
const LONG = 30;

const emptySide = (): SideMatchReport => ({
  strokes: 0,
  passes: 0,
  attempts: 0,
  completion: 0,
  shots: 0,
  shotsOpen: 0,
  shotsSet: 0,
  goals: 0,
  xg: 0,
  turnoversWon: 0,
  wonHigh: 0
});

const isChance = (o: Stroke["o"]) => o === "goal" || o === "save" || o === "block" || o === "miss";

/** Distance of a pass between two formation slots, in pitch units. */
const slotDistance = (side: { coords: [number, number][] }, a: number, b: number): number => {
  const ca = side.coords[a] ?? [50, 50];
  const cb = side.coords[b] ?? [50, 50];
  return Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
};

export function matchReport(state: MatchState): MatchReport {
  const home = emptySide();
  const away = emptySide();
  const passLength = { short: 0, medium: 0, long: 0 };
  const direction = { fwd: 0, lat: 0, back: 0 };
  const ends = { out: 0, turnover: 0, chance: 0, foul: 0, offside: 0, held: 0 };
  let possessions = 0;

  const bump = (d: number) => {
    if (d < SHORT) passLength.short++;
    else if (d < LONG) passLength.medium++;
    else passLength.long++;
  };

  for (const st of state.timeline) {
    const side = st.h === 1 ? home : away;
    const frame = st.h === 1 ? state.home : state.away;
    const oppFrame = st.h === 1 ? state.away : state.home;
    side.strokes++;

    // --- passes: prefer the exact record, fall back to the slot chain --------
    const links = Math.max(0, st.p.length - 1);
    const lostBall = st.o === "turnover" && typeof st.b === "number";
    const exact = Array.isArray(st.pd);
    const attempts = exact ? st.pd!.length : links + (lostBall ? 1 : 0);
    const completed = exact ? st.pc ?? st.pd!.length : links;
    side.passes += completed;
    side.attempts += attempts;
    possessions++;

    if (exact) {
      for (const d of st.pd!) bump(d);
      const fwd = st.pf;
      if (fwd) {
        for (const dy of fwd) {
          if (dy > 5) direction.fwd++;
          else if (dy < -5) direction.back++;
          else direction.lat++;
        }
      } else {
        for (let k = 0; k + 1 < st.p.length; k++) {
          const dy = (frame.coords[st.p[k + 1]]?.[1] ?? 50) - (frame.coords[st.p[k]]?.[1] ?? 50);
          if (dy < -5) direction.fwd++;
          else if (dy > 5) direction.back++;
          else direction.lat++;
        }
      }
    } else {
      for (let k = 0; k + 1 < st.p.length; k++) {
        const a = st.p[k];
        const b = st.p[k + 1];
        bump(slotDistance(frame, a, b));
        const dy = (frame.coords[b]?.[1] ?? 50) - (frame.coords[a]?.[1] ?? 50);
        if (dy < -2) direction.fwd++;
        else if (dy > 2) direction.back++;
        else direction.lat++;
      }
    }

    if (isChance(st.o)) {
      side.shots++;
      if (st.sp) side.shotsSet++;
      else side.shotsOpen++;
      side.xg += st.xg ?? 0;
      ends.chance++;
      if (st.o === "goal") side.goals++;
    } else if (st.o === "turnover") {
      ends.turnover++;
      // the ball was won by the other side
      const winner = st.h === 1 ? away : home;
      winner.turnoversWon++;
      // where it was won: the live spot when the possession model recorded it,
      // else the interceptor's formation slot (v0.46)
      const y =
        st.ty ?? (typeof st.b === "number" ? oppFrame.coords[st.b]?.[1] ?? 50 : 50);
      if (y < 40) winner.wonHigh++;
    } else if (st.o === "out") {
      ends.out++;
    } else if (st.o === "held") {
      // the move ran out of passes but the ball stayed: same side, next minute
      ends.held++;
    } else if (st.o === "foul") {
      ends.foul++;
    } else if (st.o === "offside") {
      ends.offside++;
    }
  }

  for (const side of [home, away]) {
    side.completion = side.attempts > 0 ? side.passes / side.attempts : 0;
  }
  const totalPasses = home.passes + away.passes;
  return {
    home,
    away,
    passLength,
    direction,
    ends,
    possessionHome: totalPasses > 0 ? home.passes / totalPasses : 0.5,
    passesPerPossession: possessions > 0 ? totalPasses / possessions : 0
  };
}

/** Sum two reports (for harness aggregation across many matches). */
export function mergeReports(a: MatchReport, b: MatchReport): MatchReport {
  const add = (x: SideMatchReport, y: SideMatchReport): SideMatchReport => ({
    strokes: x.strokes + y.strokes,
    passes: x.passes + y.passes,
    attempts: x.attempts + y.attempts,
    completion: 0,
    shots: x.shots + y.shots,
    shotsOpen: x.shotsOpen + y.shotsOpen,
    shotsSet: x.shotsSet + y.shotsSet,
    goals: x.goals + y.goals,
    xg: x.xg + y.xg,
    turnoversWon: x.turnoversWon + y.turnoversWon,
    wonHigh: x.wonHigh + y.wonHigh
  });
  const home = add(a.home, b.home);
  const away = add(a.away, b.away);
  home.completion = home.attempts > 0 ? home.passes / home.attempts : 0;
  away.completion = away.attempts > 0 ? away.passes / away.attempts : 0;
  const totalPasses = home.passes + away.passes;
  const possessions = home.strokes + away.strokes;
  return {
    home,
    away,
    passLength: {
      short: a.passLength.short + b.passLength.short,
      medium: a.passLength.medium + b.passLength.medium,
      long: a.passLength.long + b.passLength.long
    },
    direction: {
      fwd: a.direction.fwd + b.direction.fwd,
      lat: a.direction.lat + b.direction.lat,
      back: a.direction.back + b.direction.back
    },
    ends: {
      out: a.ends.out + b.ends.out,
      turnover: a.ends.turnover + b.ends.turnover,
      chance: a.ends.chance + b.ends.chance,
      foul: a.ends.foul + b.ends.foul,
      offside: a.ends.offside + b.ends.offside,
      held: a.ends.held + b.ends.held
    },
    possessionHome: totalPasses > 0 ? home.passes / totalPasses : 0.5,
    passesPerPossession: possessions > 0 ? totalPasses / possessions : 0
  };
}
