import type {
  Club,
  MatchResult,
  MatchSideState,
  MatchState,
  Mentality,
  Player,
  PlayerUpdate,
  Position,
  RoleId,
  SetPiece,
  StrokeOut
} from "./types";
import { hashSeed, mulberry32, pick, pickWeighted, randInt, type Rng } from "./rng";
import { T } from "./tuning";
import { hasTrait } from "./traits";
import {
  attackScore,
  attackStrength,
  defenseScore,
  defenseStrength,
  overallFor,
  suitability
} from "./ratings";
import { defaultRoleFor, roleFinish, ROLE_DEFS } from "./roles";

export interface MatchInputs {
  round: number;
  homeClub: Club;
  awayClub: Club;
  homeXI: Player[];
  awayXI: Player[];
  homeBench: Player[];
  awayBench: Player[];
  homeMentality: Mentality;
  awayMentality: Mentality;
  homeRoles: RoleId[];
  awayRoles: RoleId[];
  homeCoords: [number, number][];
  awayCoords: [number, number][];
  homePoss: Position[];
  awayPoss: Position[];
  rng: Rng;
  userSide?: "home" | "away";
}

export const HALF = 45;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type TextFn = (s: string, t: string) => string;

const GOAL_TEXT: TextFn[] = [
  (s, c) => `GOAL! ${s} finds the net for ${c}.`,
  (s, c) => `${s} rifles it home for ${c}!`,
  (s, c) => `Clinical finish from ${s} — ${c} score!`,
  (s, c) => `The net bulges! ${s} is the scorer for ${c}.`
];
const SAVE_TEXT: TextFn[] = [
  (s, gk) => `Big save! ${gk} keeps out ${s}.`,
  (s, gk) => `${s} is denied — ${gk} with a strong hand.`,
  (s, gk) => `Brilliant stop by ${gk} to frustrate ${s}.`,
  (s, gk) => `${gk} parries ${s}'s effort away.`
];
const MISS_TEXT: TextFn[] = [
  (s) => `${s} curls one wide.`,
  (s) => `${s} snatches at it — over the bar.`,
  (s) => `Dragged wide by ${s}.`,
  (s) => `${s} shoots into the stands.`
];
const BLOCK_TEXT: TextFn[] = [
  (s, d) => `Blocked! ${d} throws himself in front of ${s}'s shot.`,
  (s, d) => `${s} is denied — ${d} gets a crucial block in.`,
  (s, d) => `Huge block by ${d} to deny ${s}.`
];
const ASSIST_SUFFIX: TextFn[] = [
  (s) => ` — ${s} with the assist.`,
  (s) => ` — teed up by ${s}.`,
  (s) => ` — ${s} the creator.`
];
const YELLOW_TEXT: TextFn[] = [
  (s) => `Yellow card: ${s} goes in the book.`,
  (s) => `${s} is cautioned for a late challenge.`,
  (s) => `Booking for ${s}.`,
  (s) => `${s} catches his man — yellow.`
];
const INJ_TEXT: TextFn[] = [
  (s) => `${s} is down and can't continue.`,
  (s) => `Concern for ${s} — he limps off.`,
  (s) => `${s} pulls up injured.`
];
const SUB_TEXT: TextFn[] = [
  (a, b) => `${a} makes way for ${b}.`,
  (a, b) => `Fresh legs: ${b} replaces ${a}.`,
  (a, b) => `${b} comes on for ${a}.`
];
const CORNER_TEXT: TextFn[] = [
  (c) => `Corner for ${c}.`,
  (c) => `${c} win a corner.`,
  (c) => `Behind for a corner — ${c} will swing it in.`
];
const CORNER_CLEAR_TEXT: TextFn[] = [
  (t, d) => `${t} swings it in — headed clear by ${d}.`,
  (t, d) => `Corner delivered by ${t}; ${d} gets it away.`,
  (t, d) => `${t}'s corner is punched clear under pressure from ${d}.`
];
const CORNER_AGAIN_TEXT: TextFn[] = [
  (c, t) => `${c} keep it alive — another corner, ${t} to take.`,
  (c, t) => `Blocked at the near post! Second corner for ${c}.`
];
const CORNER_GOAL_TEXT: TextFn[] = [
  (s, c) => `GOAL! ${s} rises highest and heads it in for ${c}!`,
  (s, c) => `${s} attacks the corner and buries it — ${c} score from a set piece!`,
  (s, c) => `From the corner, ${s} finds the net for ${c}!`
];
const FK_TEXT: TextFn[] = [
  (s, c) => `Free kick in shooting range — ${s} stands over it for ${c}.`,
  (s, c) => `${c} have a dangerous free kick. ${s} fancies this.`
];
const FK_GOAL_TEXT: TextFn[] = [
  (s, c) => `GOAL! ${s} whips the free kick into the top corner for ${c}!`,
  (s, c) => `What a strike! ${s} bends the free kick home for ${c}.`,
  (s, c) => `The free kick flies in — ${s} scores for ${c}!`
];
const PEN_SCORE_TEXT: TextFn[] = [
  (s, c) => `PENALTY GOAL! ${s} sends the keeper the wrong way. ${c} score.`,
  (s, c) => `${s} buries the penalty for ${c}.`,
  (s, c) => `Cool as ice — ${s} converts from the spot for ${c}.`
];
const PEN_SAVE_TEXT: TextFn[] = [
  (s, gk) => `SAVED! ${gk} guesses right and keeps out ${s}'s penalty!`,
  (s, gk) => `${gk} is the hero — ${s}'s penalty is stopped!`
];
const PEN_MISS_TEXT: TextFn[] = [
  (s, c) => `${s} blazes the penalty over the bar — let-off for ${c}'s opponents!`,
  (s) => `${s} misses from the spot — wide of the post!`
];

