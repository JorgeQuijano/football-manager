import type {
  Club,
  MatchEvent,
  MatchResult,
  Mentality,
  Player,
  PlayerUpdate,
  Position,
  RoleId
} from "./types";
import { pick, pickWeighted, randInt, type Rng } from "./rng";
import { T } from "./tuning";
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
  rng: Rng;
}

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

interface Side {
  club: Club;
  xi: Player[];
  bench: Player[];
  mentality: Mentality;
  goals: number;
  subs: number;
}

export function simulateMatch(inp: MatchInputs): MatchResult {
  const rng = inp.rng;
  const events: MatchEvent[] = [];
  const ratings: Record<string, number> = {};
  const updates = new Map<string, PlayerUpdate>();
  const yellows = new Map<string, number>();
  const entryMinute = new Map<string, number>();
  const exitMinute = new Map<string, number>();
  const scorers: MatchResult["scorers"] = [];

  const sides = {
    home: {
      club: inp.homeClub,
      xi: [...inp.homeXI],
      bench: [...inp.homeBench],
      mentality: inp.homeMentality,
      goals: 0,
      subs: 0
    } as Side,
    away: {
      club: inp.awayClub,
      xi: [...inp.awayXI],
      bench: [...inp.awayBench],
      mentality: inp.awayMentality,
      goals: 0,
      subs: 0
    } as Side
  };

  for (const p of [
    ...inp.homeXI, ...inp.homeBench,
    ...inp.awayXI, ...inp.awayBench
  ]) {
    ratings[p.id] = T.ratingBase;
  }
  const played = new Set<string>();
  for (const p of [...inp.homeXI, ...inp.awayXI]) {
    entryMinute.set(p.id, 0);
    played.add(p.id);
  }

  const roleOf = new Map<string, RoleId>();
  inp.homeXI.forEach((p, i) => roleOf.set(p.id, inp.homeRoles[i] ?? defaultRoleFor(p.pos)));
  inp.awayXI.forEach((p, i) => roleOf.set(p.id, inp.awayRoles[i] ?? defaultRoleFor(p.pos)));
  const roleFor = (p: Player): RoleId => roleOf.get(p.id) ?? defaultRoleFor(p.pos);

  const upd = (p: Player): PlayerUpdate => {
    let u = updates.get(p.id);
    if (!u) {
      u = {
        playerId: p.id,
        minutes: 0,
        goals: 0,
        assists: 0,
        yellow: 0,
        red: false,
        injuredWeeks: 0,
        conditionLoss: 0
      };
      updates.set(p.id, u);
    }
    return u;
  };

  const rolesOf = (s: Side): RoleId[] => s.xi.map((p) => roleFor(p));

  const teamAtt = (s: Side, isHome: boolean) =>
    attackStrength(s.xi, rolesOf(s), s.mentality) * (isHome ? T.homeAdvantage : 1);
  const teamDef = (s: Side) => defenseStrength(s.xi, rolesOf(s), s.mentality);

  const enter = (s: Side, p: Player, minute: number, role: RoleId) => {
    s.bench.splice(s.bench.indexOf(p), 1);
    s.xi.push(p);
    entryMinute.set(p.id, minute);
    played.add(p.id);
    roleOf.set(p.id, role);
    s.subs++;
  };

  const pickFromBench = (s: Side, slot: Position): Player | undefined => {
    if (!s.bench.length) return undefined;
    return [...s.bench].sort(
      (a, b) =>
        overallFor(b) * suitability(b, slot) - overallFor(a) * suitability(a, slot)
    )[0];
  };

  const removeFromPitch = (s: Side, p: Player, minute: number) => {
    const i = s.xi.indexOf(p);
    if (i >= 0) s.xi.splice(i, 1);
    if (!exitMinute.has(p.id)) exitMinute.set(p.id, minute);
  };

  const resolveChance = (atk: Side, def: Side, minute: number) => {
    const shooters = atk.xi.filter((p) => p.pos !== "GK");
    if (!shooters.length) return;
    const shooter = pickWeighted(
      rng,
      shooters,
      (p) =>
        (p.pos === "FW" ? 4 : p.pos === "MF" ? 2.4 : 0.7) *
        (0.5 + p.attrs.shooting / 100) *
        ROLE_DEFS[roleFor(p)].shot
    );
    const gk = def.xi.find((p) => p.pos === "GK") ?? def.xi[0];
    const finish =
      roleFinish(shooter, roleFor(shooter)) * ROLE_DEFS[roleFor(shooter)].finish;
    const gkSkill = gk ? defenseScore(gk, roleFor(gk)) : 50;
    let pGoal = T.conversionBase * (1 + (finish - 60) / 120) * (1 + (60 - gkSkill) / 160);
    pGoal = clamp(pGoal, 0.04, 0.3);

    if (rng() < pGoal) {
      atk.goals++;
      upd(shooter).goals++;
      ratings[shooter.id] = clamp(ratings[shooter.id] + 1.0, 4, 10);

      const mates = atk.xi.filter((p) => p.id !== shooter.id && p.pos !== "GK");
      const assister =
        mates.length > 0 && rng() < T.assistChance
          ? pickWeighted(rng, mates, (p) => p.attrs.passing * ROLE_DEFS[roleFor(p)].assist)
          : undefined;
      if (assister) {
        upd(assister).assists++;
        ratings[assister.id] = clamp(ratings[assister.id] + 0.4, 4, 10);
      }

      scorers.push({
        playerId: shooter.id,
        name: shooter.name,
        clubId: atk.club.id,
        minute
      });
      events.push({
        minute,
        type: "goal",
        clubId: atk.club.id,
        playerId: shooter.id,
        text:
          pick(rng, GOAL_TEXT)(shooter.name, atk.club.short) +
          (assister ? pick(rng, ASSIST_SUFFIX)(assister.name, "") : "")
      });
    } else if (rng() < T.saveShare) {
      events.push({
        minute,
        type: "save",
        clubId: def.club.id,
        playerId: gk?.id,
        text: pick(rng, SAVE_TEXT)(shooter.name, gk?.name ?? "the keeper")
      });
      if (gk) ratings[gk.id] = clamp(ratings[gk.id] + 0.15, 4, 10);
    } else {
      const blockers = def.xi.filter((p) => p.pos !== "GK");
      const defMean =
        blockers.reduce((acc, p) => acc + defenseScore(p, roleFor(p)), 0) /
        Math.max(1, blockers.length);
      if (blockers.length > 0 && rng() < T.blockShare * clamp(defMean / 62, 0.6, 1.4)) {
        const blocker = pickWeighted(rng, blockers, (p) => defenseScore(p, roleFor(p)));
        ratings[blocker.id] = clamp(ratings[blocker.id] + 0.15, 4, 10);
        events.push({
          minute,
          type: "block",
          clubId: def.club.id,
          playerId: blocker.id,
          text: pick(rng, BLOCK_TEXT)(shooter.name, blocker.name)
        });
      } else {
        events.push({
          minute,
          type: "miss",
          clubId: atk.club.id,
          playerId: shooter.id,
          text: pick(rng, MISS_TEXT)(shooter.name, "")
        });
      }
    }
  };

  const processCard = (s: Side, minute: number) => {
    const offenders = s.xi.filter((p) => p.pos !== "GK");
    if (!offenders.length) return;
    const offender = pickWeighted(
      rng,
      offenders,
      (p) =>
        (p.pos === "DF" ? 2 : p.pos === "MF" ? 1.5 : 1) *
        (1 + Math.max(0, 70 - p.attrs.defending) / 80) *
        (1 + (p.attrs.physical - 65) / 250)
    );
    if (rng() < T.redChancePerFoul) {
      removeFromPitch(s, offender, minute);
      upd(offender).red = true;
      ratings[offender.id] = clamp(ratings[offender.id] - 0.5, 4, 10);
      events.push({
        minute,
        type: "red",
        clubId: s.club.id,
        playerId: offender.id,
        text: `Straight red! ${offender.name} is off for a reckless lunge.`
      });
      return;
    }
    const count = (yellows.get(offender.id) ?? 0) + 1;
    yellows.set(offender.id, count);
    if (count >= 2) {
      removeFromPitch(s, offender, minute);
      upd(offender).red = true;
      ratings[offender.id] = clamp(ratings[offender.id] - 0.5, 4, 10);
      events.push({
        minute,
        type: "red",
        clubId: s.club.id,
        playerId: offender.id,
        text: `Second yellow — ${offender.name} is sent off.`
      });
    } else {
      upd(offender).yellow++;
      ratings[offender.id] = clamp(ratings[offender.id] - 0.15, 4, 10);
      events.push({
        minute,
        type: "yellow",
        clubId: s.club.id,
        playerId: offender.id,
        text: pick(rng, YELLOW_TEXT)(offender.name, "")
      });
    }
  };

  const processInjury = (s: Side, minute: number) => {
    if (!s.xi.length) return;
    const victim = pickWeighted(rng, s.xi, (p) => 1 + Math.max(0, 80 - p.condition) / 50);
    const weeks = randInt(rng, T.injuryWeeks[0], T.injuryWeeks[1]);
    removeFromPitch(s, victim, minute);
    upd(victim).injuredWeeks = weeks;
    events.push({
      minute,
      type: "injury",
      clubId: s.club.id,
      playerId: victim.id,
      text: pick(rng, INJ_TEXT)(victim.name, "")
    });
    if (s.subs < T.maxSubs) {
      const repl = pickFromBench(s, victim.pos);
      if (repl) {
        enter(s, repl, minute, roleFor(victim));
        events.push({
          minute,
          type: "sub",
          clubId: s.club.id,
          playerId: repl.id,
          text: pick(rng, SUB_TEXT)(victim.name, repl.name)
        });
      }
    }
  };

  const trySub = (s: Side, minute: number) => {
    if (s.subs >= T.maxSubs || !s.bench.length) return;
    if (rng() < 0.5) return;
    const outfield = s.xi.filter((p) => p.pos !== "GK");
    if (!outfield.length) return;
    const val = (p: Player) => attackScore(p, roleFor(p)) + defenseScore(p, roleFor(p));
    const outP = outfield.reduce((worst, p) => (val(p) < val(worst) ? p : worst));
    const repl = pickFromBench(s, outP.pos);
    if (!repl) return;
    removeFromPitch(s, outP, minute);
    enter(s, repl, minute, roleFor(outP));
    events.push({
      minute,
      type: "sub",
      clubId: s.club.id,
      playerId: repl.id,
      text: pick(rng, SUB_TEXT)(outP.name, repl.name)
    });
  };

  const stoppage = randInt(rng, 1, 5);
  const total = 90 + stoppage;

  events.push({
    minute: 0,
    type: "kickoff",
    text: `Kick-off at ${inp.homeClub.name}'s ground.`
  });

  for (let m = 1; m <= total; m++) {
    const attH = teamAtt(sides.home, true);
    const attA = teamAtt(sides.away, false);
    const defH = teamDef(sides.home);
    const defA = teamDef(sides.away);
    const pH = clamp(T.baseChancePerMinute * 2 * (attH / (attH + defA)), 0.02, 0.45);
    const pA = clamp(T.baseChancePerMinute * 2 * (attA / (attA + defH)), 0.02, 0.45);

    if (rng() < pH) resolveChance(sides.home, sides.away, m);
    if (rng() < pA) resolveChance(sides.away, sides.home, m);

    const pFoul = T.yellowPerMatch / (90 * 2);
    if (rng() < pFoul) processCard(rng() < 0.5 ? sides.home : sides.away, m);

    const pInj = T.injuryPerMatch / (90 * 2);
    if (rng() < pInj) processInjury(rng() < 0.5 ? sides.home : sides.away, m);

    if (m === T.subMinute || m === 72 || m === 80) {
      trySub(sides.home, m);
      trySub(sides.away, m);
    }

    if (m === 45) {
      events.push({
        minute: 45,
        type: "half",
        text: `Half time: ${sides.home.club.short} ${sides.home.goals}–${sides.away.goals} ${sides.away.club.short}.`
      });
    }
  }

  events.push({
    minute: total,
    type: "full",
    text: `Full time: ${sides.home.club.short} ${sides.home.goals}–${sides.away.goals} ${sides.away.club.short}.`
  });

  // finalize minutes/condition for everyone who took part
  const finalUpdates: PlayerUpdate[] = [];
  for (const id of played) {
    let u = updates.get(id);
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
      updates.set(id, u);
    }
    const start = entryMinute.get(id) ?? 0;
    const end = exitMinute.get(id) ?? total;
    u.minutes = Math.max(0, Math.min(total, end - start));
    if (u.minutes > 0) {
      u.conditionLoss = Math.max(
        3,
        Math.round((T.conditionLossStarter * u.minutes) / 90) + randInt(rng, 0, 3)
      );
    }
    finalUpdates.push(u);
  }

  // end-of-match rating adjustments — apply to everyone who actually appeared
  const hg = sides.home.goals;
  const ag = sides.away.goals;
  const info = new Map<string, { side: "home" | "away"; pos: Position }>();
  for (const p of [...inp.homeXI, ...inp.homeBench]) info.set(p.id, { side: "home", pos: p.pos });
  for (const p of [...inp.awayXI, ...inp.awayBench]) info.set(p.id, { side: "away", pos: p.pos });

  for (const u of finalUpdates) {
    if (u.minutes <= 0) continue;
    const meta = info.get(u.playerId);
    if (!meta) continue;
    const mine = meta.side === "home" ? hg : ag;
    const theirs = meta.side === "home" ? ag : hg;
    if (mine > theirs) {
      ratings[u.playerId] = clamp(ratings[u.playerId] + 0.2, 4, 10);
      if (theirs === 0 && (meta.pos === "GK" || meta.pos === "DF")) {
        ratings[u.playerId] = clamp(ratings[u.playerId] + 0.4, 4, 10);
      }
    } else if (mine < theirs) {
      ratings[u.playerId] = clamp(ratings[u.playerId] - 0.2, 4, 10);
    }
  }

  const rounded: Record<string, number> = {};
  for (const u of finalUpdates) {
    if (u.minutes > 0) {
      rounded[u.playerId] = Math.round((ratings[u.playerId] ?? T.ratingBase) * 10) / 10;
    }
  }

  return {
    fixtureKey: `${inp.round}:${inp.homeClub.id}:${inp.awayClub.id}`,
    round: inp.round,
    homeId: inp.homeClub.id,
    awayId: inp.awayClub.id,
    homeGoals: hg,
    awayGoals: ag,
    events,
    ratings: rounded,
    updates: finalUpdates,
    scorers
  };
}
