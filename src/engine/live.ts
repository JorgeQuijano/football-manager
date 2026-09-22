import type {
  LiveChange,
  LiveMatch,
  MatchResult,
  MatchState,
  Player,
  SaveGame
} from "./types";
import { hashSeed, mulberry32 } from "./rng";
import {
  advanceTo,
  applySubstitution,
  finalizeMatch,
  HALF,
  startMatch,
  substitutionError
} from "./match";
import { resolveSide } from "./advance";
import { ROLE_GROUPS } from "./roles";

export const playersById = (save: SaveGame): Map<string, Player> =>
  new Map(save.players.map((p) => [p.id, p] as const));

export function userFixture(save: SaveGame) {
  return save.fixtures.find(
    (f) =>
      f.round === save.round &&
      !f.played &&
      (f.homeId === save.userClubId || f.awayId === save.userClubId)
  );
}

/** Kick off the user's fixture as a pauseable live match (first half pre-simulated). */
export function startLive(save: SaveGame): LiveMatch | undefined {
  const fx = userFixture(save);
  if (!fx) return undefined;
  const homeClub = save.clubs.find((c) => c.id === fx.homeId)!;
  const awayClub = save.clubs.find((c) => c.id === fx.awayId)!;
  const home = resolveSide(save, fx.homeId);
  const away = resolveSide(save, fx.awayId);
  const userSide = fx.homeId === save.userClubId ? "home" : "away";
  const rng = mulberry32(
    hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)
  );
  const state = startMatch({
    round: save.round,
    homeClub,
    awayClub,
    homeXI: home.xi,
    awayXI: away.xi,
    homeBench: home.bench,
    awayBench: away.bench,
    homeMentality: home.mentality,
    awayMentality: away.mentality,
    homeRoles: home.roles,
    awayRoles: away.roles,
    homeCoords: home.coords,
    awayCoords: away.coords,
    homePoss: home.poss,
    awayPoss: away.poss,
    rng,
    userSide
  });
  const players = playersById(save);
  const base = structuredClone(state);
  const played = advanceTo(base, HALF, players);
  return { base, state: played, half: 1, changes: [], playhead: 0 };
}

const applyChange = (
  state: MatchState,
  players: Map<string, Player>,
  c: LiveChange
): { state: MatchState; error?: string } => {
  if (c.kind === "sub") {
    const err = substitutionError(state, c.side, c.outId!, c.inId!);
    if (err) return { state, error: err };
    return { state: applySubstitution(state, players, c.side, c.outId!, c.inId!) };
  }
  const s: MatchState = structuredClone(state);
  if (c.kind === "mentality") {
    s[c.side].mentality = c.mentality!;
    return { state: s };
  }
  const slot = c.slot!;
  const pos = s[c.side].poss[slot];
  if (pos === undefined || !ROLE_GROUPS[pos].includes(c.role!)) {
    return { state, error: "That role doesn't fit this slot." };
  }
  s[c.side].roles[slot] = c.role!;
  return { state: s };
};

const halfEnd = (live: LiveMatch) => (live.half === 1 ? HALF : live.base.total);

/** Rebuild the current half from base + journal (deterministic). */
export function rebuildLive(live: LiveMatch, players: Map<string, Player>): MatchState {
  let t = live.base;
  for (const c of live.changes) {
    t = advanceTo(t, c.minute, players);
    const r = applyChange(t, players, c);
    if (!r.error) t = r.state;
  }
  return advanceTo(t, halfEnd(live), players);
}

/** Add a change (sub / mentality / role) at `change.minute`, re-simulating the half after it. */
export function addLiveChange(
  live: LiveMatch,
  players: Map<string, Player>,
  c: LiveChange
): { live?: LiveMatch; error?: string } {
  let t = live.base;
  for (const old of live.changes) {
    t = advanceTo(t, old.minute, players);
    const r = applyChange(t, players, old);
    if (!r.error) t = r.state;
  }
  t = advanceTo(t, c.minute, players);
  const r = applyChange(t, players, c);
  if (r.error) return { error: r.error };
  t = advanceTo(r.state, halfEnd(live), players);
  return { live: { ...live, state: t, changes: [...live.changes, c] } };
}

/** Bake half-time changes and simulate the second half. */
export function resumeSecondHalf(live: LiveMatch, players: Map<string, Player>): LiveMatch {
  const base = structuredClone(live.state);
  const state = advanceTo(base, base.total, players);
  return { base, state, half: 2, changes: [], playhead: HALF };
}

/** Skip to the half-time whistle (half 1 only, changes still possible). */
export function skipToHalfTime(live: LiveMatch): LiveMatch {
  // The state is already simulated to the end of the half — just move the playhead.
  return { ...live, playhead: HALF };
}

/** Skip straight to the full-time whistle (no more decisions). */
export function skipToFullTime(live: LiveMatch, players: Map<string, Player>): LiveMatch {
  const cur = rebuildLive(live, players);
  const state = advanceTo(cur, cur.total, players);
  return { ...live, state, half: 2, playhead: state.total };
}

export function finalizeLive(live: LiveMatch): MatchResult {
  return finalizeMatch(live.state);
}

export interface MatchStats {
  possHome: number;
  shotsHome: number;
  shotsAway: number;
  onTargetHome: number;
  onTargetAway: number;
  cornersHome: number;
  cornersAway: number;
  strokes: number;
}

/** Possession / shots / corners stats derived from the timeline (optionally up to a minute). */
export function matchStats(state: MatchState, upto?: number): MatchStats {
  let h = 0;
  let a = 0;
  let sh = 0;
  let sa = 0;
  let oth = 0;
  let ota = 0;
  let ch = 0;
  let ca = 0;
  for (const st of state.timeline) {
    if (upto !== undefined && st.m > upto) break;
    if (st.h) h++;
    else a++;
    if (st.sp === "corner") {
      if (st.h) ch++;
      else ca++;
    }
    if (st.o === "goal" || st.o === "save" || st.o === "block" || st.o === "miss") {
      if (st.h) sh++;
      else sa++;
    }
    if (st.o === "goal" || st.o === "save") {
      if (st.h) oth++;
      else ota++;
    }
  }
  const total = h + a;
  return {
    possHome: total ? h / total : 0.5,
    shotsHome: sh,
    shotsAway: sa,
    onTargetHome: oth,
    onTargetAway: ota,
    cornersHome: ch,
    cornersAway: ca,
    strokes: total
  };
}

/** Minute a change made at the current playhead applies from. */
export function changeMinute(live: LiveMatch): number {
  const end = halfEnd(live);
  const x = Math.ceil(live.playhead);
  return Math.max(live.base.minute + 1, Math.min(end, x));
}