interface Proto {
  slot: number;
  p: Player;
  role: RoleId;
}

const proto = (side: MatchSideState, players: Map<string, Player>): Proto[] =>
  side.slots
    .map((id, slot) => {
      if (!id) return null;
      const p = players.get(id);
      return p ? { slot, p, role: side.roles[slot] } : null;
    })
    .filter((x): x is Proto => x !== null);

const updOf = (s: MatchState, id: string): PlayerUpdate => {
  let u = s.updates[id];
  if (!u) {
    u = {
      playerId: id,
      minutes: 0,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: false,
      injuredWeeks: 0,
      conditionLoss: 0
    };
    s.updates[id] = u;
  }
  return u;
};

const buildSide = (
  club: Club,
  xi: Player[],
  bench: Player[],
  mentality: Mentality,
  roles: RoleId[],
  coords: [number, number][],
  poss0: Position[]
): MatchSideState => {
  const slots: (string | null)[] = [];
  const poss: Position[] = [];
  const rls: RoleId[] = [];
  const cds: [number, number][] = [];
  for (let i = 0; i < 11; i++) {
    const p = xi[i];
    const slotPos = poss0[i] ?? (p ? p.pos : "MF");
    slots.push(p ? p.id : null);
    poss.push(slotPos);
    rls.push(roles[i] ?? defaultRoleFor(slotPos));
    cds.push(coords[i] ?? [50, 50]);
  }
  return {
    clubId: club.id,
    name: club.name,
    short: club.short,
    slots,
    poss,
    roles: rls,
    coords: cds,
    bench: bench.map((p) => p.id),
    mentality,
    goals: 0,
    subs: 0,
    windows: 0
  };
};

export function startMatch(inp: MatchInputs): MatchState {
  const rng = inp.rng;
  const total = 90 + randInt(rng, 1, 5);
  const state: MatchState = {
    round: inp.round,
    homeId: inp.homeClub.id,
    awayId: inp.awayClub.id,
    minute: 0,
    total,
    rngState: 0,
    userSide: inp.userSide,
    home: buildSide(inp.homeClub, inp.homeXI, inp.homeBench, inp.homeMentality, inp.homeRoles, inp.homeCoords, inp.homePoss),
    away: buildSide(inp.awayClub, inp.awayXI, inp.awayBench, inp.awayMentality, inp.awayRoles, inp.awayCoords, inp.awayPoss),
    events: [],
    timeline: [],
    ratings: {},
    updates: {},
    yellows: {},
    entryMinute: {},
    exitMinute: {},
    played: [],
    scorers: [],
    pin: {}
  };
  for (const p of [...inp.homeXI, ...inp.homeBench, ...inp.awayXI, ...inp.awayBench]) {
    state.ratings[p.id] = T.ratingBase;
  }
  for (const p of inp.homeXI.slice(0, 11)) {
    state.entryMinute[p.id] = 0;
    state.played.push(p.id);
    state.pin[p.id] = { s: 0, pos: p.pos };
  }
  for (const p of inp.awayXI.slice(0, 11)) {
    state.entryMinute[p.id] = 0;
    state.played.push(p.id);
    state.pin[p.id] = { s: 1, pos: p.pos };
  }
  for (const p of inp.homeBench) state.pin[p.id] = { s: 0, pos: p.pos };
  for (const p of inp.awayBench) state.pin[p.id] = { s: 1, pos: p.pos };
  state.rngState = rng.state;
  return state;
}

/** Random-walk a pass chain through the side's shape; optionally ending at a chosen slot. */
const buildChain = (
  side: MatchSideState,
  atk: Proto[],
  rng: Rng,
  endSlot?: number
): number[] => {
  if (!atk.length) return [];
  const y = (slot: number) => clamp(side.coords[slot]?.[1] ?? 50, 0, 100);
  const cur0 = pickWeighted(
    rng,
    atk,
    (x) => Math.pow(y(x.slot) / 100, 2.2) * (x.p.pos === "GK" ? 0.35 : 1) + 0.12
  ).slot;
  const chain = [cur0];
  let cur = cur0;
  const passes = randInt(rng, T.chainPasses[0], T.chainPasses[1]);
  for (let k = 0; k < passes - 1; k++) {
    const opts = atk.filter((x) => x.slot !== cur && x.slot !== endSlot);
    if (!opts.length) break;
    const next = pickWeighted(rng, opts, (x) => {
      const prog = y(cur) - y(x.slot); // positive = forward
      return Math.max(0.12, 1 + clamp(prog, -15, 30) * 0.07) * (x.p.pos === "GK" ? 0.15 : 1);
    });
    chain.push(next.slot);
    cur = next.slot;
  }
  if (endSlot !== undefined && chain[chain.length - 1] !== endSlot) chain.push(endSlot);
  return chain;
};

const pickFromBench = (
  side: MatchSideState,
  slot: Position,
  players: Map<string, Player>
): Player | undefined => {
  if (!side.bench.length) return undefined;
  return side.bench
    .map((id) => players.get(id))
    .filter((p): p is Player => !!p)
    .sort(
      (a, b) => overallFor(b) * suitability(b, slot) - overallFor(a) * suitability(a, slot)
    )[0];
};

const enterSlot = (
  s: MatchState,
  side: MatchSideState,
  slot: number,
  p: Player,
  m: number,
  role: RoleId
) => {
  const bi = side.bench.indexOf(p.id);
  if (bi >= 0) side.bench.splice(bi, 1);
  side.slots[slot] = p.id;
  side.roles[slot] = role;
  side.subs++;
  s.entryMinute[p.id] = m;
  if (!s.played.includes(p.id)) s.played.push(p.id);
  s.pin[p.id] = { s: side === s.home ? 0 : 1, pos: p.pos };
};

const leaveSlot = (s: MatchState, side: MatchSideState, slot: number, m: number) => {
  const id = side.slots[slot];
  if (id && !(id in s.exitMinute)) s.exitMinute[id] = m;
  side.slots[slot] = null;
};

const isHome = (s: MatchState, side: MatchSideState) => side === s.home;

// --- timeline phases ------------------------------------------------

const possessionPhase = (
  s: MatchState,
  side: MatchSideState,
  opp: MatchSideState,
  m: number,
  rng: Rng,
  players: Map<string, Player>
) => {
  const atk = proto(side, players);
  if (!atk.length) return;
  const chain = buildChain(side, atk, rng);
  if (rng() < 0.2) {
    const lastSlot = chain[chain.length - 1];
    const deepInAttack = lastSlot !== undefined && (side.coords[lastSlot]?.[1] ?? 100) < 40;
    if (deepInAttack && rng() < T.cornerFromOut) {
      resolveCorner(s, side, opp, m, rng, players);
      return;
    }
    s.timeline.push({
      m,
      h: isHome(s, side) ? 1 : 0,
      p: chain,
      o: "out",
      t: rng() < 0.5 ? 4 : 96,
      sp: "throw"
    });
    return;
  }
  const dfn = proto(opp, players);
  let b: number | undefined;
  if (dfn.length) {
    const inter = pickWeighted(
      rng,
      dfn,
      (x) =>
        Math.pow(clamp(opp.coords[x.slot]?.[1] ?? 50, 0, 100) / 100, 1.4) *
        (1 + x.p.attrs.defending / 150)
    );
    b = inter.slot;
  }
  s.timeline.push({ m, h: isHome(s, side) ? 1 : 0, p: chain, o: "turnover", b });
};

const resolveChance = (
  s: MatchState,
  atkSide: MatchSideState,
  defSide: MatchSideState,
  m: number,
  rng: Rng,
  players: Map<string, Player>
) => {
  const atk = proto(atkSide, players);
  const dfn = proto(defSide, players);
  const shooters = atk.filter((x) => x.p.pos !== "GK");
  if (!shooters.length) return;
  const shooter = pickWeighted(
    rng,
    shooters,
    (x) =>
      (x.p.pos === "FW" ? 4 : x.p.pos === "MF" ? 2.4 : 0.7) *
      (0.5 + x.p.attrs.shooting / 100) *
      ROLE_DEFS[x.role].shot *
      (hasTrait(x.p, "shoots_on_sight") ? 1.25 : 1)
  );
  const chain = buildChain(atkSide, atk, rng, shooter.slot);
  const gk = dfn.find((x) => x.p.pos === "GK");
  const finish = roleFinish(shooter.p, shooter.role) * ROLE_DEFS[shooter.role].finish;
  const gkSkill = gk ? defenseScore(gk.p, gk.role) : 50;
  let pGoal = T.conversionBase * (1 + (finish - 60) / 120) * (1 + (60 - gkSkill) / 160);
  pGoal = clamp(pGoal, 0.04, 0.3);

  const evBefore = s.events.length;
  let out: StrokeOut;
  let b: number | undefined;
  let corner = false;
  let goalKick = false;

  if (rng() < pGoal) {
    out = "goal";
    atkSide.goals++;
    updOf(s, shooter.p.id).goals++;
    s.ratings[shooter.p.id] = clamp(s.ratings[shooter.p.id] + 1.0, 4, 10);

    const mates = atk.filter((x) => x.p.id !== shooter.p.id && x.p.pos !== "GK");
    const assister =
      mates.length > 0 && rng() < T.assistChance
        ? pickWeighted(
            rng,
            mates,
            (x) =>
              x.p.attrs.passing *
              ROLE_DEFS[x.role].assist *
              (hasTrait(x.p, "killer_balls") ? 1.3 : 1)
          )
        : undefined;
    if (assister) {
      updOf(s, assister.p.id).assists++;
      s.ratings[assister.p.id] = clamp(s.ratings[assister.p.id] + 0.4, 4, 10);
    }

    s.scorers.push({
      playerId: shooter.p.id,
      name: shooter.p.name,
      clubId: atkSide.clubId,
      minute: m
    });
    s.events.push({
      minute: m,
      type: "goal",
      clubId: atkSide.clubId,
      playerId: shooter.p.id,
      text:
        pick(rng, GOAL_TEXT)(shooter.p.name, atkSide.short) +
        (assister ? pick(rng, ASSIST_SUFFIX)(assister.p.name, "") : "")
    });
  } else if (rng() < T.saveShare) {
    out = "save";
    b = gk?.slot;
    s.events.push({
      minute: m,
      type: "save",
      clubId: defSide.clubId,
      playerId: gk?.p.id,
      text: pick(rng, SAVE_TEXT)(shooter.p.name, gk?.p.name ?? "the keeper")
    });
    if (gk) s.ratings[gk.p.id] = clamp(s.ratings[gk.p.id] + 0.15, 4, 10);
    corner = rng() < T.cornerFromSave;
  } else {
    const blockers = dfn.filter((x) => x.p.pos !== "GK");
    const defMean =
      dfn.reduce((acc, x) => acc + defenseScore(x.p, x.role), 0) / Math.max(1, dfn.length);
    if (blockers.length > 0 && rng() < T.blockShare * clamp(defMean / 62, 0.6, 1.4)) {
      const blocker = pickWeighted(rng, blockers, (x) => defenseScore(x.p, x.role));
      out = "block";
      b = blocker.slot;
      s.ratings[blocker.p.id] = clamp(s.ratings[blocker.p.id] + 0.15, 4, 10);
      s.events.push({
        minute: m,
        type: "block",
        clubId: defSide.clubId,
        playerId: blocker.p.id,
        text: pick(rng, BLOCK_TEXT)(shooter.p.name, blocker.p.name)
      });
      corner = rng() < T.cornerFromBlock;
    } else {
      out = "miss";
      s.events.push({
        minute: m,
        type: "miss",
        clubId: atkSide.clubId,
        playerId: shooter.p.id,
        text: pick(rng, MISS_TEXT)(shooter.p.name, "")
      });
      goalKick = true;
    }
  }

  const t =
    out === "goal"
      ? 50 + randInt(rng, -10, 10)
      : out === "save"
        ? 50 + randInt(rng, -14, 14)
        : out === "block"
          ? 50 + randInt(rng, -18, 18)
          : clamp(50 + (rng() < 0.5 ? -1 : 1) * (18 + randInt(rng, 0, 13)), 4, 96);

  s.timeline.push({
    m,
    h: isHome(s, atkSide) ? 1 : 0,
    p: chain,
    o: out,
    t,
    b,
    r: s.events.length > evBefore ? s.events.length - 1 : undefined
  });

  if (corner) {
    resolveCorner(s, atkSide, defSide, m, rng, players);
  } else if (goalKick) {
    const gk2 = dfn.find((x) => x.p.pos === "GK");
    if (gk2) {
      s.timeline.push({
        m,
        h: isHome(s, defSide) ? 1 : 0,
        p: [gk2.slot],
        o: "turnover",
        b: gk2.slot,
        sp: "goalkick"
      });
    }
  }
};

/** A foul: whistle + card roll + the set-piece consequence for the fouled side. */
const processFoul = (
  s: MatchState,
  committed: MatchSideState,
  fouled: MatchSideState,
  m: number,
  rng: Rng,
  players: Map<string, Player>
) => {
  const offenders = proto(committed, players).filter((x) => x.p.pos !== "GK");
  if (!offenders.length) return;
  const offender = pickWeighted(
    rng,
    offenders,
    (x) =>
      (x.p.pos === "DF" ? 2 : x.p.pos === "MF" ? 1.5 : 1) *
      (1 + Math.max(0, 70 - x.p.attrs.defending) / 80) *
      (1 + (x.p.attrs.physical - 65) / 250) *
      (hasTrait(x.p, "dives_in") ? 1.4 : 1)
  );
  const evBefore = s.events.length;
  if (rng() < T.cardShareOfFouls) {
    if (rng() < T.redChancePerFoul * (hasTrait(offender.p, "dives_in") ? 1.5 : 1)) {
      leaveSlot(s, committed, offender.slot, m);
      updOf(s, offender.p.id).red = true;
      s.ratings[offender.p.id] = clamp(s.ratings[offender.p.id] - 0.5, 4, 10);
      s.events.push({
        minute: m,
        type: "red",
        clubId: committed.clubId,
        playerId: offender.p.id,
        text: `Straight red! ${offender.p.name} is off for a reckless lunge.`
      });
    } else {
      const count = (s.yellows[offender.p.id] ?? 0) + 1;
      s.yellows[offender.p.id] = count;
      if (count >= 2) {
        leaveSlot(s, committed, offender.slot, m);
        updOf(s, offender.p.id).red = true;
        s.ratings[offender.p.id] = clamp(s.ratings[offender.p.id] - 0.5, 4, 10);
        s.events.push({
          minute: m,
          type: "red",
          clubId: committed.clubId,
          playerId: offender.p.id,
          text: `Second yellow — ${offender.p.name} is sent off.`
        });
      } else {
        updOf(s, offender.p.id).yellow++;
        s.ratings[offender.p.id] = clamp(s.ratings[offender.p.id] - 0.15, 4, 10);
        s.events.push({
          minute: m,
          type: "yellow",
          clubId: committed.clubId,
          playerId: offender.p.id,
          text: pick(rng, YELLOW_TEXT)(offender.p.name, "")
        });
      }
    }
  }
  // the whistle: everything stops on the foul
  s.timeline.push({
    m,
    h: isHome(s, committed) ? 1 : 0,
    p: [offender.slot],
    o: "foul",
    r: s.events.length > evBefore ? s.events.length - 1 : undefined
  });
  // set-piece consequence for the side that was fouled
  if (rng() < T.fkZoneShare) {
    const roll = rng();
    if (roll < T.penShareOfAttFouls) {
      resolvePenalty(s, fouled, committed, m, rng, players);
    } else if (roll < T.penShareOfAttFouls + T.fkShotShareOfAttFouls) {
      resolveFreeKick(s, fouled, committed, m, rng, players);
    }
  }
};

/** Penalty: staged in the 2D view via sp/tg (taker on the spot, players on the arc). */
const resolvePenalty = (
  s: MatchState,
  atkSide: MatchSideState,
  defSide: MatchSideState,
  m: number,
  rng: Rng,
  players: Map<string, Player>
) => {
  const atk = proto(atkSide, players).filter((x) => x.p.pos !== "GK");
  if (!atk.length) return;
  const taker = pickWeighted(
    rng,
    atk,
    (x) =>
      (x.p.attrs.shooting * 0.7 + roleFinish(x.p, x.role) * 0.3) *
      (hasTrait(x.p, "dead_ball") ? 1.4 : 1)
  );
  const gk = proto(defSide, players).find((x) => x.p.pos === "GK");
  const gkSkill = gk ? defenseScore(gk.p, gk.role) : 50;
  const pGoal = clamp(
    T.penaltyGoalBase +
      (taker.p.attrs.shooting - gkSkill) / 300 +
      (hasTrait(taker.p, "dead_ball") ? 0.02 : 0),
    0.62,
    0.92
  );
  const evBefore = s.events.length;
  let out: StrokeOut;
  if (rng() < pGoal) {
    out = "goal";
    atkSide.goals++;
    updOf(s, taker.p.id).goals++;
    s.ratings[taker.p.id] = clamp(s.ratings[taker.p.id] + 0.8, 4, 10);
    s.scorers.push({
      playerId: taker.p.id,
      name: taker.p.name,
      clubId: atkSide.clubId,
      minute: m
    });
    s.events.push({
      minute: m,
      type: "penalty",
      clubId: atkSide.clubId,
      playerId: taker.p.id,
      text: pick(rng, PEN_SCORE_TEXT)(taker.p.name, atkSide.short)
    });
  } else if (rng() < 0.75) {
    out = "save";
    if (gk) s.ratings[gk.p.id] = clamp(s.ratings[gk.p.id] + 0.6, 4, 10);
    s.events.push({
      minute: m,
      type: "penalty",
      clubId: defSide.clubId,
      playerId: gk?.p.id,
      text: pick(rng, PEN_SAVE_TEXT)(taker.p.name, gk?.p.name ?? "the keeper")
    });
  } else {
    out = "miss";
    s.events.push({
      minute: m,
      type: "penalty",
      clubId: atkSide.clubId,
      playerId: taker.p.id,
      text: pick(rng, PEN_MISS_TEXT)(taker.p.name, atkSide.short)
    });
  }
  s.timeline.push({
    m,
    h: isHome(s, atkSide) ? 1 : 0,
    p: [taker.slot],
    o: out,
    t: 50 + randInt(rng, -8, 8),
    b: gk?.slot,
    r: s.events.length > evBefore ? s.events.length - 1 : undefined,
    sp: "penalty",
    tg: [50, 12]
  });
};

/** Direct free kick from a foul in shooting range. */
const resolveFreeKick = (
  s: MatchState,
  atkSide: MatchSideState,
  defSide: MatchSideState,
  m: number,
  rng: Rng,
  players: Map<string, Player>
) => {
  const atk = proto(atkSide, players).filter((x) => x.p.pos !== "GK");
  if (!atk.length) return;
  const taker = pickWeighted(
    rng,
    atk,
    (x) =>
      (x.p.attrs.shooting * 0.75 + roleFinish(x.p, x.role) * 0.25) *
      (hasTrait(x.p, "dead_ball") ? 1.4 : 1)
  );
  const dfn = proto(defSide, players);
  const gk = dfn.find((x) => x.p.pos === "GK");
  const gkSkill = gk ? defenseScore(gk.p, gk.role) : 50;
  const pGoal = clamp(
    T.fkGoalBase *
      (1 + (taker.p.attrs.shooting - 60) / 80) *
      (1 + (60 - gkSkill) / 200) *
      (hasTrait(taker.p, "dead_ball") ? 1.08 : 1),
    0.02,
    0.16
  );
  s.events.push({
    minute: m,
    type: "freekick",
    clubId: atkSide.clubId,
    playerId: taker.p.id,
    text: pick(rng, FK_TEXT)(taker.p.name, atkSide.short)
  });
  const evBefore = s.events.length;
  let out: StrokeOut;
  let b: number | undefined;
  if (rng() < pGoal) {
    out = "goal";
    atkSide.goals++;
    updOf(s, taker.p.id).goals++;
    s.ratings[taker.p.id] = clamp(s.ratings[taker.p.id] + 1.0, 4, 10);
    s.scorers.push({
      playerId: taker.p.id,
      name: taker.p.name,
      clubId: atkSide.clubId,
      minute: m
    });
    s.events.push({
      minute: m,
      type: "goal",
      clubId: atkSide.clubId,
      playerId: taker.p.id,
      text: pick(rng, FK_GOAL_TEXT)(taker.p.name, atkSide.short)
    });
  } else if (rng() < T.saveShare) {
    out = "save";
    b = gk?.slot;
    if (gk) s.ratings[gk.p.id] = clamp(s.ratings[gk.p.id] + 0.2, 4, 10);
    s.events.push({
      minute: m,
      type: "save",
      clubId: defSide.clubId,
      playerId: gk?.p.id,
      text: pick(rng, SAVE_TEXT)(taker.p.name, gk?.p.name ?? "the keeper")
    });
  } else {
    const wall = dfn.filter((x) => x.p.pos !== "GK");
    if (wall.length && rng() < 0.55) {
      const blocker = pickWeighted(
        rng,
        wall,
        (x) => x.p.attrs.defending + x.p.attrs.physical * 0.5
      );
      out = "block";
      b = blocker.slot;
      s.events.push({
        minute: m,
        type: "block",
        clubId: defSide.clubId,
        playerId: blocker.p.id,
        text: pick(rng, BLOCK_TEXT)(taker.p.name, blocker.p.name)
      });
    } else {
      out = "miss";
      s.events.push({
        minute: m,
        type: "miss",
        clubId: atkSide.clubId,
        playerId: taker.p.id,
        text: pick(rng, MISS_TEXT)(taker.p.name, "")
      });
    }
  }
  s.timeline.push({
    m,
    h: isHome(s, atkSide) ? 1 : 0,
    p: [taker.slot],
    o: out,
    t:
      out === "miss"
        ? clamp(50 + (rng() < 0.5 ? -1 : 1) * (16 + randInt(rng, 0, 10)), 4, 96)
        : 50 + randInt(rng, -12, 12),
    b,
    r: s.events.length > evBefore ? s.events.length - 1 : undefined,
    sp: "freekick",
    tg: [50, 24]
  });
};

/** Corner: staged in the 2D view via sp/tg (taker at the flag, the box loaded). */
const resolveCorner = (
  s: MatchState,
  atkSide: MatchSideState,
  defSide: MatchSideState,
  m: number,
  rng: Rng,
  players: Map<string, Player>,
  depth = 0
) => {
  const atk = proto(atkSide, players).filter((x) => x.p.pos !== "GK");
  if (!atk.length) return;
  const taker = pickWeighted(
    rng,
    atk,
    (x) =>
      (x.p.attrs.passing * (1 + ROLE_DEFS[x.role].assist) * 0.6 + 20) *
      (hasTrait(x.p, "dead_ball") ? 1.4 : 1)
  );
  const flagX = rng() < 0.5 ? 2 : 98;
  const contenders = atk.filter((x) => x.p.id !== taker.p.id);
  const header =
    contenders.length > 0
      ? pickWeighted(
          rng,
          contenders,
          (x) =>
            x.p.attrs.physical * 0.9 + x.p.attrs.shooting * 0.3 + ROLE_DEFS[x.role].finish * 10
        )
      : taker;
  const dfn = proto(defSide, players);
  const gk = dfn.find((x) => x.p.pos === "GK");
  const gkSkill = gk ? defenseScore(gk.p, gk.role) : 50;
  const pGoal = clamp(
    T.cornerGoalBase *
      (1 + (taker.p.attrs.passing - 60) / 100 + (header.p.attrs.physical - 60) / 120) *
      (1 + (60 - gkSkill) / 220) *
      (hasTrait(taker.p, "dead_ball") ? 1.06 : 1),
    0.008,
    0.09
  );
  const evBefore = s.events.length;
  let out: StrokeOut;
  let b: number | undefined;
  if (rng() < pGoal) {
    out = "goal";
    atkSide.goals++;
    updOf(s, header.p.id).goals++;
    s.ratings[header.p.id] = clamp(s.ratings[header.p.id] + 1.0, 4, 10);
    updOf(s, taker.p.id).assists++;
    s.ratings[taker.p.id] = clamp(s.ratings[taker.p.id] + 0.4, 4, 10);
    s.scorers.push({
      playerId: header.p.id,
      name: header.p.name,
      clubId: atkSide.clubId,
      minute: m
    });
    s.events.push({
      minute: m,
      type: "goal",
      clubId: atkSide.clubId,
      playerId: header.p.id,
      text: `${pick(rng, CORNER_GOAL_TEXT)(header.p.name, atkSide.short)} — ${taker.p.name} with the corner.`
    });
  } else if (depth < 2 && rng() < T.secondCornerShare) {
    s.events.push({
      minute: m,
      type: "corner",
      clubId: atkSide.clubId,
      playerId: taker.p.id,
      text: pick(rng, CORNER_AGAIN_TEXT)(atkSide.short, taker.p.name)
    });
    s.timeline.push({
      m,
      h: isHome(s, atkSide) ? 1 : 0,
      p: [taker.slot, header.slot],
      o: "block",
      b: header.slot,
      r: s.events.length - 1,
      sp: "corner",
      tg: [flagX, 2]
    });
    resolveCorner(s, atkSide, defSide, m, rng, players, depth + 1);
    return;
  } else {
    out = "turnover";
    const clearers = dfn.filter((x) => x.p.pos !== "GK");
    if (clearers.length) {
      const clearer = pickWeighted(
        rng,
        clearers,
        (x) => x.p.attrs.defending + x.p.attrs.physical * 0.5
      );
      b = clearer.slot;
      s.events.push({
        minute: m,
        type: "corner",
        clubId: atkSide.clubId,
        playerId: taker.p.id,
        text: pick(rng, CORNER_CLEAR_TEXT)(taker.p.name, clearer.p.name)
      });
    } else {
      s.events.push({
        minute: m,
        type: "corner",
        clubId: atkSide.clubId,
        playerId: taker.p.id,
        text: pick(rng, CORNER_TEXT)(atkSide.short, "")
      });
    }
  }
  s.timeline.push({
    m,
    h: isHome(s, atkSide) ? 1 : 0,
    p: [taker.slot, header.slot],
    o: out,
    t: 50 + randInt(rng, -14, 14),
    b,
    r: s.events.length > evBefore ? s.events.length - 1 : undefined,
    sp: "corner",
    tg: [flagX, 2]
  });
};

const processInjury = (
  s: MatchState,
  side: MatchSideState,
  m: number,
  rng: Rng,
  players: Map<string, Player>
) => {
  const on = proto(side, players);
  if (!on.length) return;
  const victim = pickWeighted(rng, on, (x) => 1 + Math.max(0, 80 - x.p.condition) / 50);
  const weeks = randInt(rng, T.injuryWeeks[0], T.injuryWeeks[1]);
  leaveSlot(s, side, victim.slot, m);
  updOf(s, victim.p.id).injuredWeeks = weeks;
  s.events.push({
    minute: m,
    type: "injury",
    clubId: side.clubId,
    playerId: victim.p.id,
    text: pick(rng, INJ_TEXT)(victim.p.name, "")
  });
  if (side.subs < T.maxSubs) {
    const repl = pickFromBench(side, victim.p.pos, players);
    if (repl) {
      enterSlot(s, side, victim.slot, repl, m, victim.role);
      s.events.push({
        minute: m,
        type: "sub",
        clubId: side.clubId,
        playerId: repl.id,
        text: pick(rng, SUB_TEXT)(victim.p.name, repl.name)
      });
    }
  }
};

const trySub = (
  s: MatchState,
  side: MatchSideState,
  m: number,
  rng: Rng,
  players: Map<string, Player>
) => {
  if (side.subs >= T.maxSubs || !side.bench.length) return;
  if (rng() < 0.5) return;
  const outfield = proto(side, players).filter((x) => x.p.pos !== "GK");
  if (!outfield.length) return;
  const val = (x: Proto) => attackScore(x.p, x.role) + defenseScore(x.p, x.role);
  const outP = outfield.reduce((worst, x) => (val(x) < val(worst) ? x : worst));
  const repl = pickFromBench(side, outP.p.pos, players);
  if (!repl) return;
  leaveSlot(s, side, outP.slot, m);
  enterSlot(s, side, outP.slot, repl, m, outP.role);
  side.windows++;
  s.events.push({
    minute: m,
    type: "sub",
    clubId: side.clubId,
    playerId: repl.id,
    text: pick(rng, SUB_TEXT)(outP.p.name, repl.name)
  });
};

// --- the minute loop ------------------------------------------------

const minuteStep = (s: MatchState, m: number, rng: Rng, players: Map<string, Player>) => {
  if (m === 1) {
    s.events.push({ minute: 0, type: "kickoff", text: `Kick-off at ${s.home.name}'s ground.` });
  }

  const hp = proto(s.home, players);
  const ap = proto(s.away, players);
  const hPlayers = hp.map((x) => x.p);
  const hRoles = hp.map((x) => x.role);
  const aPlayers = ap.map((x) => x.p);
  const aRoles = ap.map((x) => x.role);
  const attH = attackStrength(hPlayers, hRoles, s.home.mentality) * T.homeAdvantage;
  const attA = attackStrength(aPlayers, aRoles, s.away.mentality);
  const defH = defenseStrength(hPlayers, hRoles, s.home.mentality);
  const defA = defenseStrength(aPlayers, aRoles, s.away.mentality);
  const pH = clamp(T.baseChancePerMinute * 2 * (attH / (attH + defA)), 0.02, 0.45);
  const pA = clamp(T.baseChancePerMinute * 2 * (attA / (attA + defH)), 0.02, 0.45);

  const hChance = rng() < pH;
  const aChance = rng() < pA;
  if (hChance) resolveChance(s, s.home, s.away, m, rng, players);
  if (aChance) resolveChance(s, s.away, s.home, m, rng, players);
  if (!hChance && !aChance) {
    const pPossHome = clamp(0.5 + 0.35 * ((attH - attA) / (attH + attA)), 0.25, 0.75);
    const possHome = rng() < pPossHome;
    possessionPhase(s, possHome ? s.home : s.away, possHome ? s.away : s.home, m, rng, players);
  }

  const pFoul = T.foulPerMatch / 90;
  if (rng() < pFoul) {
    const homeCommits = rng() < 0.5;
    processFoul(
      s,
      homeCommits ? s.home : s.away,
      homeCommits ? s.away : s.home,
      m,
      rng,
      players
    );
  }

  const pInj = T.injuryPerMatch / (90 * 2);
  if (rng() < pInj) processInjury(s, rng() < 0.5 ? s.home : s.away, m, rng, players);

  if (m === T.subMinute || m === 72 || m === 80) {
    if (s.userSide !== "home") trySub(s, s.home, m, rng, players);
    if (s.userSide !== "away") trySub(s, s.away, m, rng, players);
  }

  if (m === HALF) {
    s.events.push({
      minute: 45,
      type: "half",
      text: `Half time: ${s.home.short} ${s.home.goals}–${s.away.goals} ${s.away.short}.`
    });
  }
};

/** Simulate minutes (state.minute, to] and return a new state. Pure. */
export function advanceTo(state: MatchState, to: number, players: Map<string, Player>): MatchState {
  const s: MatchState = structuredClone(state);
  const rng = mulberry32(s.rngState);
  const end = Math.min(to, s.total);
  for (let m = s.minute + 1; m <= end; m++) minuteStep(s, m, rng, players);
  s.minute = Math.max(s.minute, end);
  s.rngState = rng.state;
  return s;
}

/** Why a substitution cannot be made right now (null = allowed). */
export function substitutionError(
  s: MatchState,
  sideKey: "home" | "away",
  outId: string,
  inId: string
): string | null {
  const side = s[sideKey];
  if (!side.slots.includes(outId)) return "That player is not on the pitch.";
  if (!side.bench.includes(inId)) return "That player is no longer available.";
  if (side.subs >= T.maxSubs) return `No substitutions left — you've used all ${T.maxSubs}.`;
  if (s.minute !== HALF && side.windows >= T.subWindowsMax) {
    return `No in-match windows left.`;
  }
  return null;
}

/** Apply a substitution (validated by `substitutionError` first). Returns a new state. */
export function applySubstitution(
  state: MatchState,
  players: Map<string, Player>,
  sideKey: "home" | "away",
  outId: string,
  inId: string
): MatchState {
  const s: MatchState = structuredClone(state);
  const side = s[sideKey];
  const slot = side.slots.indexOf(outId);
  if (slot < 0) return state;
  const entering = players.get(inId);
  if (!entering) return state;
  leaveSlot(s, side, slot, s.minute);
  enterSlot(s, side, slot, entering, s.minute, side.roles[slot]);
  if (s.minute !== HALF) side.windows++;
  const variant = hashSeed(outId, inId, s.minute) % SUB_TEXT.length;
  s.events.push({
    minute: s.minute,
    type: "sub",
    clubId: side.clubId,
    playerId: inId,
    text: SUB_TEXT[variant](players.get(outId)?.name ?? "A player", entering.name)
  });
  return s;
}

/** Wrap the state up into the final MatchResult. Pure; safe to call more than once. */
export function finalizeMatch(state: MatchState): MatchResult {
  const s: MatchState = structuredClone(state);
  const rng = mulberry32(s.rngState);
  s.events.push({
    minute: s.total,
    type: "full",
    text: `Full time: ${s.home.short} ${s.home.goals}–${s.away.goals} ${s.away.short}.`
  });

  const finalUpdates: PlayerUpdate[] = [];
  for (const id of s.played) {
    const u = updOf(s, id);
    const start = s.entryMinute[id] ?? 0;
    const end = s.exitMinute[id] ?? s.total;
    u.minutes = Math.max(0, Math.min(s.total, end - start));
    if (u.minutes > 0) {
      u.conditionLoss = Math.max(
        3,
        Math.round((T.conditionLossStarter * u.minutes) / 90) + randInt(rng, 0, 3)
      );
    }
    finalUpdates.push(u);
  }

  const hg = s.home.goals;
  const ag = s.away.goals;
  for (const u of finalUpdates) {
    if (u.minutes <= 0) continue;
    const meta = s.pin[u.playerId];
    if (!meta) continue;
    const mine = meta.s === 0 ? hg : ag;
    const theirs = meta.s === 0 ? ag : hg;
    if (mine > theirs) {
      s.ratings[u.playerId] = clamp(s.ratings[u.playerId] + 0.2, 4, 10);
      if (theirs === 0 && (meta.pos === "GK" || meta.pos === "DF")) {
        s.ratings[u.playerId] = clamp(s.ratings[u.playerId] + 0.4, 4, 10);
      }
    } else if (mine < theirs) {
      s.ratings[u.playerId] = clamp(s.ratings[u.playerId] - 0.2, 4, 10);
    }
  }

  const rounded: Record<string, number> = {};
  for (const u of finalUpdates) {
    if (u.minutes > 0) {
      rounded[u.playerId] = Math.round((s.ratings[u.playerId] ?? T.ratingBase) * 10) / 10;
    }
  }

  return {
    fixtureKey: `${s.round}:${s.homeId}:${s.awayId}`,
    round: s.round,
    homeId: s.homeId,
    awayId: s.awayId,
    homeGoals: hg,
    awayGoals: ag,
    events: s.events,
    ratings: rounded,
    updates: finalUpdates,
    scorers: s.scorers
  };
}

/** One-shot simulation (AI matches) — identical results to split/live runs of the same seed. */
export function simulateMatch(inp: MatchInputs): MatchResult {
  const players = new Map<string, Player>();
  for (const p of [...inp.homeXI, ...inp.homeBench, ...inp.awayXI, ...inp.awayBench]) {
    players.set(p.id, p);
  }
  const s = startMatch(inp);
  return finalizeMatch(advanceTo(s, s.total, players));
}
