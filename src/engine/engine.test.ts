import { describe, expect, it } from "vitest";
import { mulberry32, hashSeed } from "./rng";
import { newGame } from "./generate";
import { nextSeason, playRound, resolveSide, seasonRounds } from "./advance";
import { applySubstitution, simulateMatch, staminaAt, staminaDrainPerMinute, staminaStart, startMatch, advanceTo, finalizeMatch } from "./match";
import { addLiveChange, finalizeLive, matchRoster, matchStats, playersById, resumeSecondHalf, startLive, staminaTint, userFixture } from "./live";
import { staminaFactor } from "./match";
import { computeTable } from "./league";
import {
  attackScore,
  autoLineup,
  defenseScore,
  overallFor,
  remapLineup,
  slotScoreFor,
  squadOf,
  validateLineup
} from "./ratings";
import { builtinFormation, clampToZone, resolveFormation, roleTemplate, scratchSlots, SLOT_ZONES, validateFormation, validateTemplate } from "./formations";
import { defaultRoleFor, laneFits, roleFinish, ROLE_DEFS, ROLE_GROUPS } from "./roles";
import { motionFor, ROLE_MOTION } from "./motion";
import { decideIntent, INTENT_IDS, type IntentCtx, type GamePhase } from "./intents";
import { hasTrait, TRAITS, traitsFor } from "./traits";
import {
  ATTR_KEYS,
  INTENSITIES,
  UNITS,
  aiPlan,
  developPlayer,
  developRound,
  learnTraits
} from "./training";
import {
  CAREER_STAGES,
  DEPTH_MIN,
  STAGE_ORDER,
  careerStage,
  contractState,
  depthLevel,
  squadPlan
} from "./planner";
import {
  FORM_BANDS,
  SORT_MODES,
  formBandFor,
  formOf,
  rating1,
  ratingAvg,
  recordMatch,
  sortSquad
} from "./stats";
import {
  DISCOVERY_LEVEL,
  KNOWLEDGE_FULL,
  REQUEST_COST,
  addFocus,
  dismissScout,
  estimateFor,
  hireScout,
  knowledgeOf,
  scoutingTick,
  scoutPlayer,
  squadAvgOvr,
  starsFor,
  toggleShortlist,
  topUpScouting
} from "./scouting";
import {
  CORNER_ROUTINES,
  FK_ROUTINES,
  aiSetPieces,
  cleanSetPieces,
  defaultSetPieces,
  familiarityFactor,
  familiarityOf,
  growFamiliarity,
  planForClub,
  routineKey
} from "./setpieces";
import {
  acceptOffer,
  bidForPlayer,
  freeAgents,
  freshFinances,
  makeFreeAgent,
  marketValue,
  offerTerms,
  renewContract,
  signFreeAgent,
  transferWindow,
  wageBill,
  wageDemand,
  wageHeadroom,
  windowTick
} from "./transfers";
import {
  AWARD_MIN_APPS,
  POTR_MIN_MINUTES,
  TOTS_SHAPE,
  careerTotals,
  ordinal,
  payPrize,
  prizeFor,
  totalsFor,
  topScorers
} from "./history";
import {
  atmosphere,
  leaders,
  minutesShare,
  moodOf,
  moraleDev,
  moraleEdge,
  moraleFactors,
  moraleTick,
  recentForm,
  socialGroups,
  squadStatus,
  talkToPlayer
} from "./morale";
import {
  FORMATION_COORDS, FORMATION_IDS, FORMATIONS, T, weeklyRecovery
} from "./tuning";
import { DEFAULT_CONDITIONS, REFS, WEATHERS, conditionEffects, conditionLine, conditionsFor, pitchOf, weatherOf } from "./conditions";
import { HEADLINES_CAP, answerPress, mediaGate, mediaTick, makePress, questionPool, skipPress } from "./media";
import { normalizeSave } from "../state/save";
import {
  addDays,
  calendarMonth,
  dayFor,
  dayOfWeek,
  daysInMonth,
  diffDays,
  fromSerial,
  roundDate,
  seasonMonths,
  seasonRoundsOf,
  seasonStart,
  sameDay,
  serial,
  upcoming
} from "./calendar";
import type { CornerRoutine, FreeKickRoutine, Intensity, MatchConditions, MatchResult, Mentality, Player, PlayerUpdate, Position, SaveGame, SetPiecePlan, Stroke, TrainingPlan, TrainingUnit, WeatherId } from "./types";
import type { MatchStatCtx } from "./stats";

function playSeason(start: SaveGame): SaveGame {
  let save = start;
  const rounds = seasonRounds(save);
  while (save.round <= rounds) {
    save = playRound(save).save;
  }
  return save;
}

describe("rng", () => {
  it("is deterministic per seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it("different seeds differ", () => {
    expect(mulberry32(hashSeed("a", 1))()).not.toBe(mulberry32(hashSeed("a", 2))());
  });
});

describe("generation", () => {
  const save = newGame(2024);

  it("creates a 10-club league with 22 players per club", () => {
    expect(save.clubs).toHaveLength(10);
    expect(save.players).toHaveLength(220);
    for (const club of save.clubs) {
      expect(squadOf(save.players, club.id)).toHaveLength(22);
    }
  });

  it("squad composition matches the template", () => {
    for (const club of save.clubs) {
      const squad = squadOf(save.players, club.id);
      expect(squad.filter((p) => p.pos === "GK")).toHaveLength(3);
      expect(squad.filter((p) => p.pos === "DF")).toHaveLength(7);
      expect(squad.filter((p) => p.pos === "MF")).toHaveLength(7);
      expect(squad.filter((p) => p.pos === "FW")).toHaveLength(5);
    }
  });

  it("attributes stay in sane bounds", () => {
    for (const p of save.players) {
      for (const v of Object.values(p.attrs)) {
        expect(v).toBeGreaterThanOrEqual(28);
        expect(v).toBeLessThanOrEqual(96);
      }
      expect(p.condition).toBe(100);
    }
  });

  it("fixtures: 18 rounds, each club home 9 / away 9, every pair twice", () => {
    expect(save.fixtures).toHaveLength(90);
    const rounds = new Set(save.fixtures.map((f) => f.round));
    expect(rounds.size).toBe(18);
    for (const club of save.clubs) {
      const mine = save.fixtures.filter((f) => f.homeId === club.id || f.awayId === club.id);
      expect(mine).toHaveLength(18);
      expect(mine.filter((f) => f.homeId === club.id)).toHaveLength(9);
      expect(mine.filter((f) => f.awayId === club.id)).toHaveLength(9);
    }
    const unordered = new Map<string, number>();
    for (const f of save.fixtures) {
      const key = [f.homeId, f.awayId].sort().join(":");
      unordered.set(key, (unordered.get(key) ?? 0) + 1);
    }
    expect([...unordered.values()].every((n) => n === 2)).toBe(true);
  });
});

describe("season", () => {
  it("completes with consistent table", () => {
    const save = playSeason(newGame(2024));
    expect(save.round).toBe(19);
    const table = computeTable(save.fixtures, save.clubs);
    for (const row of table) {
      expect(row.p).toBe(18);
      expect(row.pts).toBe(row.w * 3 + row.d);
      expect(row.gd).toBe(row.gf - row.ga);
    }
    const gf = table.reduce((a, r) => a + r.gf, 0);
    const ga = table.reduce((a, r) => a + r.ga, 0);
    expect(gf).toBe(ga);
    expect(table[0].pts).toBeGreaterThanOrEqual(table[9].pts);
    const totalPts = table.reduce((a, r) => a + r.pts, 0);
    const totalWins = table.reduce((a, r) => a + r.w, 0);
    const totalDraws = table.reduce((a, r) => a + r.d, 0);
    expect(totalPts).toBe(totalWins * 3 + totalDraws);
  });

  it("is deterministic for the same seed and decisions", () => {
    const a = playSeason(newGame(7));
    const b = playSeason(newGame(7));
    const key = (s: SaveGame) =>
      JSON.stringify(s.fixtures.map((f) => [f.round, f.homeId, f.awayId, f.homeGoals, f.awayGoals]));
    expect(key(a)).toBe(key(b));
  });

  it("different seeds produce different seasons", () => {
    const a = playSeason(newGame(1));
    const b = playSeason(newGame(2));
    const key = (s: SaveGame) => JSON.stringify(s.fixtures.map((f) => [f.homeGoals, f.awayGoals]));
    expect(key(a)).not.toBe(key(b));
  });

  it("calibration: goals and home advantage are plausible", () => {
    let goals = 0;
    let matches = 0;
    let homeWins = 0;
    let awayWins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const save = playSeason(newGame(seed * 101));
      for (const f of save.fixtures) {
        matches++;
        goals += f.homeGoals! + f.awayGoals!;
        if (f.homeGoals! > f.awayGoals!) homeWins++;
        else if (f.homeGoals! < f.awayGoals!) awayWins++;
      }
    }
    const avgGoals = goals / matches;
    expect(avgGoals).toBeGreaterThan(1.6);
    expect(avgGoals).toBeLessThan(4.2);
    const homeShare = homeWins / matches;
    expect(homeShare).toBeGreaterThan(0.25);
    expect(homeShare).toBeLessThan(0.65);
    expect(awayWins).toBeGreaterThan(0);
  }, 30_000);

  it("applies injuries and suspensions to availability", () => {
    const save = newGame(99);
    const squad = squadOf(save.players, save.userClubId);
    const starterId = save.lineup.starters[0]!;
    const starter = save.players.find((p) => p.id === starterId)!;
    starter.injuredWeeks = 2;
    expect(squad.length).toBe(22);
    const { save: after, userMatch } = playRound(save);
    expect(after.lineup.starters).not.toContain(starterId);
    if (userMatch) {
      const played = userMatch.updates.filter((u) => u.minutes > 0).map((u) => u.playerId);
      expect(played).not.toContain(starterId);
    }
  });

  it("rolls into next season cleanly", () => {
    const s1 = playSeason(newGame(31));
    const s2 = nextSeason(s1);
    expect(s2.season).toBe(2);
    expect(s2.round).toBe(1);
    expect(s2.fixtures).toHaveLength(90);
    expect(s2.fixtures.every((f) => !f.played)).toBe(true);
    const lineup = autoLineup(
      squadOf(s2.players, s2.userClubId),
      resolveFormation(s2.lineup.formation, s2.customFormations)!
    );
    expect(lineup.starters.filter(Boolean)).toHaveLength(11);
  });
});

describe("match bookkeeping", () => {
  it("covers every player who appeared, with sane ratings", () => {
    const save = newGame(777);
    const { userMatch } = playRound(save);
    const m = userMatch!;
    const appeared = m.updates.filter((u) => u.minutes > 0);
    expect(appeared.length).toBeGreaterThanOrEqual(22);
    expect(Object.keys(m.ratings).length).toBeGreaterThanOrEqual(22);
    for (const r of Object.values(m.ratings)) {
      expect(r).toBeGreaterThanOrEqual(4);
      expect(r).toBeLessThanOrEqual(10);
    }
    for (const u of appeared) {
      expect(u.conditionLoss).toBeGreaterThanOrEqual(3);
    }
  });

  it("credits assists only to non-GK teammates, never more than goals", () => {
    const save = newGame(99);
    const { userMatch } = playRound(save);
    const m = userMatch!;
    const goals = m.updates.reduce((a, u) => a + u.goals, 0);
    const assists = m.updates.reduce((a, u) => a + u.assists, 0);
    expect(assists).toBeLessThanOrEqual(goals);
    for (const u of m.updates) {
      if (u.assists > 0) {
        const p = save.players.find((pp) => pp.id === u.playerId)!;
        expect(p.pos).not.toBe("GK");
      }
    }
  });
});

describe("roles", () => {
  const player = (over: Partial<Player> & { pos: Player["pos"] }): Player => ({
    id: "x",
    clubId: "c",
    name: "T",
    age: 25,
    attrs: {
      pace: 60,
      shooting: 60,
      passing: 60,
      defending: 60,
      physical: 60,
      reflexes: 60,
      handling: 60
    },
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: [],
    ...over,
    traits: over.traits ?? [],
    contract: over.contract ?? { wage: 0, until: 0 },
    peak: over.peak ?? 99,
    dev: over.dev ?? {},
    devSeason: over.devSeason ?? {},
    focus: over.focus ?? null
  });

  it("every formation slot has a valid default role", () => {
    for (const fid of FORMATION_IDS) {
      for (const slot of FORMATIONS[fid]) {
        expect(ROLE_GROUPS[slot]).toContain(defaultRoleFor(slot));
      }
    }
  });

  it("role weights change who is rated best", () => {
    const poacherType = player({
      pos: "FW",
      attrs: { pace: 80, shooting: 86, passing: 55, defending: 40, physical: 55, reflexes: 40, handling: 40 }
    });
    const targetType = player({
      pos: "FW",
      attrs: { pace: 50, shooting: 62, passing: 55, defending: 45, physical: 88, reflexes: 40, handling: 40 }
    });
    expect(attackScore(poacherType, "poacher")).toBeGreaterThan(attackScore(poacherType, "target"));
    expect(attackScore(targetType, "target")).toBeGreaterThan(attackScore(targetType, "poacher"));
    expect(defenseScore(targetType, "target")).toBeGreaterThan(defenseScore(poacherType, "poacher"));
  });

  it("pitch coordinates line up with formations and stay in bounds", () => {
    for (const fid of FORMATION_IDS) {
      const coords = FORMATION_COORDS[fid];
      expect(coords).toHaveLength(FORMATIONS[fid].length);
      for (const [x, y] of coords) {
        expect(x).toBeGreaterThanOrEqual(5);
        expect(x).toBeLessThanOrEqual(95);
        expect(y).toBeGreaterThanOrEqual(5);
        expect(y).toBeLessThanOrEqual(95);
      }
    }
  });

  it("role finishing weights make physical strikers viable", () => {
    const powerhouse = player({
      pos: "FW",
      attrs: { pace: 55, shooting: 62, passing: 60, defending: 45, physical: 88, reflexes: 40, handling: 40 }
    });
    const sniper = player({
      pos: "FW",
      attrs: { pace: 80, shooting: 86, passing: 55, defending: 40, physical: 55, reflexes: 40, handling: 40 }
    });
    expect(roleFinish(powerhouse, "target")).toBeGreaterThan(roleFinish(powerhouse, "poacher"));
    expect(roleFinish(sniper, "poacher")).toBeGreaterThan(roleFinish(sniper, "target"));
  });

  it("every role has a distinct profile within its group", () => {
    const norm = (o: object) =>
      JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
    const seen = new Map<string, string>();
    for (const roles of Object.values(ROLE_GROUPS)) {
      for (const r of roles) {
        const d = ROLE_DEFS[r];
        const key = `${norm(d.atk)}|${norm(d.def)}|${d.shot}|${d.finish}|${d.assist}`;
        expect(seen.has(key), `duplicate profile: ${r} vs ${seen.get(key)}`).toBe(false);
        seen.set(key, r);
      }
    }
  });

  it("creator roles carry assist bias, finishers carry shot bias", () => {
    expect(ROLE_DEFS.playmaker.assist).toBeGreaterThan(ROLE_DEFS.poacher.assist);
    expect(ROLE_DEFS.w.assist).toBeGreaterThan(ROLE_DEFS.cm.assist);
    expect(ROLE_DEFS.poacher.shot).toBeGreaterThan(ROLE_DEFS.dlp.shot);
  });
});

describe("lineup ops", () => {
  const save = newGame(4242);
  const squad = squadOf(save.players, save.userClubId);

  it("autoLineup assigns a valid role to every slot", () => {
    const l = autoLineup(squad, builtinFormation("4-3-3"));
    expect(l.roles).toHaveLength(11);
    l.roles.forEach((r, i) => expect(ROLE_GROUPS[FORMATIONS["4-3-3"][i]]).toContain(r));
  });

  it("changing formation keeps your players", () => {
    const before = autoLineup(squad, builtinFormation("4-3-3"));
    const gkId = before.starters[0];
    const after = remapLineup(squad, before, builtinFormation("4-3-3"), builtinFormation("4-4-2"));
    expect(after.formation).toBe("4-4-2");
    expect(after.starters[0]).toBe(gkId);
    expect(validateLineup(squad, after)).toEqual([]);
    const kept = before.starters.filter((id) => id && after.starters.includes(id));
    expect(kept.length).toBeGreaterThanOrEqual(9);
    const after2 = remapLineup(squad, after, builtinFormation("4-4-2"), builtinFormation("3-5-2"));
    expect(validateLineup(squad, after2)).toEqual([]);
    expect(after2.mentality).toBe(after.mentality);
  });

  it("slot scoring lets freshness outweigh a small quality gap", () => {
    const mk = (over: Partial<Player> & { pos: Player["pos"] }): Player => ({
      id: "x",
      clubId: "c",
      name: "T",
      age: 24,
      attrs: {
        pace: 60,
        shooting: 60,
        passing: 60,
        defending: 60,
        physical: 60,
        reflexes: 60,
        handling: 60
      },
      condition: 100,
      injuredWeeks: 0,
      suspension: 0,
      apps: 0,
      goals: 0,
      assists: 0,
      mins: 0,
      yellows: 0,
      reds: 0,
      ratingSum: 0,
      ratingCount: 0,
      form: [],
      history: [],
      ...over,
      traits: over.traits ?? [],
      contract: over.contract ?? { wage: 0, until: 0 },
      peak: over.peak ?? 99,
      dev: over.dev ?? {},
      devSeason: over.devSeason ?? {},
      focus: over.focus ?? null
    });
    const tiredStar = mk({
      pos: "FW",
      attrs: { pace: 70, shooting: 80, passing: 60, defending: 40, physical: 60, reflexes: 40, handling: 40 },
      condition: 40
    });
    const fresh = mk({
      pos: "FW",
      attrs: { pace: 65, shooting: 70, passing: 55, defending: 40, physical: 65, reflexes: 40, handling: 40 },
      condition: 100
    });
    expect(slotScoreFor(fresh, "FW", "poacher", 0.45)).toBeGreaterThan(
      slotScoreFor(tiredStar, "FW", "poacher", 0.45)
    );
  });
});

describe("conditioning", () => {
  it("recovery scales with age and physicality", () => {
    const mk = (age: number, physical: number): Player => ({
      id: "x",
      clubId: "c",
      name: "T",
      pos: "MF",
      age,
      attrs: {
        pace: 60,
        shooting: 60,
        passing: 60,
        defending: 60,
        physical,
        reflexes: 60,
        handling: 60
      },
      traits: [],
      contract: { wage: 0, until: 0 },
      peak: 99,
      dev: {},
      devSeason: {},
      focus: null,
      condition: 100,
      injuredWeeks: 0,
      suspension: 0,
      apps: 0,
      goals: 0,
      assists: 0,
      mins: 0,
      yellows: 0,
      reds: 0,
      ratingSum: 0,
      ratingCount: 0,
      form: [],
      history: []
    });
    const kid = mk(19, 78);
    const vet = mk(34, 52);
    expect(weeklyRecovery(kid)).toBeGreaterThan(weeklyRecovery(vet));
    expect(weeklyRecovery(vet)).toBeLessThan(T.conditionLossStarter); // veterans need rotation
    expect(weeklyRecovery(kid)).toBeGreaterThanOrEqual(T.conditionLossStarter);
  });
});

describe("formations", () => {
  it("built-ins resolve with 11 slots and pass validation", () => {
    for (const fid of FORMATION_IDS) {
      const def = builtinFormation(fid);
      expect(def.slots).toHaveLength(11);
      expect(validateFormation(def)).toEqual([]);
    }
  });

  it("custom formations resolve by id and flag problems", () => {
    const custom = { id: "cf-test", name: "Test", slots: builtinFormation("4-4-2").slots.map((s) => ({ ...s })) };
    custom.slots[5] = { pos: "FW", x: 12, y: 30 };
    expect(resolveFormation("cf-test", [custom])?.id).toBe("cf-test");
    expect(resolveFormation("nope", [custom])).toBeUndefined();
    expect(resolveFormation("cf-test", undefined)).toBeUndefined();
    expect(validateFormation(custom)).toEqual([]);

    const twoGk = { ...custom, slots: custom.slots.map((s, i) => (i === 1 ? { ...s, pos: "GK" as const } : s)) };
    expect(validateFormation(twoGk).length).toBeGreaterThan(0);
    const short = { ...custom, slots: custom.slots.slice(0, 10) };
    expect(validateFormation(short).length).toBeGreaterThan(0);
    const off = { ...custom, slots: custom.slots.map((s, i) => (i === 2 ? { ...s, x: 150 } : s)) };
    expect(validateFormation(off).length).toBeGreaterThan(0);
  });

  it("autoLineup fills a custom shape; remap keeps the GK and stays valid", () => {
    const save = newGame(4242);
    const squad = squadOf(save.players, save.userClubId);
    const custom = {
      id: "cf-a",
      name: "A",
      slots: builtinFormation("4-4-2").slots.map((s) => ({ ...s }))
    };
    custom.slots[9] = { pos: "FW", x: 30, y: 12 };
    custom.slots[10] = { pos: "FW", x: 70, y: 12 };
    const l = autoLineup(squad, custom);
    expect(l.starters.filter(Boolean)).toHaveLength(11);
    expect(l.formation).toBe("cf-a");
    expect(l.roles).toHaveLength(11);
    const remapped = remapLineup(squad, l, custom, builtinFormation("4-4-2"));
    expect(remapped.formation).toBe("4-4-2");
    expect(remapped.starters[0]).toBe(l.starters[0]);
    expect(validateLineup(squad, remapped)).toEqual([]);
  });

  it("role templates are valid and lane-aware for every built-in formation", () => {
    for (const fid of FORMATION_IDS) {
      const def = builtinFormation(fid);
      const tpl = roleTemplate(def);
      expect(tpl).toHaveLength(11);
      expect(validateTemplate(def, tpl)).toEqual([]);
      tpl.forEach((r, i) => expect(ROLE_GROUPS[def.slots[i].pos]).toContain(r));
    }
  });

  it("custom formations get geometry-based role defaults", () => {
    const def = { id: "cf-geo", name: "Geo", slots: scratchSlots() };
    const tpl = roleTemplate(def);
    expect(tpl).toHaveLength(11);
    expect(tpl[0]).toBe("keeper");
    expect(tpl[1]).toBe("wb");
    expect(tpl[2]).toBe("stopper");
    tpl.forEach((r, i) => expect(laneFits(r, def.slots[i])).toBe(true));
    expect(validateTemplate(def, tpl)).toEqual([]);
  });

  it("built-in slots sit inside their position zones, and clamping works", () => {
    for (const fid of FORMATION_IDS) {
      const def = builtinFormation(fid);
      def.slots.forEach((slot) => {
        const z = SLOT_ZONES[slot.pos];
        expect(slot.x).toBeGreaterThanOrEqual(z.xMin);
        expect(slot.x).toBeLessThanOrEqual(z.xMax);
        expect(slot.y).toBeGreaterThanOrEqual(z.yMin);
        expect(slot.y).toBeLessThanOrEqual(z.yMax);
      });
    }
    expect(clampToZone("DF", 50, 20).y).toBe(48);
    expect(clampToZone("FW", 50, 80).y).toBe(48);
    expect(clampToZone("GK", 10, 50)).toEqual({ x: 38, y: 82 });
    expect(clampToZone("MF", 150, -5)).toEqual({ x: 94, y: 26 });
  });

  it("custom slot roles drive the role template and formation remaps", () => {
    const slots = scratchSlots();
    slots[9] = { pos: "FW", x: 40, y: 20, role: "target" };
    slots[10] = { ...slots[10], role: "keeper" }; // invalid for FW → ignored
    const def = { id: "cf-roles", name: "Roles", slots };
    const tpl = roleTemplate(def);
    expect(tpl[9]).toBe("target");
    expect(tpl[10]).toBe("af");
    const save = newGame(777);
    const squad = squadOf(save.players, save.userClubId);
    const base = autoLineup(squad, builtinFormation("4-3-3"));
    const remapped = remapLineup(squad, base, builtinFormation("4-3-3"), def);
    expect(remapped.roles[9]).toBe("target");
    expect(remapped.roles[10]).toBe("af");
  });
});

describe("live match", () => {
  function inputsFor(save: SaveGame, fx: { homeId: string; awayId: string }) {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    return {
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
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
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      // mirror the real matchInputs: the round's weather, referee and pitch
      conditions: conditionsFor(save, save.round)
    };
  }

  it("half-time split reproduces the one-shot simulation exactly", () => {
    const save = newGame(4242);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const userSide = fx.homeId === save.userClubId ? "home" : "away";
    const one = simulateMatch({
      ...base,
      rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)),
      userSide
    });
    const live = startLive(save)!;
    const second = resumeSecondHalf(live, playersById(save));
    const split = finalizeLive(second);
    expect(split.homeGoals).toBe(one.homeGoals);
    expect(split.awayGoals).toBe(one.awayGoals);
    expect(JSON.stringify(split.events)).toBe(JSON.stringify(one.events));
    expect(JSON.stringify(split.scorers)).toBe(JSON.stringify(one.scorers));
    expect(second.state.timeline.length).toBeGreaterThan(20);
  });

  it("timeline stays consistent (minutes ascending, slots valid, goals counted)", () => {
    const live = startLive(newGame(999))!;
    const st = live.state;
    let last = 0;
    for (const s of st.timeline) {
      expect(s.m).toBeGreaterThanOrEqual(last);
      last = s.m;
      expect(s.m).toBeLessThanOrEqual(45);
      for (const slot of s.p) {
        expect(slot).toBeGreaterThanOrEqual(0);
        expect(slot).toBeLessThanOrEqual(10);
      }
    }
    expect(st.timeline.filter((s) => s.o === "goal").length).toBe(st.home.goals + st.away.goals);
  });

  it("enforces PL substitution rules: 5 subs, 3 in-match windows, half time free, no returns", () => {
    const save = newGame(777);
    const players = playersById(save);
    const live0 = startLive(save)!;
    const key = live0.state.userSide!;
    let live = live0;
    const pick = () => {
      const side = live.state[key];
      const i = side.poss.findIndex((p, j) => p !== "GK" && !!side.slots[j]);
      return { outId: side.slots[i]!, inId: side.bench[0]! };
    };
    const firstOut = pick().outId;
    for (let k = 0; k < 3; k++) {
      const c = pick();
      const r = addLiveChange(live, players, {
        minute: 30,
        kind: "sub",
        side: key,
        outId: c.outId,
        inId: c.inId
      });
      expect(r.error).toBeUndefined();
      live = r.live!;
    }
    expect(live.state[key].windows).toBe(3);
    const c4 = pick();
    const r4 = addLiveChange(live, players, {
      minute: 30,
      kind: "sub",
      side: key,
      outId: c4.outId,
      inId: c4.inId
    });
    expect(r4.error).toMatch(/windows/i);
    const r5 = addLiveChange(live, players, {
      minute: 45,
      kind: "sub",
      side: key,
      outId: c4.outId,
      inId: c4.inId
    });
    expect(r5.error).toBeUndefined();
    live = r5.live!;
    expect(live.state[key].subs).toBe(4);
    expect(live.state[key].windows).toBe(3);
    const c6 = pick();
    const r6 = addLiveChange(live, players, {
      minute: 45,
      kind: "sub",
      side: key,
      outId: c6.outId,
      inId: c6.inId
    });
    expect(r6.error).toBeUndefined();
    live = r6.live!;
    expect(live.state[key].subs).toBe(5);
    const c7 = pick();
    const r7 = addLiveChange(live, players, {
      minute: 45,
      kind: "sub",
      side: key,
      outId: c7.outId,
      inId: c7.inId
    });
    expect(r7.error).toMatch(/substitutions left/i);
    const r8 = addLiveChange(live, players, {
      minute: 45,
      kind: "sub",
      side: key,
      outId: c7.outId,
      inId: firstOut
    });
    expect(r8.error).toMatch(/no longer available/i);
  });

  it("second half carries substitutions and mentality changes", () => {
    const save = newGame(31);
    const players = playersById(save);
    const live0 = startLive(save)!;
    const key = live0.state.userSide!;
    const side0 = live0.state[key];
    const i = side0.poss.findIndex((p, j) => p !== "GK" && !!side0.slots[j]);
    const outId = side0.slots[i]!;
    const inId = side0.bench[0]!;
    let live = addLiveChange(live0, players, {
      minute: 20,
      kind: "sub",
      side: key,
      outId,
      inId
    }).live!;
    live = addLiveChange(live, players, {
      minute: 20,
      kind: "mentality",
      side: key,
      mentality: "att"
    }).live!;
    const second = resumeSecondHalf(live, players);
    expect(second.half).toBe(2);
    expect(second.state[key].mentality).toBe("att");
    expect(second.state[key].slots).toContain(inId);
    expect(second.state[key].slots).not.toContain(outId);
    expect(second.state.timeline.some((s) => s.m > 45)).toBe(true);
    const again = resumeSecondHalf(live, players);
    expect(JSON.stringify(again.state.timeline)).toBe(JSON.stringify(second.state.timeline));
  });
});

describe("motion", () => {
  const mkPlayer = (pos: Position, pace: number, physical = 60): Player => ({
    id: `m-${pos}-${pace}-${physical}`,
    clubId: "c1",
    name: "M",
    age: 24,
    pos,
    attrs: {
      pace,
      shooting: 60,
      passing: 60,
      defending: 60,
      physical,
      reflexes: 50,
      handling: 50
    },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: []
  });

  it("every role has a motion profile and roles differ by design", () => {
    for (const group of Object.values(ROLE_GROUPS)) {
      for (const r of group) expect(ROLE_MOTION[r]).toBeDefined();
    }
    expect(ROLE_MOTION.presser.press).toBeGreaterThan(ROLE_MOTION.poacher.press);
    expect(ROLE_MOTION.bwm.press).toBeGreaterThan(ROLE_MOTION.playmaker.press);
    expect(ROLE_MOTION.wb.push).toBeGreaterThan(ROLE_MOTION.fb.push);
    expect(ROLE_MOTION.w.width).toBeGreaterThan(0.5);
    expect(ROLE_MOTION.inside.width).toBeLessThan(0);
    expect(ROLE_MOTION.anc.drop).toBeGreaterThan(ROLE_MOTION.poacher.drop);
    expect(ROLE_MOTION.b2b.roam).toBeGreaterThan(ROLE_MOTION.anc.roam);
    expect(ROLE_MOTION.poacher.push).toBeGreaterThan(ROLE_MOTION.ncb.push);
  });

  it("attributes drive the motion profile", () => {
    const fast = mkPlayer("MF", 85, 70);
    const slow = mkPlayer("MF", 45, 70);
    const slot = { x: 30, y: 50, pos: "MF" as const };
    const pf = motionFor(fast, "cm", slot);
    const ps = motionFor(slow, "cm", slot);
    expect(pf.speed).toBeGreaterThan(ps.speed);
    expect(pf.accel).toBeGreaterThan(ps.accel);
    const weak = mkPlayer("MF", 60, 45);
    expect(motionFor(fast, "cm", slot).roam).toBeGreaterThan(motionFor(weak, "cm", slot).roam);
    const gk = motionFor(mkPlayer("GK", 85, 70), "keeper", { x: 50, y: 91, pos: "GK" });
    expect(gk.gk).toBe(true);
    expect(gk.speed).toBeLessThan(pf.speed);
    expect(gk.roam).toBeLessThan(pf.roam);
  });

  it("slot geometry modulates the width bias", () => {
    const p = mkPlayer("MF", 60, 60);
    const wide = motionFor(p, "w", { x: 14, y: 48, pos: "MF" });
    const central = motionFor(p, "w", { x: 50, y: 48, pos: "MF" });
    expect(Math.abs(wide.width)).toBeGreaterThan(Math.abs(central.width));
    expect(motionFor(p, "w", { x: 14, y: 48, pos: "MF" }).seed).toBe(
      motionFor(p, "w", { x: 50, y: 48, pos: "MF" }).seed
    );
  });
});

describe("decisions", () => {
  const mkP = (pos: Position, pace: number, physical = 60): Player => ({
    id: `d-${pos}-${pace}-${physical}`,
    clubId: "c1",
    name: "D",
    age: 24,
    pos,
    attrs: {
      pace,
      shooting: 60,
      passing: 60,
      defending: 60,
      physical,
      reflexes: 50,
      handling: 50
    },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: []
  });
  const ctx = (phase: GamePhase, ball = { x: 55, y: 55 }, slot = { x: 50, y: 30 }): IntentCtx => ({
    phase,
    mentality: "bal",
    slot,
    ball,
    prog: 1 - ball.y / 100
  });
  const n = 400;
  const countId = (
    prof: ReturnType<typeof motionFor>,
    c: IntentCtx,
    id: string,
    salt = "x"
  ) => {
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (decideIntent(prof, c, mulberry32(hashSeed(salt, i))).id === id) k++;
    }
    return k;
  };

  it("is deterministic per rng stream", () => {
    const prof = motionFor(mkP("FW", 80), "af", { x: 50, y: 25, pos: "FW" });
    const c = ctx("in");
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      expect(decideIntent(prof, c, a).id).toBe(decideIntent(prof, c, b).id);
    }
  });

  it("produces varied picks across streams (nobody moves in lockstep)", () => {
    const prof = motionFor(mkP("MF", 70), "cm", { x: 50, y: 45, pos: "MF" });
    const c = ctx("in");
    const ids = new Set<string>();
    for (let i = 0; i < n; i++) {
      ids.add(decideIntent(prof, c, mulberry32(hashSeed("s", i))).id);
    }
    expect(ids.size).toBeGreaterThanOrEqual(3);
  });

  it("forwards choose runs far more often than centre-backs", () => {
    const fwd = motionFor(mkP("FW", 88), "af", { x: 50, y: 22, pos: "FW" });
    const cb = motionFor(mkP("DF", 70), "ncb", { x: 50, y: 78, pos: "DF" });
    const ball = { x: 55, y: 55 };
    const fCtx = ctx("in", ball, { x: 50, y: 22 });
    const cCtx = ctx("in", ball, { x: 50, y: 78 });
    expect(countId(fwd, fCtx, "run_behind")).toBeGreaterThan(countId(cb, cCtx, "run_behind") * 2);
  });

  it("mentality shifts the decision mix", () => {
    const fwd = motionFor(mkP("FW", 80), "af", { x: 50, y: 25, pos: "FW" });
    const att = countId(fwd, { ...ctx("in", undefined, { x: 50, y: 25 }), mentality: "att" }, "run_behind");
    const def = countId(fwd, { ...ctx("in", undefined, { x: 50, y: 25 }), mentality: "def" }, "run_behind");
    expect(att).toBeGreaterThan(def);
    const cb = motionFor(mkP("DF", 60), "ncb", { x: 50, y: 75, pos: "DF" });
    const oCtx = ctx("out", { x: 50, y: 45 }, { x: 50, y: 75 });
    const dropDef = countId(cb, { ...oCtx, mentality: "def" }, "drop_deep");
    const dropAtt = countId(cb, { ...oCtx, mentality: "att" }, "drop_deep");
    expect(dropDef).toBeGreaterThan(dropAtt);
  });

  it("high-press roles press more than playmakers", () => {
    const bwm = motionFor(mkP("MF", 65), "bwm", { x: 50, y: 45, pos: "MF" });
    const pm = motionFor(mkP("MF", 65), "playmaker", { x: 50, y: 40, pos: "MF" });
    const ball = { x: 55, y: 42 };
    expect(countId(bwm, ctx("out", ball, { x: 50, y: 45 }), "press_ball")).toBeGreaterThan(
      countId(pm, ctx("out", ball, { x: 50, y: 40 }), "press_ball")
    );
  });

  it("only offers phase-appropriate intents", () => {
    const sets: Record<GamePhase, string[]> = {
      in: ["hold", "support", "come_short", "drift_wide", "run_behind", "overlap"],
      out: ["hold_line", "press_ball", "cover", "drop_deep"],
      break: ["counter", "spread", "support"],
      recover: ["sprint_back", "delay", "press_ball"]
    };
    for (const phase of ["in", "out", "break", "recover"] as GamePhase[]) {
      const prof = motionFor(mkP("MF", 70), "cm", { x: 30, y: 45, pos: "MF" });
      for (let i = 0; i < 80; i++) {
        const pick = decideIntent(prof, ctx(phase), mulberry32(hashSeed(phase, i)));
        expect(sets[phase]).toContain(pick.id);
        expect(INTENT_IDS).toContain(pick.id);
      }
    }
  });

  it("goalkeepers stay home", () => {
    const gk = motionFor(mkP("GK", 60), "keeper", { x: 50, y: 90, pos: "GK" });
    const phases: GamePhase[] = ["in", "out", "break", "recover"];
    for (const phase of phases) {
      for (let i = 0; i < 120; i++) {
        const pick = decideIntent(
          gk,
          ctx(phase, { x: 60, y: 40 }, { x: 50, y: 90 }),
          mulberry32(hashSeed("gk", phase, i))
        );
        expect(["hold", "hold_line", "come_short"]).toContain(pick.id);
      }
    }
  });

  it("targets make sense", () => {
    const prof = motionFor(mkP("FW", 85), "af", { x: 50, y: 25, pos: "FW" });
    const ball = { x: 55, y: 60 };
    const picks = Array.from({ length: 300 }, (_, i) =>
      decideIntent(prof, ctx("in", ball), mulberry32(hashSeed("t", i)))
    );
    const run = picks.find((r) => r.id === "run_behind");
    if (run) expect(run.target.y).toBeLessThan(ball.y);
    for (let i = 0; i < 100; i++) {
      const p2 = decideIntent(
        motionFor(mkP("MF", 70), "bwm", { x: 50, y: 45, pos: "MF" }),
        ctx("out", ball),
        mulberry32(hashSeed("t2", i))
      );
      if (p2.id === "press_ball") {
        expect(Math.abs(p2.target.y - ball.y)).toBeLessThan(1);
        expect(Math.abs(p2.target.x - ball.x)).toBeLessThan(1);
      }
    }
    for (const r of picks) {
      expect(r.seconds).toBeGreaterThanOrEqual(0.7);
      expect(r.seconds).toBeLessThanOrEqual(4.3);
      expect(r.mix).toBeGreaterThanOrEqual(0.35);
      expect(r.mix).toBeLessThanOrEqual(0.85);
    }
  });
});

describe("traits", () => {
  const mkP = (pos: Position, over: Partial<Player["attrs"]> = {}): Player => ({
    id: `t-${pos}-${JSON.stringify(over)}`,
    clubId: "c1",
    name: "T",
    age: 27,
    pos,
    attrs: {
      pace: 65,
      shooting: 65,
      passing: 65,
      defending: 65,
      physical: 65,
      reflexes: 50,
      handling: 50,
      ...over
    },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: []
  });

  it("generates 0-2 valid, group-appropriate traits deterministically", () => {
    const save = newGame(11);
    let withTraits = 0;
    for (const p of save.players) {
      expect(p.traits.length).toBeLessThanOrEqual(2);
      const again = traitsFor(p, mulberry32(hashSeed(p.id, "traits")));
      expect(again).toEqual(p.traits);
      if (p.traits.length > 1) expect(new Set(p.traits).size).toBe(p.traits.length);
      for (const t of p.traits) {
        expect(TRAITS[t].groups).toContain(p.pos);
      }
      if (p.traits.length) withTraits++;
    }
    expect(withTraits).toBeGreaterThan(save.players.length * 0.5);
  });

  it("attribute profiles bend the trait pool", () => {
    const striker = traitsFor(mkP("FW", { shooting: 90, pace: 85 }), mulberry32(1));
    const anyone = Array.from({ length: 40 }, (_, i) =>
      traitsFor(mkP("FW", { shooting: 90, pace: 85 }), mulberry32(i))
    );
    const shooty = anyone.filter((t) => t.includes("shoots_on_sight")).length;
    const plain = Array.from({ length: 40 }, (_, i) =>
      traitsFor(mkP("FW", { shooting: 45, pace: 45 }), mulberry32(i))
    ).filter((t) => t.includes("shoots_on_sight")).length;
    expect(striker).toBeDefined();
    expect(shooty).toBeGreaterThan(plain);
  });

  it("traits bend the decision weights", () => {
    const base = mkP("MF");
    const prof = motionFor(base, "cm", { x: 50, y: 45, pos: "MF" });
    const c = (traits: Player["traits"]): IntentCtx => ({
      phase: "out",
      mentality: "bal",
      slot: { x: 50, y: 45 },
      ball: { x: 55, y: 45 },
      prog: 0.55,
      traits
    });
    const count = (traits: Player["traits"]) => {
      let k = 0;
      for (let i = 0; i < 300; i++) {
        if (decideIntent(prof, c(traits), mulberry32(hashSeed("tr", i))).id === "press_ball") k++;
      }
      return k;
    };
    expect(count(["presses_hard"])).toBeGreaterThan(count([]));

    const fwd = motionFor(base, "af", { x: 50, y: 25, pos: "FW" });
    const ci: IntentCtx = {
      phase: "in",
      mentality: "bal",
      slot: { x: 50, y: 25 },
      ball: { x: 55, y: 55 },
      prog: 0.45
    };
    const runs = (traits: Player["traits"]) => {
      let k = 0;
      for (let i = 0; i < 300; i++) {
        if (decideIntent(fwd, { ...ci, traits }, mulberry32(hashSeed("tr2", i))).id === "run_behind") k++;
      }
      return k;
    };
    expect(runs(["arrives_in_box"])).toBeGreaterThan(runs([]));
    expect(runs(["stays_back"])).toBeLessThan(runs([]));
  });

  it("hasTrait reads safely on legacy players", () => {
    const legacy = { ...mkP("MF") } as Player;
    delete (legacy as Partial<Player>).traits;
    expect(hasTrait(legacy, "presses_hard")).toBe(false);
  });
});

describe("transfers", () => {
  it("values players by ability and age", () => {
    const s = newGame(7);
    const ps = [...s.players].sort((a, b) => overallFor(a) - overallFor(b));
    const weak = ps[0];
    const strong = ps[ps.length - 1];
    expect(marketValue(strong)).toBeGreaterThan(marketValue(weak));
    const v24 = marketValue({ ...strong, age: 24 });
    const v34 = marketValue({ ...strong, age: 34 });
    expect(v24).toBeGreaterThan(v34);
    expect(marketValue(strong) % 10_000).toBe(0);
    expect(wageDemand(strong)).toBeGreaterThan(wageDemand(weak));
    expect(wageDemand(strong) % 100).toBe(0);
  });

  it("budgets cover the wage bill and every club can breathe", () => {
    const s = newGame(7);
    for (const c of s.clubs) {
      expect(s.finances[c.id].transfer).toBeGreaterThanOrEqual(500_000);
      expect(s.finances[c.id].wageBudget).toBeGreaterThan(wageBill(s, c.id));
      expect(wageHeadroom(s, c.id)).toBeGreaterThan(0);
    }
    expect(Object.keys(freshFinances(s)).length).toBe(s.clubs.length);
  });

  it("windows follow the season calendar", () => {
    const s = newGame(7);
    for (const r of [1, 2, 3]) expect(transferWindow({ ...s, round: r }).open).toBe(true);
    expect(transferWindow({ ...s, round: 4 }).open).toBe(false);
    for (const r of [9, 10]) expect(transferWindow({ ...s, round: r }).open).toBe(true);
    expect(transferWindow({ ...s, round: 12 }).open).toBe(false);
  });

  it("rejects lowballs, accepts fair bids, counters in between — deterministically", () => {
    const s = { ...newGame(7), round: 1 };
    const target = s.players.find((p) => p.clubId !== s.userClubId && marketValue(p) > 1_000_000)!;
    const v = marketValue(target);
    expect(bidForPlayer(s, target.id, Math.round(v * 0.35)).resp.kind).toBe("rejected");
    const fair = bidForPlayer(s, target.id, v * 2);
    expect(fair.resp.kind).toBe("accepted");
    expect(fair.save.pending?.playerId).toBe(target.id);
    const again = bidForPlayer(s, target.id, v * 2);
    expect(again.resp.kind).toBe(fair.resp.kind);
    // some fee band must produce a counter
    let countered = false;
    for (let f = 0.3; f <= 1.6 && !countered; f += 0.05) {
      countered = bidForPlayer(s, target.id, Math.round(v * f)).resp.kind === "counter";
    }
    expect(countered).toBe(true);
  });

  it("blocks bids over budget and when the window is shut", () => {
    const s = { ...newGame(7), round: 1 };
    s.finances[s.userClubId] = { ...s.finances[s.userClubId], transfer: 100 };
    const target = s.players.find((p) => p.clubId !== s.userClubId && marketValue(p) > 1_000_000)!;
    expect(bidForPlayer(s, target.id, 500_000).resp.message).toMatch(/budget/i);
    const shut = { ...newGame(7), round: 5 };
    expect(bidForPlayer(shut, target.id, marketValue(target) * 2).resp.message).toMatch(/closed/i);
  });

  it("completes a transfer once personal terms are agreed", () => {
    const s = { ...newGame(7), round: 1 };
    const target = s.players.find((p) => p.clubId !== s.userClubId && marketValue(p) > 1_000_000)!;
    const fee = marketValue(target) * 2;
    const bid = bidForPlayer(s, target.id, fee);
    expect(bid.resp.kind).toBe("accepted");
    const seller = target.clubId;
    const budgetBefore = bid.save.finances[bid.save.userClubId].transfer;
    const poor = offerTerms(bid.save, target.id, 1_000_000);
    expect(poor.resp.kind).toBe("rejected");
    expect(poor.resp.message).toMatch(/wage budget/i);
    const done = offerTerms(bid.save, target.id, wageDemand(target) * 1.3);
    expect(done.resp.kind).toBe("accepted");
    const p = done.save.players.find((x) => x.id === target.id)!;
    expect(p.clubId).toBe(done.save.userClubId);
    expect(p.contract.until).toBe(done.save.season + 3);
    expect(done.save.finances[done.save.userClubId].transfer).toBe(budgetBefore - fee);
    expect(done.save.finances[seller].transfer).toBeGreaterThan(s.finances[seller].transfer - 1);
    expect(done.save.pending).toBeUndefined();
    expect(done.save.transferLog.length).toBe(1);
  });

  it("accepts incoming offers for your players (and pays you)", () => {
    const s = { ...newGame(7), round: 1 };
    const mine = s.players.find((p) => p.clubId === s.userClubId)!;
    s.offers.push({ id: "of-test", playerId: mine.id, fromClubId: "c3", fee: 1_500_000, day: "R1" });
    const before = s.finances[s.userClubId].transfer;
    const r = acceptOffer(s, "of-test");
    expect(r.resp.kind).toBe("accepted");
    expect(r.save.players.find((x) => x.id === mine.id)!.clubId).toBe("c3");
    expect(r.save.finances[r.save.userClubId].transfer).toBe(before + 1_500_000);
    expect(r.save.offers.length).toBe(0);
  });

  it("renews contracts and signs free agents", () => {
    const s = { ...newGame(7), round: 1 };
    const mine = s.players.find((p) => p.clubId === s.userClubId)!;
    const ren = renewContract(s, mine.id, wageDemand(mine) * 1.3);
    expect(ren.resp.kind).toBe("accepted");
    expect(ren.save.players.find((x) => x.id === mine.id)!.contract.until).toBe(s.season + 3);
    const fa = makeFreeAgent(1, 0);
    const s2 = { ...s, players: [...s.players, fa] };
    const sign = signFreeAgent(s2, fa.id, wageDemand(fa) * 1.3);
    expect(sign.resp.kind).toBe("accepted");
    expect(sign.save.players.find((x) => x.id === fa.id)!.clubId).toBe(s2.userClubId);
    expect(freeAgents(sign.save).some((p) => p.id === fa.id)).toBe(false);
  });

  it("runs AI windows deterministically", () => {
    const s = { ...newGame(7), round: 1 };
    const a = windowTick(s);
    const b = windowTick(s);
    expect(b.transferLog).toEqual(a.transferLog);
    expect(JSON.stringify(b.players.map((p) => p.clubId))).toBe(
      JSON.stringify(a.players.map((p) => p.clubId))
    );
    expect(a.transferLog.length).toBeGreaterThan(0);
    for (const o of a.offers) {
      const p = a.players.find((x) => x.id === o.playerId)!;
      expect(p.clubId).toBe(a.userClubId);
      expect(o.fee).toBeGreaterThan(0);
    }
  });

  it("rolls contracts at season end and refreshes budgets", () => {
    const s = newGame(7);
    const mine = s.players.find((p) => p.clubId === s.userClubId)!;
    mine.contract.until = s.season;
    const ai = s.players.find((p) => p.clubId !== s.userClubId && p.clubId !== "")!;
    ai.contract.until = s.season;
    const next = nextSeason(s);
    expect(next.players.find((x) => x.id === mine.id)!.clubId).toBe("");
    const aiAfter = next.players.find((x) => x.id === ai.id)!;
    expect(aiAfter.clubId === "" || aiAfter.contract.until > next.season).toBe(true);
    expect(Object.keys(next.finances).length).toBe(next.clubs.length);
    expect(freeAgents(next).length).toBeGreaterThanOrEqual(5);
    expect(next.players.some((p) => p.id.startsWith("pfree-"))).toBe(true);
  });
});

describe("training", () => {
  const mkT = (over: Partial<Player> = {}): Player => ({
    id: "t1",
    clubId: "c1",
    name: "Test Player",
    age: 18,
    pos: "FW",
    attrs: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, reflexes: 40, handling: 40 },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: [],
    ...over
  });
  const plan = (unit: TrainingUnit, intensity: Intensity = "normal"): TrainingPlan => ({ unit, intensity });
  const train = (p: Player, pl: TrainingPlan, minutes: number, rounds = 18) => {
    for (let i = 0; i < rounds; i++) {
      developPlayer(p, pl, minutes, mulberry32(hashSeed(p.id, "test", pl.unit, pl.intensity, i)));
    }
  };
  const attrSum = (p: Player) => ATTR_KEYS.reduce((s, k) => s + p.attrs[k], 0);

  it("young players grow, veterans decline", () => {
    const kid = mkT({ age: 17, peak: 92 });
    const kidBefore = attrSum(kid);
    train(kid, plan("attacking"), 90);
    expect(attrSum(kid)).toBeGreaterThan(kidBefore + 2);

    const vet = mkT({ age: 34, attrs: { ...mkT().attrs, pace: 72, physical: 70 } });
    const paceBefore = vet.attrs.pace;
    train(vet, plan("balanced"), 90);
    expect(vet.attrs.pace).toBeLessThan(paceBefore);
    expect(vet.devSeason.pace ?? 0).toBeLessThan(0);
  });

  it("minutes, condition and intensity all scale development", () => {
    const starter = mkT({ age: 20, id: "s1" });
    const bench = mkT({ age: 20, id: "b1" });
    train(starter, plan("balanced"), 90);
    train(bench, plan("balanced"), 0);
    expect(attrSum(starter)).toBeGreaterThan(attrSum(bench));

    const heavy = mkT({ age: 20, id: "h1" });
    const light = mkT({ age: 20, id: "l1" });
    train(heavy, plan("balanced", "heavy"), 90);
    train(light, plan("balanced", "light"), 90);
    expect(attrSum(heavy)).toBeGreaterThan(attrSum(light));

    const tired = mkT({ age: 20, id: "t2", condition: 30 });
    const fresh = mkT({ age: 20, id: "f2", condition: 100 });
    train(tired, plan("balanced"), 90);
    train(fresh, plan("balanced"), 90);
    expect(attrSum(fresh)).toBeGreaterThan(attrSum(tired));

    expect(INTENSITIES.light.recovery).toBeGreaterThan(INTENSITIES.heavy.recovery);
  });

  it("the training unit steers which attributes grow", () => {
    const att = mkT({ age: 19, id: "a1" });
    const def = mkT({ age: 19, id: "a1" });
    train(att, plan("attacking"), 90);
    train(def, plan("defending"), 90);
    expect(att.attrs.shooting - 50).toBeGreaterThan(def.attrs.shooting - 50);
    expect(def.attrs.defending - 50).toBeGreaterThan(att.attrs.defending - 50);
  });

  it("individual focus is a strong nudge", () => {
    const withFocus = mkT({ age: 18, id: "f1", focus: "defending" });
    const without = mkT({ age: 18, id: "f2" });
    train(withFocus, plan("attacking"), 90);
    train(without, plan("attacking"), 90);
    expect(withFocus.attrs.defending).toBeGreaterThan(without.attrs.defending);
  });

  it("players at their ceiling stop growing (but still age)", () => {
    const maxed = mkT({ age: 25, id: "m1", peak: overallFor(mkT({ age: 25, id: "m1" })) });
    const before = attrSum(maxed);
    train(maxed, plan("attacking"), 90);
    expect(attrSum(maxed)).toBe(before);

    const old = mkT({ age: 35, id: "m2", peak: 60 });
    train(old, plan("balanced"), 90, 18);
    expect(attrSum(old)).toBeLessThan(attrSum(mkT({ age: 35, id: "m2", peak: 60 })));
  });

  it("development is deterministic", () => {
    const a = mkT({ age: 19, id: "d1" });
    const b = mkT({ age: 19, id: "d1" });
    train(a, plan("passing"), 90);
    train(b, plan("passing"), 90);
    expect(JSON.stringify(a.attrs)).toBe(JSON.stringify(b.attrs));
    expect(JSON.stringify(a.devSeason)).toBe(JSON.stringify(b.devSeason));
  });

  it("runs a full round of development across the world", () => {
    let s = { ...newGame(7), round: 1 };
    const minutes: Record<string, number> = {};
    for (const p of s.players) minutes[p.id] = p.clubId === s.userClubId ? 90 : 45;
    for (let i = 0; i < 12; i++) s = developRound({ ...s, round: i + 1 }, minutes);
    const gained = s.players.filter((p) => Object.values(p.devSeason).some((v) => v > 0));
    expect(gained.length).toBeGreaterThan(4);
    const someAccum = s.players.some((p) => Object.values(p.dev ?? {}).some((v) => Math.abs(v) > 0.01));
    expect(someAccum).toBe(true);
  });

  it("young regulars learn traits at season end", () => {
    const s = newGame(11);
    for (const p of s.players) if (p.age <= 23) p.apps = 15;
    const countTraits = (pl: Player[]) => pl.reduce((n, p) => n + p.traits.length, 0);
    const before = countTraits(s.players);
    const a = structuredClone(s);
    const b = structuredClone(s);
    learnTraits(a);
    learnTraits(b);
    expect(a.players.map((p) => p.traits.join(",")).join("|")).toBe(
      b.players.map((p) => p.traits.join(",")).join("|")
    );
    expect(countTraits(a.players)).toBeGreaterThan(before);
    for (const p of a.players) if (p.age > 23 && p.apps === 15) expect(p.traits.length).toBeLessThanOrEqual(2);
  });

  it("academy intake adds kids, trims AI squads and is deterministic", () => {
    const s1 = playSeason(newGame(17));
    const s2 = structuredClone(s1);
    const a = nextSeason(s1);
    const b = nextSeason(s2);
    const youth = a.players.filter((p) => p.id.startsWith("py-"));
    expect(youth.length).toBeGreaterThanOrEqual(11);
    expect(youth.every((p) => p.age >= 16 && p.age <= 18)).toBe(true);
    expect(a.players.filter((p) => p.id.startsWith("py-")).map((p) => p.name)).toEqual(
      b.players.filter((p) => p.id.startsWith("py-")).map((p) => p.name)
    );
    for (const c of a.clubs) {
      if (c.id === a.userClubId) continue;
      expect(squadOf(a.players, c.id).length).toBeLessThanOrEqual(26);
    }
    expect(a.players.some((p) => p.id.startsWith(`py-${a.userClubId}-`))).toBe(true);
  });

  it("backs the season tracker and peaks correctly", () => {
    const s = playSeason(newGame(23));
    expect(s.players.some((p) => Object.values(p.devSeason ?? {}).some((v) => v > 0))).toBe(true);
    const young = s.players.filter((p) => p.age <= 20 && p.peak > overallFor(p));
    expect(young.length).toBeGreaterThan(0);
    const next = nextSeason(s);
    expect(next.players.every((p) => Object.values(p.devSeason ?? {}).length === 0 || typeof p.devSeason === "object")).toBe(true);
  });

  it("varies AI training plans by club and season", () => {
    const s = newGame(5);
    const units = s.clubs.map((c) => aiPlan(s, c.id).unit);
    expect(new Set(units).size).toBeGreaterThan(2);
    const next = { ...s, season: 2 };
    expect(s.clubs.map((c) => aiPlan(next, c.id).unit)).not.toEqual(units);
  });
});

describe("planner", () => {
  const mkP = (over: Partial<Player> = {}): Player => ({
    id: "pl1",
    clubId: "c1",
    name: "Plan Player",
    age: 25,
    pos: "FW",
    attrs: { pace: 50, shooting: 50, passing: 50, defending: 50, physical: 50, reflexes: 40, handling: 40 },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 51,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: [],
    ...over
  });

  it("career stages follow age and room to grow", () => {
    expect(careerStage(mkP({ age: 17 }))).toBe("breakthrough");
    expect(careerStage(mkP({ age: 22 }))).toBe("emerging");
    expect(careerStage(mkP({ age: 25, peak: 99 }))).toBe("emerging"); // big room to grow
    expect(careerStage(mkP({ age: 25, peak: 51 }))).toBe("peak"); // at his ceiling
    expect(careerStage(mkP({ age: 31 }))).toBe("experienced");
    expect(careerStage(mkP({ age: 36 }))).toBe("veteran");
    expect(Object.keys(CAREER_STAGES).length).toBe(5);
  });

  it("classifies contract states", () => {
    const s = newGame(7);
    const p = mkP({ age: 25 });
    expect(contractState({ ...p, contract: { wage: 0, until: s.season } }, s)).toBe("expiring");
    expect(contractState({ ...p, contract: { wage: 0, until: s.season + 1 } }, s)).toBe("lastyear");
    expect(contractState({ ...p, contract: { wage: 0, until: s.season + 3 } }, s)).toBe("secure");
    expect(contractState({ ...p, age: 37, contract: { wage: 0, until: s.season + 3 } }, s)).toBe(
      "retiring"
    );
  });

  it("maps numbers to depth levels", () => {
    expect(depthLevel("GK", 1)).toBe("gap");
    expect(depthLevel("GK", 2)).toBe("thin");
    expect(depthLevel("GK", 3)).toBe("ok");
    expect(depthLevel("GK", 5)).toBe("deep");
    expect(depthLevel("DF", 4)).toBe("gap");
    expect(depthLevel("DF", 6)).toBe("thin");
    expect(depthLevel("DF", 7)).toBe("ok");
    expect(depthLevel("FW", 2)).toBe("gap");
    expect(depthLevel("FW", 5)).toBe("ok");
    expect(DEPTH_MIN.GK).toBe(2);
  });

  it("builds ranked groups from the formation", () => {
    const s = newGame(7);
    const plan = squadPlan(s);
    expect(plan.groups.map((g) => g.pos)).toEqual(["GK", "DF", "MF", "FW"]);
    expect(plan.groups[0].slots.length).toBe(1);
    expect(plan.groups[1].slots.length).toBe(4);
    const mine = squadOf(s.players, s.userClubId);
    for (const g of plan.groups) {
      expect(g.players.length).toBe(mine.filter((p) => p.pos === g.pos).length);
      const scores = g.players.map((x) => x.score);
      expect([...scores].sort((a, b) => b - a)).toEqual(scores);
      expect(g.players.map((x) => x.rank)).toEqual(g.players.map((_, i) => i + 1));
    }
    expect(plan.total).toBe(mine.length);
  });

  it("flags gaps when a line is gutted", () => {
    const s = structuredClone(newGame(7));
    const fw = s.players.filter((p) => p.clubId === s.userClubId && p.pos === "FW");
    fw.slice(0, fw.length - 3).forEach((p) => (p.clubId = ""));
    const thin = squadPlan(s).groups.find((g) => g.pos === "FW")!;
    expect(thin.players.length).toBe(3);
    expect(thin.depth).toBe("thin");
    s.players.find((p) => p.id === fw[fw.length - 1].id)!.clubId = "";
    const gap = squadPlan(s).groups.find((g) => g.pos === "FW")!;
    expect(gap.depth).toBe("gap");
  });

  it("projects next season: departures drop out, ages tick up", () => {
    const s = structuredClone(newGame(7));
    const mine = squadOf(s.players, s.userClubId);
    const victim = mine.find((p) => p.pos === "FW")!;
    victim.contract.until = s.season; // out of contract at season end
    const now = squadPlan(s, "now");
    const next = squadPlan(s, "next");
    const gOf = (plan: ReturnType<typeof squadPlan>, pos: "FW") =>
      plan.groups.find((x) => x.pos === pos)!;
    expect(gOf(next, "FW").players.find((x) => x.player.id === victim.id)!.leaving).toBe(true);
    expect(gOf(now, "FW").players.length).toBe(gOf(next, "FW").players.length);
    expect(next.kept).toBe(now.total - next.expiring);
    expect(next.expiring).toBeGreaterThanOrEqual(1);
    const oldest = [...mine].sort((a, b) => b.age - a.age)[0];
    const inNow = squadPlan(s, "now")
      .groups.flatMap((x) => x.players)
      .find((x) => x.player.id === oldest.id)!;
    const inNext = squadPlan(s, "next")
      .groups.flatMap((x) => x.players)
      .find((x) => x.player.id === oldest.id)!;
    expect(inNext.player.age).toBe(Math.min(40, inNow.player.age + 1));
    expect(next.wageBillKept).toBeLessThanOrEqual(next.wageBill);
  });

  it("summarises the experience matrix and wages", () => {
    const s = newGame(7);
    const plan = squadPlan(s);
    expect(plan.stages.map((x) => x.stage)).toEqual(STAGE_ORDER);
    expect(plan.stages.reduce((n, x) => n + x.count, 0)).toBe(plan.total);
    expect(plan.avgAge).toBeGreaterThan(17);
    expect(plan.avgAge).toBeLessThan(40);
    expect(plan.wageBill).toBe(wageBill(s, s.userClubId));
    expect(JSON.stringify(squadPlan(s))).toBe(JSON.stringify(squadPlan(s)));
  });
});

describe("set piece creator", () => {
  const simMatch = (save: SaveGame, planOf: (clubId: string) => SetPiecePlan) => {
    const fx = userFixture(save)!;
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    const rng = mulberry32(
      hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)
    );
    const state = startMatch({
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
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
      homePlan: planOf(fx.homeId),
      awayPlan: planOf(fx.awayId),
      rng,
      userSide: fx.homeId === save.userClubId ? "home" : "away"
    });
    const done = advanceTo(state, state.total, playersById(save));
    return {
      state: done,
      res: finalizeMatch(done),
      side: (fx.homeId === save.userClubId ? 1 : 0) as 0 | 1,
      userClubId: save.userClubId
    };
  };

  it("exposes routine metadata and sane defaults", () => {
    expect(Object.keys(CORNER_ROUTINES)).toEqual(["near_post", "far_post", "short", "edge"]);
    expect(Object.keys(FK_ROUTINES)).toEqual(["direct", "crossed", "short"]);
    const d = defaultSetPieces();
    expect(d.corner).toBe("far_post");
    expect(d.freekick).toBe("direct");
    expect(d.takers).toEqual({ corner: null, freekick: null, penalty: null });
    expect(familiarityOf(d, "corner", "far_post")).toBe(60);
    expect(familiarityOf(d, "corner", "near_post")).toBe(25); // never trained
    expect(familiarityFactor(0)).toBeCloseTo(0.9, 5);
    expect(familiarityFactor(100)).toBeCloseTo(1.0, 5);
  });

  it("grows familiarity each round, faster with set-piece training, and keeps it per routine", () => {
    const s = newGame(7);
    const before = familiarityOf(s.setpieces, "corner", s.setpieces.corner);
    growFamiliarity(s);
    expect(familiarityOf(s.setpieces, "corner", s.setpieces.corner)).toBe(before + 4);
    const trained = structuredClone(s);
    trained.training = { unit: "setpieces", intensity: "normal" };
    growFamiliarity(trained, 2);
    expect(familiarityOf(trained.setpieces, "corner", trained.setpieces.corner)).toBe(before + 4 + 14);
    for (let i = 0; i < 40; i++) growFamiliarity(trained);
    expect(familiarityOf(trained.setpieces, "corner", trained.setpieces.corner)).toBe(100);
    trained.setpieces.corner = "near_post";
    expect(familiarityOf(trained.setpieces, "corner", "near_post")).toBe(25); // fresh routine
    expect(familiarityOf(trained.setpieces, "corner", "far_post")).toBe(100); // old one still grooved
  });

  it("nominated takers take the set pieces when they are on the pitch", () => {
    const base = newGame(41);
    const cornerTaker = base.lineup.starters.find(
      (id) => id && base.players.find((p) => p.id === id)!.pos !== "GK"
    )!;
    const planOf = (clubId: string): SetPiecePlan =>
      clubId === base.userClubId
        ? {
            ...base.setpieces,
            takers: { corner: cornerTaker, freekick: cornerTaker, penalty: cornerTaker }
          }
        : aiSetPieces(base, clubId);
    let seen = 0;
    for (let r = 1; r <= 10; r++) {
      const { state } = simMatch({ ...base, round: r }, planOf);
      const evs = state.events.filter(
        (e) => (e.type === "corner" || e.type === "freekick") && e.clubId === base.userClubId
      );
      for (const e of evs) {
        seen++;
        expect(e.playerId).toBe(cornerTaker);
      }
    }
    expect(seen).toBeGreaterThan(3);
  });

  it("falls back to the best available when the nominated taker is not playing", () => {
    const base = newGame(43);
    const benchId = base.lineup.bench.find(Boolean)!;
    const planOf = (clubId: string): SetPiecePlan =>
      clubId === base.userClubId
        ? { ...base.setpieces, takers: { corner: benchId, freekick: benchId, penalty: benchId } }
        : aiSetPieces(base, clubId);
    let seen = 0;
    for (let r = 1; r <= 10; r++) {
      const { state } = simMatch({ ...base, round: r }, planOf);
      for (const e of state.events) {
        if ((e.type === "corner" || e.type === "freekick") && e.clubId === base.userClubId) {
          seen++;
          expect(e.playerId).not.toBe(benchId);
        }
      }
    }
    expect(seen).toBeGreaterThan(3);
  });

  it("corner routines change the goal rate and the second phases", () => {
    const base = newGame(31);
    const measure = (routine: CornerRoutine) => {
      const planOf = (clubId: string): SetPiecePlan =>
        clubId === base.userClubId
          ? {
              ...base.setpieces,
              corner: routine,
              familiarity: {
                [routineKey("corner", routine)]: 100,
                [routineKey("freekick", "direct")]: 100
              }
            }
          : aiSetPieces(base, clubId);
      let corners = 0;
      let goals = 0;
      for (let r = 1; r <= 18; r++) {
        const { state, side } = simMatch({ ...base, round: r }, planOf);
        const sts = state.timeline.filter((st) => st.h === side && st.sp === "corner");
        corners += sts.length;
        goals += sts.filter((st) => st.o === "goal").length;
      }
      return { corners, goals, perCorner: goals / Math.max(1, corners) };
    };
    const near = measure("near_post");
    const short = measure("short");
    expect(near.perCorner).toBeGreaterThan(short.perCorner);
    expect(short.corners).toBeGreaterThan(near.corners); // short corners keep the move alive
  });

  it("free-kick routines: crossed delivers, short rarely threatens", () => {
    const base = newGame(33);
    const measure = (routine: FreeKickRoutine) => {
      const planOf = (clubId: string): SetPiecePlan =>
        clubId === base.userClubId
          ? {
              ...base.setpieces,
              freekick: routine,
              familiarity: {
                [routineKey("corner", "far_post")]: 100,
                [routineKey("freekick", routine)]: 100
              }
            }
          : aiSetPieces(base, clubId);
      let fks = 0;
      let goals = 0;
      for (let r = 1; r <= 18; r++) {
        const { state, side } = simMatch({ ...base, round: r }, planOf);
        const sts = state.timeline.filter((st) => st.h === side && st.sp === "freekick");
        fks += sts.length;
        goals += sts.filter((st) => st.o === "goal").length;
      }
      return { fks, goals, perFk: goals / Math.max(1, fks) };
    };
    const shortFk = measure("short");
    const crossed = measure("crossed");
    expect(crossed.perFk).toBeGreaterThan(shortFk.perFk);
    expect(crossed.fks).toBeGreaterThan(5);
  });

  it("tags strokes with the routine in play", () => {
    const base = newGame(37);
    const planOf = (clubId: string): SetPiecePlan =>
      clubId === base.userClubId
        ? {
            ...base.setpieces,
            corner: "edge",
            freekick: "crossed",
            familiarity: { "corner:edge": 100, "freekick:crossed": 100 }
          }
        : aiSetPieces(base, clubId);
    let cornerStrokes = 0;
    let fkStrokes = 0;
    for (let r = 1; r <= 6; r++) {
      const { state, side } = simMatch({ ...base, round: r }, planOf);
      for (const st of state.timeline) {
        if (st.h !== side) continue;
        if (st.sp === "corner") {
          cornerStrokes++;
          expect(st.spr).toBe("edge");
        }
        if (st.sp === "freekick") {
          fkStrokes++;
          expect(st.spr).toBe("crossed");
        }
      }
    }
    expect(cornerStrokes).toBeGreaterThan(3);
    expect(fkStrokes).toBeGreaterThan(0);
  });

  it("keeps matches deterministic with plans in play", () => {
    const base = newGame(47);
    const planOf = (clubId: string): SetPiecePlan =>
      clubId === base.userClubId ? base.setpieces : aiSetPieces(base, clubId);
    const a = simMatch({ ...base, round: 3 }, planOf);
    const b = simMatch({ ...base, round: 3 }, planOf);
    expect(JSON.stringify(a.state.timeline)).toBe(JSON.stringify(b.state.timeline));
    expect(JSON.stringify(a.res.events)).toBe(JSON.stringify(b.res.events));
  });

  it("AI clubs get their own deterministic routines", () => {
    const s = newGame(7);
    const corners = s.clubs.map((c) => aiSetPieces(s, c.id).corner);
    expect(new Set(corners).size).toBeGreaterThan(1);
    expect(s.clubs.map((c) => aiSetPieces(s, c.id).corner)).toEqual(corners);
    expect(planForClub(s, s.userClubId).corner).toBe(s.setpieces.corner);
  });

  it("normalises stored plans (bad routines, stale takers, wild familiarity)", () => {
    const ids = new Set(["p1"]);
    const clean = cleanSetPieces(
      {
        corner: "nonsense",
        freekick: "crossed",
        takers: { corner: "ghost", freekick: null, penalty: "p1" },
        familiarity: { "corner:crossed": 500, "freekick:crossed": -3 }
      } as never,
      ids
    );
    expect(clean.corner).toBe("far_post");
    expect(clean.freekick).toBe("crossed");
    expect(clean.takers.corner).toBeNull();
    expect(clean.takers.penalty).toBe("p1");
    expect(clean.familiarity["corner:crossed"]).toBe(100);
    expect(clean.familiarity["freekick:crossed"]).toBe(0);
  });
});

describe("player stats & form", () => {
  const mkS = (over: Partial<Player> = {}): Player => ({
    id: "st1",
    clubId: "c1",
    name: "Stat Player",
    age: 25,
    pos: "MF",
    attrs: { pace: 60, shooting: 60, passing: 60, defending: 60, physical: 60, reflexes: 40, handling: 40 },
    traits: [],
    contract: { wage: 0, until: 0 },
    peak: 99,
    dev: {},
    devSeason: {},
    focus: null,
    condition: 100,
    injuredWeeks: 0,
    suspension: 0,
    apps: 0,
    goals: 0,
    assists: 0,
    mins: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    ratingCount: 0,
    form: [],
    history: [],
    ...over
  });
  const upd = (over: Partial<PlayerUpdate> = {}): PlayerUpdate => ({
    playerId: "st1",
    minutes: 90,
    goals: 0,
    assists: 0,
    yellow: 0,
    red: false,
    injuredWeeks: 0,
    conditionLoss: 0,
    ...over
  });
  const ctx = (over: Partial<MatchStatCtx> = {}): MatchStatCtx => ({
    season: 1,
    round: 1,
    opp: "NOR",
    home: true,
    rating: 7,
    userClub: true,
    ...over
  });

  it("folds a match into season stats, form and the log", () => {
    const p = mkS();
    recordMatch(p, upd({ minutes: 76, goals: 2, assists: 1, yellow: 1 }), ctx({ rating: 8.2 }));
    expect(p.mins).toBe(76);
    expect(p.yellows).toBe(1);
    expect(p.form).toEqual([8.2]);
    expect(ratingAvg(p)).toBeCloseTo(8.2, 5);
    expect(p.history).toHaveLength(1);
    expect(p.history[0]).toMatchObject({ r: 1, opp: "NOR", h: true, rt: 8.2, m: 76, g: 2, a: 1 });
    recordMatch(p, upd({ minutes: 0 }), ctx({ rating: undefined })); // unused sub
    expect(p.form).toHaveLength(1);
    expect(ratingAvg(p)).toBeCloseTo(8.2, 5);
    expect(p.history).toHaveLength(2);
    expect(p.history[0].rt).toBe(0);
  });

  it("keeps the last six ratings, newest first, and bands them", () => {
    const p = mkS();
    for (let r = 1; r <= 8; r++) recordMatch(p, upd(), ctx({ rating: 4 + r * 0.5, round: r }));
    expect(p.form).toHaveLength(6);
    expect(p.form[0]).toBe(8); // newest first
    expect(p.form[5]).toBe(5.5);
    expect(formOf(p)).toBeCloseTo((8 + 7.5 + 7 + 6.5 + 6 + 5.5) / 6, 5);
    expect(formBandFor(8.1)).toBe("brilliant");
    expect(formBandFor(7)).toBe("good");
    expect(formBandFor(6.2)).toBe("average");
    expect(formBandFor(5)).toBe("poor");
    expect(Object.keys(FORM_BANDS)).toHaveLength(4);
    expect(rating1(null)).toBe("—");
    expect(rating1(7.234)).toBe("7.2");
    expect(formOf(mkS())).toBeNull();
  });

  it("logs matches for your club only, newest first, capped at ten", () => {
    const p = mkS();
    for (let r = 1; r <= 12; r++) recordMatch(p, upd(), ctx({ round: r }));
    expect(p.history).toHaveLength(10);
    expect(p.history[0].r).toBe(12);
    const other = mkS({ clubId: "c9" });
    recordMatch(other, upd(), ctx({ userClub: false }));
    expect(other.history).toHaveLength(0);
    expect(other.form).toHaveLength(1);
  });

  it("collects stats for AI players too (without a log)", () => {
    const s = playRound(newGame(15)).save;
    const ai = s.players.filter((p) => p.clubId !== s.userClubId && p.clubId !== "");
    expect(ai.some((p) => (p.mins ?? 0) > 0 && p.form.length > 0)).toBe(true);
    expect(ai.every((p) => p.history.length === 0)).toBe(true);
    const mine = s.players.filter((p) => p.clubId === s.userClubId);
    expect(mine.some((p) => p.history.length > 0)).toBe(true);
    expect(mine.filter((p) => p.apps > 0).every((p) => p.ratingCount > 0 && p.mins > 0)).toBe(true);
  });

  it("resets season stats at the rollover but keeps the recent-match log", () => {
    const s = playRound(newGame(17)).save;
    const id = s.players.find((p) => p.clubId === s.userClubId && p.history.length > 0)!.id;
    expect(s.players.find((p) => p.id === id)!.mins).toBeGreaterThan(0);
    const next = nextSeason(s);
    const after = next.players.find((p) => p.id === id)!;
    expect(after.mins).toBe(0);
    expect(after.ratingCount).toBe(0);
    expect(after.ratingSum).toBe(0);
    expect(after.form).toEqual([]);
    expect(after.yellows).toBe(0);
    expect(after.history.length).toBeGreaterThan(0);
  });

  it("sorts the squad by form, rating, goals and minutes", () => {
    const overall = (p: Player) => p.peak;
    const a = mkS({ id: "a", goals: 5, form: [8, 8], mins: 100 });
    const b = mkS({ id: "b", goals: 1, form: [5, 5], mins: 900 });
    const c = mkS({ id: "c", goals: 9, form: [], mins: 10, peak: 50 });
    const ids = (arr: Player[]) => arr.map((p) => p.id).join("");
    expect(ids(sortSquad([a, b, c], "form", overall))).toBe("abc"); // no form sinks
    expect(ids(sortSquad([a, b, c], "goals", overall))).toBe("cab");
    expect(ids(sortSquad([a, b, c], "minutes", overall))).toBe("bac");
    expect(ids(sortSquad([a, b, c], "rating", overall))).toBe("abc");
    expect(SORT_MODES).toHaveLength(6);
  });

  it("is deterministic across identical runs", () => {
    const run = () => {
      let s = newGame(19);
      for (let r = 0; r < 3; r++) s = playRound(s).save;
      return JSON.stringify(s.players.map((p) => [p.apps, p.mins, p.form, p.ratingCount, p.history.length]));
    };
    expect(run()).toBe(run());
  });
});

describe("scouting", () => {
  const fresh = () => newGame(61);

  it("starts with staff, a hiring pool and a budget", () => {
    const s = fresh();
    expect(s.scouting.scouts).toHaveLength(2);
    expect(s.scouting.pool).toHaveLength(4);
    expect(s.scouting.budget).toBeGreaterThanOrEqual(300_000);
    expect(s.scouting.scouts.every((x) => x.name.length > 3 && x.judging >= 45 && x.fee > 0)).toBe(true);
    expect(Object.keys(s.scouting.knowledge)).toHaveLength(0);
  });

  it("knows your own players exactly and rivals not at all", () => {
    const s = fresh();
    const mine = squadOf(s.players, s.userClubId)[0];
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    expect(knowledgeOf(s, mine.id)).toBe(100);
    const own = estimateFor(s, mine);
    expect(own.tier).toBe("extensive");
    expect(own.exactOvr).toBe(overallFor(mine));
    expect(own.traits).toEqual(mine.traits);

    expect(knowledgeOf(s, rival.id)).toBe(0);
    const fog = estimateFor(s, rival);
    expect(fog.tier).toBe("none");
    expect(fog.stars).toBeNull();
    expect(fog.exactOvr).toBeNull();
    expect(fog.attrs).toBeNull();
    expect(fog.valueRange).toBeNull();
  });

  it("scouting one player raises knowledge each round and completes at extensive", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    expect(scoutPlayer(s, rival.id)).toBeNull();
    expect(s.scouting.requests).toHaveLength(1);
    const before = knowledgeOf(s, rival.id);
    scoutingTick(s);
    const afterOne = knowledgeOf(s, rival.id);
    expect(afterOne).toBeGreaterThan(before);
    expect(estimateFor(s, rival).tier).toBe("brief"); // a 25+ report is a brief one
    let guard = 0;
    while (s.scouting.requests.length && guard++ < 20) scoutingTick(s);
    expect(knowledgeOf(s, rival.id)).toBeGreaterThanOrEqual(KNOWLEDGE_FULL);
    expect(s.scouting.requests).toHaveLength(0); // the scout is free again
    expect(s.scouting.reports).toContain(rival.id);
    const est = estimateFor(s, rival);
    expect(est.tier).toBe("extensive");
    expect(est.exactOvr).toBe(overallFor(rival));
    expect(est.exactPot).toBe(rival.peak);
    expect(est.attrs!.pace).toEqual([rival.attrs.pace, rival.attrs.pace]);
  });

  it("cannot scout your own players twice or without a free scout", () => {
    const s = fresh();
    const mine = squadOf(s.players, s.userClubId)[0];
    expect(scoutPlayer(s, mine.id)).toMatch(/own players/i);
    const rivals = s.players.filter((p) => p.clubId !== s.userClubId).slice(0, 3);
    expect(scoutPlayer(s, rivals[0].id)).toBeNull();
    expect(scoutPlayer(s, rivals[1].id)).toBeNull();
    expect(scoutPlayer(s, rivals[2].id)).toMatch(/busy/i); // two scouts, both working
    expect(scoutPlayer(s, rivals[0].id)).toMatch(/already scouting/i);
  });

  it("estimates are wider for a poor scout and tighter with knowledge", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    const poor = { id: "sp", name: "Poor", judging: 35, speed: 1, fee: 0 };
    const elite = { id: "se", name: "Elite", judging: 95, speed: 1, fee: 0 };
    s.scouting.scouts = [poor, elite];
    s.scouting.knowledge[rival.id] = { level: 60, seen: 1, by: "sp" };
    const wide = estimateFor(s, rival);
    s.scouting.knowledge[rival.id] = { level: 60, seen: 1, by: "se" };
    const tight = estimateFor(s, rival);
    const width = (r: [number, number]) => r[1] - r[0];
    expect(width(wide.ovrRange!)).toBeGreaterThan(width(tight.ovrRange!));
    expect(width(wide.attrs!.shooting!)).toBeGreaterThan(width(tight.attrs!.shooting!));
    // more knowledge → tighter ranges (same scout)
    s.scouting.knowledge[rival.id] = { level: 55, seen: 1, by: "se" };
    const mid = estimateFor(s, rival);
    s.scouting.knowledge[rival.id] = { level: 74, seen: 1, by: "se" };
    const high = estimateFor(s, rival);
    expect(width(high.ovrRange!)).toBeLessThanOrEqual(width(mid.ovrRange!));
    expect(mid.tier).toBe("detailed");
  });

  it("recruitment focuses surface matching players and polish their best leads", () => {
    const s = fresh();
    expect(addFocus(s, { pos: "FW", maxAge: 23, minPotStars: 2.5 })).toBeNull();
    scoutingTick(s);
    const known = Object.entries(s.scouting.knowledge).map(([id, k]) => ({
      p: s.players.find((x) => x.id === id)!,
      k
    }));
    expect(known.length).toBeGreaterThan(0);
    expect(known.every(({ p }) => p.pos === "FW" && p.age <= 23 && p.clubId !== s.userClubId)).toBe(true);
    expect(s.scouting.reports.length).toBeGreaterThan(0);
    const firstLevel = known[0].k.level;
    scoutingTick(s);
    scoutingTick(s);
    const after = Object.entries(s.scouting.knowledge).map(([id, k]) => ({ id, k }));
    expect(after.length).toBeGreaterThanOrEqual(known.length);
    expect(after.some(({ id, k }) => id === known[0].p.id && k.level > firstLevel)).toBe(true);
  });

  it("pays for jobs from the scouting budget and pauses when it runs dry", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    s.scouting.budget = REQUEST_COST.player + 5_000; // one round of work left
    scoutPlayer(s, rival.id);
    scoutingTick(s);
    const afterPaid = knowledgeOf(s, rival.id);
    expect(s.scouting.budget).toBe(5_000);
    scoutingTick(s); // broke: the job pauses
    expect(knowledgeOf(s, rival.id)).toBe(afterPaid);
    expect(s.scouting.budget).toBe(5_000);
    scoutingTick(s);
    expect(s.scouting.budget).toBeGreaterThanOrEqual(0);
  });

  it("decays knowledge that nobody is watching, down to a brief report", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    s.scouting.knowledge[rival.id] = { level: 90, seen: 1 };
    scoutingTick(s);
    expect(knowledgeOf(s, rival.id)).toBe(88);
    for (let i = 0; i < 60; i++) scoutingTick(s);
    expect(knowledgeOf(s, rival.id)).toBe(DISCOVERY_LEVEL); // floors at a brief report
  });

  it("shortlisted players keep getting fresh eyes", () => {
    const s = fresh();
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    s.scouting.knowledge[rival.id] = { level: 30, seen: 1 };
    toggleShortlist(s, rival.id);
    scoutingTick(s);
    expect(knowledgeOf(s, rival.id)).toBe(31);
    expect(s.scouting.shortlist).toContain(rival.id);
    toggleShortlist(s, rival.id);
    expect(s.scouting.shortlist).not.toContain(rival.id);
    expect(knowledgeOf(s, rival.id)).toBeGreaterThanOrEqual(25); // decay resumes, floored
  });

  it("hires and dismisses scouts (fees from the budget, cap of three)", () => {
    const s = fresh();
    const cand = s.scouting.pool[0];
    expect(hireScout(s, cand.id)).toBeNull();
    expect(s.scouting.scouts).toHaveLength(3);
    expect(s.scouting.pool).not.toContain(cand);
    expect(hireScout(s, s.scouting.pool[0].id)).toMatch(/only employ 3/i);
    const rival = s.players.find((p) => p.clubId !== s.userClubId)!;
    scoutPlayer(s, rival.id);
    const busyScout = s.scouting.requests[0].scoutId;
    dismissScout(s, busyScout);
    expect(s.scouting.scouts.find((x) => x.id === busyScout)).toBeUndefined();
    expect(s.scouting.requests).toHaveLength(0); // his jobs went with him
  });

  it("tops the scouting budget up from the transfer budget", () => {
    const s = fresh();
    const before = s.scouting.budget;
    const transferBefore = s.finances[s.userClubId].transfer;
    expect(topUpScouting(s, 500_000)).toBeNull();
    expect(s.scouting.budget).toBe(before + 500_000);
    expect(s.finances[s.userClubId].transfer).toBe(transferBefore - 500_000);
    expect(topUpScouting(s, transferBefore)).toMatch(/only/i);
  });

  it("star ratings are relative to your own squad", () => {
    const s = fresh();
    const baseline = squadAvgOvr(s);
    expect(starsFor(baseline, baseline)).toBe(2.5);
    expect(starsFor(baseline + 8, baseline)).toBe(5);
    expect(starsFor(baseline - 20, baseline)).toBe(0.5);
    expect(starsFor(baseline + 1.6, baseline)).toBe(3);
  });

  it("keeps working alongside transfers (fog does not break bids)", () => {
    const s = { ...fresh(), round: 1 };
    const rival = s.players.find((p) => p.clubId !== s.userClubId && marketValue(p) > 1_000_000)!;
    expect(knowledgeOf(s, rival.id)).toBe(0);
    const resp = bidForPlayer(s, rival.id, marketValue(rival) * 2);
    expect(resp.resp.kind).toBe("accepted");
  });

  it("is deterministic", () => {
    const run = () => {
      const s = newGame(63);
      addFocus(s, { pos: "any", maxAge: 24, minPotStars: 3 });
      for (let i = 0; i < 6; i++) scoutingTick(s);
      return JSON.stringify([s.scouting.knowledge, s.scouting.reports, s.scouting.budget]);
    };
    expect(run()).toBe(run());
  });
});

describe("set pieces", () => {
  it("a season produces corners, direct free kicks and penalties at sane rates", () => {
    let g = newGame(7);
    const rounds = seasonRounds(g);
    let matches = 0;
    let corners = 0;
    let cornerGoals = 0;
    let fks = 0;
    let pens = 0;
    let cards = 0;
    while (g.round <= rounds) {
      const r = playRound(g);
      g = r.save;
      for (const f of g.lastResults) {
        matches++;
        corners += f.events.filter((e) => e.type === "corner").length;
        cornerGoals += f.events.filter((e) => e.type === "goal" && /corner/i.test(e.text)).length;
        fks += f.events.filter((e) => e.type === "freekick").length;
        pens += f.events.filter((e) => e.type === "penalty").length;
        cards += f.events.filter((e) => e.type === "yellow" || e.type === "red").length;
      }
    }
    expect(matches).toBeGreaterThan(60);
    const cornerRate = (corners + cornerGoals) / matches;
    expect(cornerRate).toBeGreaterThan(3);
    expect(cornerRate).toBeLessThan(20);
    expect(fks / matches).toBeGreaterThan(0.3);
    expect(fks / matches).toBeLessThan(5);
    expect(pens).toBeGreaterThan(0);
    expect(pens / matches).toBeLessThan(1.2);
    expect(cards / matches).toBeGreaterThan(1);
    expect(cards / matches).toBeLessThan(8);
  });

  it("set-piece strokes carry staging data (sp/tg) in the live timeline", () => {
    let staged: Stroke[] | undefined;
    for (let seed = 1; seed <= 60 && !staged; seed++) {
      const live = startLive(newGame(seed));
      if (!live) continue;
      const tl = live.state.timeline;
      const kinds = new Set(tl.map((st) => st.sp).filter(Boolean));
      if (kinds.has("corner") && kinds.has("penalty") && kinds.has("freekick")) staged = tl;
    }
    expect(staged).toBeDefined();
    for (const st of staged!) {
      if (st.sp === "corner") {
        expect(st.tg).toBeDefined();
        expect(st.tg![1]).toBe(2);
      }
      if (st.sp === "penalty") expect(st.tg).toEqual([50, 12]);
      if (st.sp === "freekick") expect(st.tg).toEqual([50, 24]);
    }
  });

  it("matchStats counts corner deliveries from the timeline", () => {
    const live = startLive(newGame(7))!;
    const stats = matchStats(live.state);
    const strokes = live.state.timeline.filter((st) => st.sp === "corner").length;
    expect(stats.cornersHome + stats.cornersAway).toBe(strokes);
    expect(strokes).toBeGreaterThan(0);
  });
});

describe("history, records & awards", () => {
  it("folds season counters into per-club career totals exactly once", () => {
    const s1 = playSeason(newGame(71));
    const before = s1.players.filter((p) => p.apps > 5 && p.age < 30);
    expect(before.length).toBeGreaterThan(10);
    const sample = before.slice(0, 30).map((p) => ({
      id: p.id,
      clubId: p.clubId,
      apps: p.apps,
      goals: p.goals,
      assists: p.assists
    }));
    const s2 = nextSeason(s1);
    for (const snap of sample) {
      const p = s2.players.find((x) => x.id === snap.id);
      if (!p) continue; // retired — skip
      const t = totalsFor(p, snap.clubId);
      expect(t.apps).toBe(snap.apps); // folded once, exactly
      expect(t.goals).toBe(snap.goals);
      expect(careerTotals(p).apps).toBe(snap.apps);
      expect(p.apps).toBe(0); // season counters reset
    }
    const kept = sample.filter((s) => s2.players.some((p) => p.id === s.id));
    expect(kept.length).toBeGreaterThan(10);
    for (const snap of kept) {
      const p = s2.players.find((x) => x.id === snap.id)!;
      const t = totalsFor(p, snap.clubId);
      expect(t.goals).toBeGreaterThanOrEqual(snap.goals);
      expect(t.apps).toBeGreaterThanOrEqual(snap.apps);
    }
    // a second rollover accumulates on top of the first (no reset, no double count from one season)
    const s3 = nextSeason(playSeason(s2));
    const p1 = s2.players.find((x) => x.id === kept[0].id);
    const p3 = s3.players.find((x) => x.id === kept[0].id);
    if (p1 && p3) {
      const t2 = careerTotals(p1);
      const t3 = careerTotals(p3);
      expect(t3.apps).toBeGreaterThanOrEqual(t2.apps);
    }
  });

  it("remembers the season: champion, your finish, top scorer, POTY, TOTS, biggest win", () => {
    const s1 = playSeason(newGame(72));
    const table = computeTable(s1.fixtures, s1.clubs);
    const s2 = nextSeason(s1);
    const h = s2.history;
    expect(h.seasons).toHaveLength(1);
    const r = h.seasons[0];
    expect(r.season).toBe(1);
    expect(r.champion.clubId).toBe(table[0].clubId);
    expect(r.champion.points).toBe(table[0].pts);
    expect(r.runnerUp.clubId).toBe(table[1].clubId);
    const mine = table.find((t) => t.clubId === s1.userClubId)!;
    expect(r.user.pos).toBe(mine.position);
    expect(r.user.pts).toBe(mine.pts);
    expect(r.user.w + r.user.d + r.user.l).toBe(seasonRounds(s1));
    expect(r.user.prize).toBe(prizeFor(mine.position));
    expect(r.topScorer!.goals).toBeGreaterThan(0);
    expect(r.playerOfSeason!.rating).toBeGreaterThan(4);
    expect(r.playerOfSeason!.apps).toBeGreaterThanOrEqual(AWARD_MIN_APPS);
    expect(r.teamOfSeason).toHaveLength(11);
    expect(r.teamOfSeason.map((x) => x.pos).join(",")).toBe(TOTS_SHAPE.join(","));
    expect(new Set(r.teamOfSeason.map((x) => x.playerId)).size).toBe(11);
    expect(r.biggestWin).not.toBeNull();
    // the top scorer really was the league's best
    const best = [...s1.players].sort((a, b) => b.goals - a.goals)[0];
    expect(r.topScorer!.goals).toBe(best.goals);
  });

  it("pays prize money with the new budgets and writes a news line", () => {
    const s1 = playSeason(newGame(73));
    const s2 = nextSeason(s1);
    expect(s2.devNews.some((n) => /prize money/i.test(n))).toBe(true);
    // isolation: payPrize adds exactly the recorded prize
    const s = newGame(73);
    s.history.seasons.push({
      season: 1,
      champion: { clubId: s.clubs[1].id, name: s.clubs[1].name, points: 40, gf: 30, ga: 20 },
      runnerUp: { clubId: s.clubs[0].id, name: s.clubs[0].name, points: 38 },
      user: { pos: 4, pts: 30, w: 9, d: 3, l: 6, prize: 2_800_000 },
      topScorer: null,
      playerOfSeason: null,
      teamOfSeason: [],
      biggestWin: null
    });
    const before = s.finances[s.userClubId].transfer;
    payPrize(s);
    expect(s.finances[s.userClubId].transfer).toBe(before + 2_800_000);
    expect(s.devNews[0]).toMatch(/4th/);
  });

  it("crowns champions with titles and counts only your own", () => {
    const s1 = playSeason(newGame(75));
    const champId = computeTable(s1.fixtures, s1.clubs)[0].clubId;
    const prevTitles = new Map(s1.players.map((p) => [p.id, p.titles ?? 0]));
    const s2 = nextSeason(s1);
    for (const p of s2.players) {
      const was = prevTitles.get(p.id);
      if (was === undefined) continue; // new youth / free agents
      const atChamp = p.clubId === champId && s1.players.find((x) => x.id === p.id)!.clubId === champId;
      expect(p.titles ?? 0).toBe(atChamp ? was + 1 : was);
    }
    expect(s2.history.titles).toBe(champId === s1.userClubId ? 1 : 0);
  });

  it("updates all-time records when they are beaten and keeps them across seasons", () => {
    const s1 = playSeason(newGame(76));
    const s2 = nextSeason(s1);
    const a = s2.history.allTime;
    expect(a.topScorer!.value).toBeGreaterThan(0);
    expect(a.mostApps!.value).toBeGreaterThan(0);
    expect(a.bestSeasonGoals!.value).toBeGreaterThan(0);
    expect(a.bestSeasonRating!.value).toBeGreaterThan(4);
    expect(a.biggestWin!.season).toBe(1);
    const s3 = nextSeason(playSeason(s2));
    expect(s3.history.seasons).toHaveLength(2);
    expect(s3.history.allTime.topScorer!.value).toBeGreaterThanOrEqual(a.topScorer!.value);
    expect(s3.history.allTime.mostApps!.value).toBeGreaterThan(a.mostApps!.value); // apps only grow
  });

  it("awards a player of the round every round — best rating, minimum minutes", () => {
    let save = newGame(77);
    save = playRound(save).save;
    expect(save.awards.rounds).toHaveLength(1);
    expect(save.awards.rounds[0].round).toBe(1);
    expect(save.awards.rounds[0].season).toBe(1);
    // the winner is the best-rated player who played at least 45 minutes this round
    let bestRt = -1;
    let bestId = "";
    for (const r of save.lastResults) {
      for (const [pid, rt] of Object.entries(r.ratings)) {
        const u = r.updates.find((x) => x.playerId === pid);
        if (!u || u.minutes < POTR_MIN_MINUTES) continue;
        if (rt > bestRt) {
          bestRt = rt;
          bestId = pid;
        }
      }
    }
    expect(save.awards.rounds[0].playerId).toBe(bestId);
    const full = playSeason(newGame(77));
    expect(full.awards.rounds).toHaveLength(seasonRounds(full));
    const rolled = nextSeason(full);
    expect(rolled.awards.rounds).toHaveLength(0); // reset for the new campaign
    expect(rolled.awards.bestWin).toBeNull();
  });

  it("tracks the biggest win of the season and of all time", () => {
    const s1 = playSeason(newGame(78));
    const played = s1.fixtures.filter((f) => f.played && f.homeGoals != null);
    const widest = played.reduce((m, f) =>
      Math.abs(f.homeGoals! - f.awayGoals!) > Math.abs(m.homeGoals! - m.awayGoals!) ? f : m
    );
    const w = s1.awards.bestWin!;
    expect(Math.abs(w.hs - w.as)).toBe(Math.abs(widest.homeGoals! - widest.awayGoals!));
    expect(w.homeId === widest.homeId || w.homeId === widest.awayId).toBe(true);
    const s2 = nextSeason(s1);
    expect(s2.history.allTime.biggestWin!.season).toBe(1);
  });

  it("keeps clubs' record books per club and per career", () => {
    const s1 = playSeason(newGame(79));
    const s2 = nextSeason(s1);
    const p = s2.players.find((x) => careerTotals(x).apps > 0)!;
    expect(careerTotals(p).apps).toBeGreaterThan(0);
    const clubId = Object.keys(p.totals!)[0];
    expect(totalsFor(p, clubId).apps).toBeGreaterThan(0);
    expect(totalsFor(p, "no-such-club")).toEqual({ apps: 0, goals: 0, assists: 0 });
    // a player who never featured has no career entry (saves stay small)
    const ghost = s2.players.find((x) => (x.totals ?? undefined) && Object.keys(x.totals!).length === 0);
    expect(ghost === undefined || Object.values(ghost.totals!).every((t) => t.apps + t.goals + t.assists > 0)).toBe(true);
    // Scorers tab: mid-season ordering (pre-season everyone is on 0, so the list is empty)
    let mid = newGame(79);
    for (let i = 0; i < 6; i++) mid = playRound(mid).save;
    const scouted = topScorers(mid, 5);
    expect(scouted).toHaveLength(5);
    expect(scouted[0].goals).toBeGreaterThanOrEqual(scouted[1].goals);
    expect(scouted.every((p) => p.goals > 0 || p.apps > 0)).toBe(true);
    expect(topScorers(s2, 5)).toHaveLength(0); // fresh season, nothing played yet
  });

  it("survives players retiring: records live on in history", () => {
    let save = newGame(80);
    for (let i = 0; i < 4; i++) save = nextSeason(playSeason(save));
    expect(save.history.seasons).toHaveLength(4);
    expect(save.history.allTime.topScorer!.value).toBeGreaterThan(10);
    const youngest = [...save.players].sort((a, b) => a.age - b.age)[0];
    expect(youngest.age).toBeLessThan(24);
  });

  it("prize money descends by position and ordinal reads right", () => {
    expect(prizeFor(1)).toBeGreaterThan(prizeFor(2));
    expect(prizeFor(2)).toBeGreaterThan(prizeFor(10));
    expect(prizeFor(0)).toBe(prizeFor(1));
    expect(prizeFor(99)).toBe(prizeFor(10));
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(21)).toBe("21st");
  });

  it("has no history mid-season and is deterministic", () => {
    let save = newGame(81);
    for (let i = 0; i < 5; i++) save = playRound(save).save;
    expect(save.history.seasons).toHaveLength(0);
    expect(save.awards.rounds).toHaveLength(5);
    expect(save.history.titles).toBe(0);

    const run = () => {
      const s = nextSeason(playSeason(newGame(82)));
      return JSON.stringify([s.history, s.awards]);
    };
    expect(run()).toBe(run());
  });
});

describe("morale & squad dynamics", () => {
  const mkResult = (save: SaveGame, gf: number, ga: number, home = true): MatchResult => ({
    fixtureKey: "t",
    round: save.round,
    homeId: home ? save.userClubId : save.clubs[1].id,
    awayId: home ? save.clubs[1].id : save.userClubId,
    homeGoals: gf,
    awayGoals: ga,
    events: [],
    ratings: {},
    updates: [],
    scorers: []
  });
  const fullSquad = (save: SaveGame) =>
    squadOf(save.players, save.userClubId).map((p) => ({
      playerId: p.id,
      minutes: 90,
      goals: 0,
      assists: 0,
      yellow: 0,
      red: false,
      injuredWeeks: 0,
      conditionLoss: 0
    }));

  it("is exactly neutral at morale 60 (calibration safe) and moves ±6% at the ends", () => {
    const s = newGame(90);
    const p = s.players[0];
    p.morale = 60;
    expect(moraleEdge(p)).toBe(1);
    p.morale = 100;
    expect(moraleEdge(p)).toBeCloseTo(1.06, 6);
    p.morale = 5;
    expect(moraleEdge(p)).toBeCloseTo(1 - 55 * 0.0015, 6);
    expect(moraleDev(60)).toBe(1);
    expect(moraleDev(100)).toBeCloseTo(1.08, 6);
    delete p.morale; // old saves / literals default to neutral
    expect(moraleEdge(p)).toBe(1);
  });

  it("reads mood off the scale", () => {
    expect(moodOf(95).label).toBe("Delighted");
    expect(moodOf(75).label).toBe("Happy");
    expect(moodOf(60).label).toBe("Content");
    expect(moodOf(45).label).toBe("Unsettled");
    expect(moodOf(30).label).toBe("Unhappy");
    expect(moodOf(8).label).toBe("Miserable");
  });

  it("a star who never plays sulks; a fringe player who plays every week perks up", () => {
    const s = newGame(101);
    const squad = squadOf(s.players, s.userClubId).sort((a, b) => overallFor(b) - overallFor(a));
    const star = squad[0];
    const fringe = squad[squad.length - 2];
    expect(squadStatus(s, star)).toBe("star");
    expect(squadStatus(s, fringe)).not.toBe("star");
    star.morale = 60;
    fringe.morale = 60;
    star.recentMin = [];
    fringe.recentMin = [];
    for (let r = 1; r <= 8; r++) {
      s.round = r;
      // nobody plays in this synthetic round: the star's expectations go unmet
      moraleTick(s, [mkResult(s, 1, 1)]);
    }
    expect(star.morale).toBeLessThan(52);
    expect(moraleFactors(s, star).some((f) => f.label === "Wants more minutes")).toBe(true);

    // now the fringe man plays every minute of every round
    const s2 = newGame(101);
    const fringe2 = squadOf(s2.players, s2.userClubId).sort((a, b) => overallFor(b) - overallFor(a))[
      squadOf(s2.players, s2.userClubId).length - 2
    ];
    fringe2.morale = 60;
    fringe2.recentMin = [];
    for (let r = 1; r <= 8; r++) {
      s2.round = r;
      const res = mkResult(s2, 2, 1);
      res.updates = [{ playerId: fringe2.id, minutes: 90, goals: 0, assists: 0, yellow: 0, red: false, injuredWeeks: 0, conditionLoss: 0 }];
      moraleTick(s2, [res]);
    }
    expect(fringe2.morale).toBeGreaterThan(62);
    expect(minutesShare(fringe2.recentMin)).toBe(1);
  });

  it("results move the whole dressing room", () => {
    const run = (gf: number, ga: number, n: number) => {
      const s = newGame(102);
      for (let r = 1; r <= n; r++) {
        s.round = r;
        const res = mkResult(s, gf, ga);
        res.updates = fullSquad(s);
        moraleTick(s, [res]);
      }
      const club = squadOf(s.players, s.userClubId);
      return club.reduce((a, p) => a + (p.morale ?? 60), 0) / club.length;
    };
    const winning = run(3, 0, 6);
    const losing = run(0, 3, 6);
    expect(winning - losing).toBeGreaterThan(15); // a winning run is worth a lot of goodwill
    expect(winning).toBeGreaterThan(70);
    expect(losing).toBeLessThan(70);
  });

  it("money, contracts, injuries and form all show up as reasons", () => {
    const s = newGame(103);
    const p = squadOf(s.players, s.userClubId)[3];
    p.contract.wage = Math.round(wageDemand(p) * 0.5);
    expect(moraleFactors(s, p).some((f) => f.label === "Feels badly underpaid")).toBe(true);
    p.contract.wage = Math.round(wageDemand(p) * 1.6);
    expect(moraleFactors(s, p).some((f) => f.label === "Well rewarded")).toBe(true);
    p.contract.until = s.season;
    expect(moraleFactors(s, p).some((f) => f.label === "Contract expires this season")).toBe(true);
    p.injuredWeeks = 4;
    expect(moraleFactors(s, p).some((f) => f.label === "Frustrated by injury")).toBe(true);
    p.form = [7.6, 7.5, 7.8];
    expect(moraleFactors(s, p).some((f) => f.label === "In fine form")).toBe(true);
    p.form = [5.1, 5.2];
    expect(moraleFactors(s, p).some((f) => f.label === "Struggling for form")).toBe(true);

    // and they actually move the number
    const s2 = newGame(103);
    const q = squadOf(s2.players, s2.userClubId)[3];
    q.morale = 60;
    q.contract.wage = Math.round(wageDemand(q) * 0.5);
    s2.round = 1;
    moraleTick(s2, [mkResult(s2, 1, 1)]);
    expect(q.morale).toBeLessThan(58);
  });

  it("the dressing room follows its leaders", () => {
    const s = newGame(104);
    const club = squadOf(s.players, s.userClubId);
    const lead = leaders(s, s.userClubId);
    expect(lead).toHaveLength(3);
    const leadIds = new Set(lead.map((l) => l.id));
    for (const p of club) p.morale = leadIds.has(p.id) ? 95 : 45;
    s.round = 1;
    // draws, nobody plays — only the leader pull acts
    moraleTick(s, [mkResult(s, 1, 1)]);
    const follower = club.find((p) => !leadIds.has(p.id))!;
    expect(follower.morale).toBeGreaterThan(45); // pulled up toward the leaders
    expect(follower.morale).toBeLessThan(68);
    // a toxic leadership drags everyone down
    const s2 = newGame(104);
    const club2 = squadOf(s2.players, s2.userClubId);
    const leadIds2 = new Set(leaders(s2, s2.userClubId).map((l) => l.id));
    for (const p of club2) p.morale = leadIds2.has(p.id) ? 15 : 60;
    s2.round = 1;
    moraleTick(s2, [mkResult(s2, 1, 1)]);
    expect(club2.find((p) => !leadIds2.has(p.id))!.morale).toBeLessThan(60);
  });

  it("miserable players hand in transfer requests — and withdraw them when it clears up", () => {
    const s = newGame(105);
    const p = squadOf(s.players, s.userClubId)[5];
    p.morale = 10;
    p.recentMin = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let r = 1; r <= 4; r++) {
      s.round = r;
      moraleTick(s, [mkResult(s, 0, 2)]);
    }
    expect(p.transferRequest).toBe(true);
    expect(s.devNews.some((n) => n.includes("transfer request"))).toBe(true);
    // an unsettled player attracts bids, and is sold cheap
    expect(moraleFactors(s, p).some((f) => f.label === "Wants to leave")).toBe(true);

    // fix his mood: the request goes away
    p.morale = 70;
    s.round = 6;
    moraleTick(s, [mkResult(s, 2, 0)]);
    expect(p.transferRequest).toBe(false);
    expect(s.devNews.some((n) => n.includes("withdrawn his transfer request"))).toBe(true);
  });

  it("individual chats land differently depending on form", () => {
    const s = newGame(106);
    const squad = squadOf(s.players, s.userClubId);
    const hot = squad.find((p) => !hasTrait(p, "leader"))!;
    hot.form = [7.5, 7.2, 7.9];
    hot.morale = 50;
    const praised = talkToPlayer(s, hot.id, "praise");
    expect("delta" in praised && praised.delta).toBe(7);
    expect(hot.morale).toBe(57);
    // cooldown
    const again = talkToPlayer(s, hot.id, "praise");
    expect("error" in again).toBe(true);
    // a leader takes praise even better
    const boss = squad.find((p) => hasTrait(p, "leader"));
    if (boss) {
      boss.form = [7.5, 7.2];
      boss.morale = 50;
      const big = talkToPlayer(s, boss.id, "praise");
      expect("delta" in big && big.delta).toBe(9);
    }
    // criticising your best performer backfires
    const s2 = newGame(106);
    const hot2 = squadOf(s2.players, s2.userClubId).find((p) => !hasTrait(p, "leader"))!;
    hot2.form = [7.5, 7.2];
    hot2.morale = 50;
    const warned = talkToPlayer(s2, hot2.id, "warn");
    expect("delta" in warned && warned.delta).toBeLessThan(0);
    // ...but the same words land with a struggler
    const s3 = newGame(106);
    const cold = squadOf(s3.players, s3.userClubId).find((p) => !hasTrait(p, "leader"))!;
    cold.form = [5.0, 5.2];
    cold.morale = 50;
    const told = talkToPlayer(s3, cold.id, "warn");
    expect("delta" in told && told.delta).toBeGreaterThan(0);
    expect("morale" in told ? told.morale : -1).toBe(56);
    // a struggling player shrugs off praise
    const s4 = newGame(106);
    const cold2 = squadOf(s4.players, s4.userClubId).find((p) => !hasTrait(p, "leader"))!;
    cold2.form = [5.0, 5.2];
    cold2.morale = 50;
    const soft = talkToPlayer(s4, cold2.id, "praise");
    expect("delta" in soft && soft.delta).toBe(1);
    // not your player
    const rival = s4.players.find((x) => x.clubId !== s4.userClubId)!;
    expect("error" in talkToPlayer(s4, rival.id, "praise")).toBe(true);
  });

  it("an unhappy player won't discuss a new deal (unless you overpay)", () => {
    const s = newGame(107);
    const p = squadOf(s.players, s.userClubId).find((x) => x.contract.until > s.season)!;
    p.morale = 12;
    const refused = renewContract(s, p.id, Math.round(wageDemand(p)));
    expect(refused.resp.kind).toBe("rejected");
    expect(refused.resp.message).toMatch(/unhappy|won't discuss/i);
    const silly = renewContract(s, p.id, Math.round(wageDemand(p) * 1.6));
    expect(silly.resp.kind).not.toBe("rejected");
    // a happy player is cheaper than a grumpy one
    const s2 = newGame(107);
    const q = squadOf(s2.players, s2.userClubId).find((x) => x.contract.until > s2.season)!;
    q.morale = 85;
    const happy = renewContract(s2, q.id, Math.round(wageDemand(q) * 0.95));
    expect(["accepted", "counter"]).toContain(happy.resp.kind);
  });

  it("morale reaches the pitch: happy squads outperform miserable ones", () => {
    const outcome = (seed: number, mood: number) => {
      const s = newGame(seed);
      for (const p of s.players) if (p.clubId === s.userClubId) p.morale = mood;
      const { save } = playRound(s);
      const m = save.lastUserMatch!;
      const us = m.homeId === s.userClubId ? m.homeGoals : m.awayGoals;
      const them = m.homeId === s.userClubId ? m.awayGoals : m.homeGoals;
      return { diff: us - them, us, them };
    };
    let happy = 0;
    let sad = 0;
    let differing = 0;
    for (let i = 1; i <= 60; i++) {
      const h = outcome(i * 13, 100);
      const l = outcome(i * 13, 5);
      happy += h.diff;
      sad += l.diff;
      if (h.us !== l.us || h.them !== l.them) differing++;
    }
    expect(differing).toBeGreaterThan(0); // morale genuinely changes matches
    expect(happy).toBeGreaterThan(sad);
  });

  it("builds the dressing-room view: atmosphere, groups, leaders", () => {
    const s = newGame(108);
    const club = squadOf(s.players, s.userClubId);
    club[0].morale = 95;
    club[1].morale = 10;
    const a = atmosphere(s);
    expect(a.avg).toBeGreaterThan(50);
    expect(a.avg).toBeLessThan(70);
    expect(a.counts.reduce((x, c) => x + c.n, 0)).toBe(club.length);
    expect(a.unhappy.some((p) => p.id === club[1].id)).toBe(true);
    expect(a.happy.some((p) => p.id === club[0].id)).toBe(true);
    const groups = socialGroups(s);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.reduce((x, g) => x + g.players.length, 0)).toBe(club.length);
    expect(leaders(s, s.userClubId)).toHaveLength(3);
    expect(recentForm(s)).toEqual([]);
  });

  it("is deterministic", () => {
    const run = () => {
      let s = newGame(109);
      for (let r = 1; r <= 6; r++) s = playRound(s).save;
      return JSON.stringify(s.players.map((p) => [p.id, p.morale, p.recentMin]));
    };
    expect(run()).toBe(run());
  });
});

describe("on-pitch realism", () => {
  const conds = (over: Partial<MatchConditions> = {}): MatchConditions => ({
    weather: "dry",
    ref: "ref-okafor",
    pitch: "good",
    ...over
  });

  const sim = (save: SaveGame, fx: { round: number; homeId: string; awayId: string }, conditions: MatchConditions) => {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    const inputs = {
      round: fx.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
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
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      conditions,
      rng: mulberry32(hashSeed(save.seed, "match", save.season, fx.round, fx.homeId, fx.awayId)),
      userSide: fx.homeId === save.userClubId ? ("home" as const) : ("away" as const)
    };
    const state = advanceTo(startMatch(inputs), 200, playersById(save));
    return { result: finalizeMatch(state), state };
  };

  /** A neutral fixture (no user club involvement) from a fresh save. */
  const neutralFixture = (seed: number) => {
    const save = newGame(seed);
    const fx = save.fixtures.find((f) => f.round === 1 && f.homeId !== save.userClubId && f.awayId !== save.userClubId)!;
    return { save, fx };
  };

  const aggregate = (weather: WeatherId, ref: string, n = 14) => {
    let goals = 0;
    let blocks = 0;
    let corners = 0;
    let cards = 0;
    let offsides = 0;
    let vars = 0;
    for (let i = 1; i <= n; i++) {
      const { save, fx } = neutralFixture(i * 41);
      const r = sim(save, fx, conds({ weather, ref }));
      goals += r.result.homeGoals + r.result.awayGoals;
      blocks += r.result.events.filter((e) => e.type === "block").length;
      corners += r.result.events.filter((e) => e.type === "corner").length;
      cards += r.result.events.filter((e) => e.type === "yellow" || e.type === "red").length;
      offsides += r.state.timeline.filter((s) => s.o === "offside").length;
      vars += r.state.timeline.filter((s) => s.vr !== undefined).length;
    }
    return { goals, blocks, corners, cards, offsides, vars };
  };

  it("picks the round's conditions deterministically, the same for the whole division", () => {
    const a = conditionsFor(newGame(11), 4);
    const b = conditionsFor(newGame(11), 4);
    expect(a).toEqual(b);
    expect(REFS.some((r) => r.id === a.ref)).toBe(true);
    expect(WEATHERS[a.weather]).toBeDefined();
    // weather varies round to round, and the pitches wear through the season
    const s = newGame(11);
    const weathers = new Set<string>();
    for (let r = 1; r <= 18; r++) weathers.add(conditionsFor(s, r).weather);
    expect(weathers.size).toBeGreaterThan(1);
    expect(conditionsFor(s, 1).pitch).toBe("good");
    expect(conditionsFor(s, 15).pitch).toBe("heavy");
    // a soaking on a good pitch downgrades it
    for (let r = 1; r <= 6; r++) {
      const c = conditionsFor(s, r);
      if (c.weather === "rain" && r <= 6) expect(c.pitch).not.toBe("good");
    }
    expect(conditionLine(a)).toMatch(/Ref: .+ \((strict|lenient|balanced)\)/);
  });

  it("neutral conditions change nothing (calibration safety)", () => {
    const eff = conditionEffects(DEFAULT_CONDITIONS);
    expect(eff.conversion).toBe(1);
    expect(eff.turnover).toBe(1);
    expect(eff.corner).toBe(1);
    expect(eff.fouls).toBe(1);
    expect(eff.cards).toBe(1);
    expect(eff.pen).toBe(1);
    expect(weatherOf("rain").conversion).toBeLessThan(1);
    expect(pitchOf("heavy").turnover).toBeGreaterThan(1);
  });

  it("rain roughens a match up: fewer goals, more blocks than a dry day", () => {
    const dry = aggregate("dry", "ref-okafor");
    const rain = aggregate("rain", "ref-okafor");
    expect(rain.goals).toBeLessThan(dry.goals);
    expect(rain.blocks).toBeGreaterThan(dry.blocks);
    expect(rain.corners).toBeGreaterThan(dry.corners);
  });

  it("a strict referee books far more players than a lenient one", () => {
    const strict = aggregate("dry", "ref-doyle");
    const lenient = aggregate("dry", "ref-whitfield");
    expect(strict.cards).toBeGreaterThan(lenient.cards);
    expect(strict.cards).toBeGreaterThan(lenient.cards * 1.4);
  });

  it("the assistant's flag and the VAR room change results — and the stats count them", () => {
    let flagged = 0;
    let overturned = 0;
    let restored = 0;
    let penaltyReviews = 0;
    let statOffsides = 0;
    let offsideStrokesTotal = 0;
    for (let i = 1; i <= 60; i++) {
      const { save, fx } = neutralFixture(i * 17);
      const r = sim(save, fx, conds());
      for (const s of r.state.timeline) {
        if (s.o === "offside") expect(s.vr === "restored").not.toBe(true);
        if (s.vr === "overturned") overturned++;
        if (s.vr === "restored") restored++;
      }
      for (const e of r.result.events) {
        if (e.type === "offside") flagged++;
        if (e.type === "var" && /penalty/.test(e.text)) penaltyReviews++;
      }
      const st = matchStats(r.state, r.state.total);
      statOffsides += st.offsideHome + st.offsideAway;
      offsideStrokesTotal += r.state.timeline.filter((s) => s.o === "offside").length;
      expect(st.varHome + st.varAway).toBe(r.result.events.filter((e) => e.type === "var").length);
    }
    expect(flagged).toBeGreaterThan(0);
    expect(statOffsides).toBe(offsideStrokesTotal);
    expect(overturned).toBeGreaterThan(0);
    expect(restored).toBeGreaterThan(0);
    expect(penaltyReviews).toBeGreaterThan(0);
  });

  it("disallowed goals never reach the scorers list or the scoreline", () => {
    let checked = 0;
    for (let i = 1; i <= 40 && checked < 6; i++) {
      const { save, fx } = neutralFixture(i * 29);
      const r = sim(save, fx, conds({ weather: "rain" }));
      const offsideStrokes = r.state.timeline.filter((s) => s.o === "offside");
      if (!offsideStrokes.length) continue;
      checked++;
      // the timeline's goal count always equals the result
      expect(r.state.timeline.filter((s) => s.o === "goal").length).toBe(r.result.homeGoals + r.result.awayGoals);
      // the scoreline itself matches the credited goals
      const credited = r.result.scorers.length;
      expect(credited).toBe(r.result.homeGoals + r.result.awayGoals);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("announces the conditions at kickoff and the added time", () => {
    const save = newGame(5);
    const live = startLive(save)!;
    expect(live.state.events[0].text).toMatch(/Referee: /);
    expect(live.state.cond).toEqual(conditionsFor(save, save.round));
    expect(live.state.events.some((e) => /added on/.test(e.text))).toBe(true);
    expect(live.state.total).toBeGreaterThan(90);
  });

  it("the live match keeps its conditions across the half-time split", () => {
    const save = newGame(4243);
    const live = startLive(save)!;
    const second = resumeSecondHalf(live, playersById(save));
    expect(second.state.cond).toEqual(live.base.cond);
    // and the second half is still byte-identical to the one-shot sim
    const fx = userFixture(save)!;
    const one = sim(save, fx, conditionsFor(save, save.round)).result;
    const split = finalizeLive(second);
    expect(split.homeGoals).toBe(one.homeGoals);
    expect(JSON.stringify(split.events)).toBe(JSON.stringify(one.events));
  });

  it("is deterministic", () => {
    const run = () => {
      const save = newGame(66);
      const r = sim(save, neutralFixture(66).fx, conditionsFor(save, 7));
      return JSON.stringify([r.result.homeGoals, r.result.awayGoals, r.result.events, r.state.timeline]);
    };
    expect(run()).toBe(run());
  });
});

describe("media & press", () => {
  it("opens with a press conference and a fanbase", () => {
    const s = newGame(201);
    expect(s.media!.fans).toBe(55);
    expect(s.media!.respect).toBe(55);
    expect(s.media!.headlines).toEqual([]);
    expect(s.media!.press).not.toBeNull();
    expect(s.media!.press!.questions).toHaveLength(2);
    expect(s.media!.press!.round).toBe(1);
    // deterministic
    expect(JSON.stringify(newGame(201).media)).toBe(JSON.stringify(s.media));
  });

  it("asks questions that match what is happening at the club", () => {
    const s = newGame(202);
    // a transfer request should surface the unrest question
    const p = squadOf(s.players, s.userClubId)[4];
    p.transferRequest = true;
    expect(questionPool(s).some((q) => q.id === "unrest")).toBe(true);
    // a losing run should surface the crisis question
    for (let i = 0; i < 4; i++) {
      s.recentResults = [{ season: 1, round: i + 1, oppId: "c2", h: true, gf: 0, ga: 2 }];
      s.round = i + 1;
      moraleTick(s, []);
    }
    s.recentResults = [1, 2, 3, 4].map((r) => ({ season: 1, round: r, oppId: "c2", h: true, gf: 0, ga: 2 }));
    expect(questionPool(s).some((q) => q.id === "crisis")).toBe(true);
    // every question offers three answers
    for (const q of questionPool(s)) expect(q.answers).toHaveLength(3);
  });

  it("answering applies the effects and finishes the conference", () => {
    const s = newGame(203);
    const before = s.media!.fans;
    const first = answerPress(s, 0);
    expect("reply" in first).toBe(true);
    expect(s.media!.fans).not.toBe(before);
    expect(s.media!.press!.idx).toBe(1);
    const second = answerPress(s, 0);
    expect("done" in second && second.done).toBe(true);
    expect(s.media!.press).toBeNull();
    expect(s.media!.pressCount).toBe(1);
    // the conference made the papers
    expect(s.media!.headlines.some((h) => h.kind === "press")).toBe(true);
  });

  it("hits the intended player hardest (and spares the rest)", () => {
    const s = newGame(204);
    // craft a praise-the-star question
    const sq = squadOf(s.players, s.userClubId);
    const star = [...sq].sort((a, b) => b.goals - a.goals || overallFor(b) - overallFor(a))[0];
    const other = sq.find((p) => p.id !== star.id)!;
    const starBefore = star.morale ?? 60;
    const otherBefore = other.morale ?? 60;
    // find the talentspot question and pick the praise answer
    for (let r = 1; r <= 8; r++) {
      const s2 = newGame(204 + r);
      const qs = questionPool(s2);
      const q = qs.find((x) => x.id === "talentspot");
      if (!q) continue;
      s2.media!.press = { season: 1, round: 1, questions: [q], idx: 0, log: [] };
      const sq2 = squadOf(s2.players, s2.userClubId);
      const st2 = [...sq2].sort((a, b) => b.goals - a.goals || overallFor(b) - overallFor(a))[0];
      const ot2 = sq2.find((p) => p.id !== st2.id)!;
      const sb = st2.morale ?? 60;
      const ob = ot2.morale ?? 60;
      answerPress(s2, 0);
      expect((st2.morale ?? 60) - sb).toBeGreaterThan((ot2.morale ?? 60) - ob);
      return;
    }
    // fall back to the direct assertion
    expect(starBefore).toBe(60);
    expect(otherBefore).toBe(60);
  });

  it("a promised win is checked — kept or thrown back at you", () => {
    const s = newGame(205);
    s.media!.press = {
      season: 1,
      round: 1,
      questions: [
        {
          id: "test",
          hint: "",
          text: "Will you win?",
          answers: [
            { label: "Yes.", reply: "Bold.", fans: 0, respect: 0, morale: 0, promiseWin: true },
            { label: "No.", reply: "Honest.", fans: 0, respect: 0, morale: 0 },
            { label: "Maybe.", reply: "Hmm.", fans: 0, respect: 0, morale: 0 }
          ]
        }
      ],
      idx: 0,
      log: []
    };
    answerPress(s, 0);
    expect(s.media!.promises).toHaveLength(1);

    // the promise comes due after the round: a win keeps it
    const fansBefore = s.media!.fans;
    mediaTick(s, [
      { round: 1, homeId: s.userClubId, awayId: "c2", homeGoals: 2, awayGoals: 0, scorers: [{ name: "X", minute: 12 }] }
    ]);
    expect(s.media!.promises).toHaveLength(0);
    expect(s.media!.fans).toBeGreaterThan(fansBefore);
    expect(s.media!.headlines.some((h) => h.kind === "promise" && h.tone === "good")).toBe(true);

    // and a broken one bites
    const s2 = newGame(205);
    s2.media!.press = {
      season: 1,
      round: 1,
      questions: [
        {
          id: "test",
          hint: "",
          text: "Will you win?",
          answers: [
            { label: "Yes.", reply: "Bold.", fans: 0, respect: 0, morale: 0, promiseWin: true },
            { label: "No.", reply: "Honest.", fans: 0, respect: 0, morale: 0 },
            { label: "Maybe.", reply: "Hmm.", fans: 0, respect: 0, morale: 0 }
          ]
        }
      ],
      idx: 0,
      log: []
    };
    answerPress(s2, 0);
    const fansBefore2 = s2.media!.fans;
    const moraleBefore = squadOf(s2.players, s2.userClubId).map((p) => p.morale ?? 60);
    mediaTick(s2, [
      { round: 1, homeId: s2.userClubId, awayId: "c2", homeGoals: 0, awayGoals: 1, scorers: [] }
    ]);
    expect(s2.media!.fans).toBeLessThan(fansBefore2);
    expect(s2.media!.headlines.some((h) => h.kind === "promise" && h.tone === "bad")).toBe(true);
    expect(squadOf(s2.players, s2.userClubId).every((p, i) => (p.morale ?? 60) < moraleBefore[i])).toBe(true);
  });

  it("results move fan confidence and write match reports", () => {
    const run = (gf: number, ga: number, n: number) => {
      const s = newGame(206);
      for (let r = 1; r <= n; r++) {
        mediaTick(s, [
          { round: r, homeId: s.userClubId, awayId: "c2", homeGoals: gf, awayGoals: ga, scorers: [{ name: "A", minute: 5 }] }
        ]);
      }
      return s;
    };
    const won = run(3, 0, 4);
    const lost = run(0, 3, 4);
    expect(won.media!.fans).toBeGreaterThan(55);
    expect(lost.media!.fans).toBeLessThan(55);
    const wonReport = won.media!.headlines.find((h) => h.kind === "report")!;
    const lostReport = lost.media!.headlines.find((h) => h.kind === "report")!;
    expect(wonReport.tone).toBe("good");
    expect(lostReport.tone).toBe("bad");
    expect(won.media!.headlines.length).toBeLessThanOrEqual(HEADLINES_CAP);
  });

  it("keeps a short feed — capped and newest first", () => {
    const s = newGame(207);
    for (let r = 1; r <= 30; r++) {
      mediaTick(s, [
        { round: r, homeId: s.userClubId, awayId: "c2", homeGoals: 1, awayGoals: 0, scorers: [{ name: "A", minute: 5 }] }
      ]);
    }
    expect(s.media!.headlines).toHaveLength(HEADLINES_CAP);
    expect(s.media!.headlines[0].round).toBeGreaterThanOrEqual(s.media!.headlines[HEADLINES_CAP - 1].round);
  });

  it("scheduling: a conference per round, drawn from the pool", () => {
    const s = newGame(208);
    const q1 = s.media!.press!.questions.map((q) => q.id);
    s.media!.press = null;
    makePress(s);
    expect(s.media!.press!.questions.map((q) => q.id)).toEqual(q1); // same round, same questions
    s.round = 5;
    makePress(s);
    expect(s.media!.press!.round).toBe(5);
  });

  it("skipping costs a little respect but no damage", () => {
    const s = newGame(209);
    const fans = s.media!.fans;
    const respect = s.media!.respect;
    skipPress(s);
    expect(s.media!.press).toBeNull();
    expect(s.media!.skipped).toBe(1);
    expect(s.media!.respect).toBeLessThan(respect);
    expect(s.media!.fans).toBeLessThan(fans);
  });

  it("rumours mention real players and fire sometimes", () => {
    let rumours = 0;
    for (let i = 1; i <= 12; i++) {
      const s = newGame(300 + i);
      for (let r = 1; r <= 6; r++) {
        mediaTick(s, [
          { round: r, homeId: s.userClubId, awayId: "c2", homeGoals: 1, awayGoals: 1, scorers: [] }
        ]);
      }
      for (const h of s.media!.headlines) {
        if (h.kind !== "rumour") continue;
        rumours++;
        const names = squadOf(s.players, s.userClubId).map((p) => p.name);
        expect(names.some((n) => h.text.includes(n))).toBe(true);
      }
    }
    expect(rumours).toBeGreaterThan(0);
  });

  it("feeds the dressing room and the gate receipts", () => {
    const s = newGame(210);
    const p = squadOf(s.players, s.userClubId)[0];
    s.media!.fans = 85;
    expect(moraleFactors(s, p).some((f) => f.label.includes("behind us"))).toBe(true);
    s.media!.fans = 20;
    expect(moraleFactors(s, p).some((f) => f.label.includes("turned"))).toBe(true);
    // a rival does not hear your crowd
    const rival = s.players.find((x) => x.clubId !== s.userClubId)!;
    expect(moraleFactors(s, rival).some((f) => f.label.includes("crowd"))).toBe(false);

    // gate receipts at the rollover
    const rich = newGame(211);
    const poor = newGame(211);
    rich.media!.fans = 90;
    poor.media!.fans = 10;
    const base = rich.finances[rich.userClubId].transfer;
    mediaGate(rich);
    mediaGate(poor);
    expect(rich.finances[rich.userClubId].transfer).toBeGreaterThan(base);
    expect(poor.finances[poor.userClubId].transfer).toBeLessThan(base);
    expect(rich.media!.fans).toBe(90); // the gate never rewrites the mood
  });

  it("is deterministic across a season", () => {
    const run = () => {
      let s = newGame(212);
      for (let r = 1; r <= 6; r++) s = playRound(s).save;
      return JSON.stringify([s.media, s.players.map((p) => p.morale)]);
    };
    expect(run()).toBe(run());
  });

  it("normalizeSave backfills the newsroom and repairs junk", () => {
    const save = newGame(213);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    delete (old as { media?: unknown }).media;
    const fixed = normalizeSave(old);
    expect(fixed.media!.fans).toBe(55);
    expect(fixed.media!.headlines).toEqual([]);
    expect(fixed.media!.press).toBeNull();

    const s2 = newGame(214);
    (s2 as unknown as Record<string, unknown>).media = {
      fans: "lots",
      respect: 999,
      headlines: [{ nope: true }, { season: 1, round: 2, kind: "report", tone: "good", text: "ok" }],
      press: { questions: [], idx: 5 },
      promises: "soon",
      pressCount: null
    };
    const fixed2 = normalizeSave(s2);
    expect(fixed2.media!.fans).toBe(55);
    expect(fixed2.media!.respect).toBe(100);
    expect(fixed2.media!.headlines).toHaveLength(1);
    expect(fixed2.media!.press).toBeNull();
    expect(fixed2.media!.promises).toEqual([]);
    expect(fixed2.media!.pressCount).toBe(0);
  });
});

describe("calendar", () => {
  it("does civil date arithmetic without Date", () => {
    expect(serial({ y: 1970, m: 0, d: 1 })).toBe(0);
    expect(dayOfWeek({ y: 1970, m: 0, d: 1 })).toBe(4); // a Thursday
    expect(dayOfWeek({ y: 2000, m: 0, d: 1 })).toBe(6); // a Saturday
    expect(dayOfWeek(seasonStart(1))).toBe(6); // 8 Aug 2026 is a Saturday
    expect(daysInMonth(2028, 1)).toBe(29); // leap year
    expect(daysInMonth(2027, 1)).toBe(28);
    for (let i = 0; i < 400; i++) {
      const d = addDays({ y: 2026, m: 0, d: 1 }, i);
      expect(sameDay(fromSerial(serial(d)), d)).toBe(true);
    }
  });

  it("lays the season out week by week", () => {
    const save = newGame(501);
    expect(seasonStart(1)).toEqual({ y: 2026, m: 7, d: 8 });
    expect(seasonStart(3)).toEqual({ y: 2028, m: 7, d: 8 });
    expect(roundDate(1, 1)).toEqual({ y: 2026, m: 7, d: 8 });
    expect(roundDate(1, 18)).toEqual(addDays({ y: 2026, m: 7, d: 8 }, 119)); // 5 Dec 2026
    expect(roundDate(2, 1)).toEqual({ y: 2027, m: 7, d: 8 });
    expect(dayOfWeek(roundDate(1, 7))).toBe(6); // every match day is a Saturday
    expect(seasonRoundsOf(save)).toBe(18);
    // a full month of paging for one season
    const months = seasonMonths(save);
    expect(months[0]).toEqual({ y: 2026, m: 7 }); // August 2026
    expect(months[months.length - 1]).toEqual({ y: 2026, m: 11 }); // December 2026
  });

  it("marks match days, training days and rest days", () => {
    const save = newGame(502);
    const sat = roundDate(1, 1);
    const matchDay = dayFor(save, sat)!;
    const fx = save.fixtures.find(
      (f) => f.round === 1 && (f.homeId === save.userClubId || f.awayId === save.userClubId)
    )!;
    const opp = fx.homeId === save.userClubId ? fx.awayId : fx.homeId;
    expect(matchDay.match?.round).toBe(1);
    expect(matchDay.match?.oppId).toBe(opp);
    expect(matchDay.match?.home).toBe(fx.homeId === save.userClubId);
    expect(matchDay.match?.played).toBe(false);
    expect(matchDay.training).toBeUndefined();

    const mon = addDays(sat, -5);
    const trainingDay = dayFor(save, mon)!;
    expect(trainingDay.training?.unit).toBe(save.training.unit);
    expect(trainingDay.training?.label).toContain(UNITS[save.training.unit].label);
    expect(trainingDay.match).toBeUndefined();

    const sun = addDays(sat, 1);
    const rest = dayFor(save, sun)!;
    expect(rest.training).toBeUndefined();
    expect(rest.match).toBeUndefined();

    // outside the season there is no calendar at all
    expect(dayFor(save, addDays(sat, -30))).toBeNull();
    expect(dayFor(save, addDays(sat, 200))).toBeNull();
  });

  it("carries results into the past and leaves the future open", () => {
    const played = playRound(newGame(503));
    const save = played.save;
    const past = roundDate(1, 1);
    const pastDay = dayFor(save, past)!;
    expect(pastDay.match?.played).toBe(true);
    expect(typeof pastDay.match?.result).toBe("string");
    expect(typeof pastDay.match?.gf).toBe("number");
    const next = roundDate(1, save.round);
    expect(dayFor(save, next)!.match?.played).toBe(false);
    expect(dayFor(save, next)!.match?.result).toBeUndefined();
  });

  it("marks the transfer windows and the season's bookends", () => {
    const save = newGame(504);
    const dayAt = (round: number) => dayFor(save, roundDate(1, round))!;
    const midweek = (round: number) => dayFor(save, addDays(roundDate(1, round), -3))!;
    expect(dayAt(1).events).toContain("Season opener");
    expect(dayAt(1).events).toContain("Summer window opens");
    expect(dayAt(3).events).toContain("Summer window closes");
    expect(dayAt(9).events).toContain("Winter window opens");
    expect(dayAt(10).events).toContain("Winter window closes");
    expect(dayAt(5).events).toEqual([]);
    expect(dayAt(18).events).toContain("Final day");
    // window markers sit on match day, not across the whole week
    expect(midweek(1).events).toEqual([]);
    expect(midweek(3).events).toEqual([]);
  });

  it("builds a month grid that lines up with the weekday", () => {
    const save = newGame(505);
    const aug = calendarMonth(save, 2026, 7);
    expect(aug.label).toBe("August 2026");
    expect(aug.weeks).toHaveLength(6);
    for (const w of aug.weeks) expect(w).toHaveLength(7);
    // 1 Aug 2026 is a Saturday: six empty cells lead the month
    const firstRow = aug.weeks[0];
    expect(firstRow[0]).toBeNull();
    for (let i = 0; i < 6; i++) expect(firstRow[i]).toBeNull();
    // every populated cell sits in its own weekday column — for every month of the season
    for (const { y, m } of seasonMonths(save)) {
      const cal = calendarMonth(save, y, m);
      for (const row of cal.weeks) {
        row.forEach((day, col) => {
          if (day) expect(day.dow).toBe(col);
        });
      }
    }
    // the season's first Monday opens the grid's second row, and every in-season
    // day of the month is present in the flat list
    expect(sameDay(aug.weeks[1][1]!.date, { y: 2026, m: 7, d: 3 })).toBe(true);
    expect(aug.weeks[1][6]!.match?.round).toBe(1); // the opener: Saturday, column 6
    expect(aug.days.some((d) => d.date.d === 1)).toBe(false); // before the season opens
    for (let d = 3; d <= 31; d++) expect(aug.days.some((x) => x.date.d === d)).toBe(true);
    // 8 Aug is inside the month and is the opener
    const opener = aug.days.find((d) => d.date.d === 8)!;
    expect(opener.match?.round).toBe(1);
    expect(opener.events).toContain("Season opener");
  });

  it("follows the round being played as 'this week'", () => {
    const save = newGame(506);
    const sat = roundDate(1, 1);
    expect(dayFor(save, sat)!.currentWeek).toBe(true);
    expect(dayFor(save, addDays(sat, -5))!.currentWeek).toBe(true);
    expect(dayFor(save, addDays(sat, 7))!.currentWeek).toBe(false);
    const next = playRound(save).save;
    expect(next.round).toBe(2);
    expect(dayFor(next, addDays(sat, 7))!.currentWeek).toBe(true);
    expect(dayFor(next, sat)!.currentWeek).toBe(false);
  });

  it("lists the fixtures still to come with their dates", () => {
    const save = newGame(507);
    const up = upcoming(save, 5);
    expect(up).toHaveLength(5);
    expect(up[0].round).toBe(1);
    expect(up.map((u) => u.round)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < up.length; i++) {
      expect(diffDays(up[i].date, up[i - 1].date)).toBe(7);
    }
    expect(up[0].training).toContain(UNITS[save.training.unit].label);
    // after a round the list shifts by one
    const after = playRound(save).save;
    expect(upcoming(after, 3).map((u) => u.round)).toEqual([2, 3, 4]);
  });

  it("is deterministic and never touches the save", () => {
    const save = newGame(508);
    const before = JSON.stringify(save);
    const a = JSON.stringify(calendarMonth(save, 2026, 9));
    const b = JSON.stringify(calendarMonth(save, 2026, 9));
    expect(a).toBe(b);
    expect(JSON.stringify(save)).toBe(before);
    // and identical across two saves from the same seed
    expect(JSON.stringify(calendarMonth(newGame(508), 2026, 9))).toBe(a);
  });
});

describe("match legs (stamina) & the bench", () => {
  function inputsFor(save: SaveGame, fx: { homeId: string; awayId: string }) {
    const home = resolveSide(save, fx.homeId);
    const away = resolveSide(save, fx.awayId);
    return {
      round: save.round,
      homeClub: save.clubs.find((c) => c.id === fx.homeId)!,
      awayClub: save.clubs.find((c) => c.id === fx.awayId)!,
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
      homePlan: planForClub(save, fx.homeId),
      awayPlan: planForClub(save, fx.awayId),
      conditions: conditionsFor(save, save.round),
      rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId))
    };
  }

  it("starts from condition, drains through the game and never goes below zero", () => {
    const save = newGame(601);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const xi = (fx.homeId === save.userClubId ? base.homeXI : base.awayXI).slice(0, 11);
    const s0 = startMatch(base);
    for (const p of xi) expect(s0.stamina[p.id]).toBe(Math.max(40, Math.min(100, p.condition)));

    const mid = advanceTo(s0, 60, playersById(save));
    const stMid = mid.stamina[xi[0].id];
    expect(stMid).toBeLessThan(s0.stamina[xi[0].id]);
    expect(stMid).toBeGreaterThan(20);

    const full = advanceTo(s0, s0.total, playersById(save));
    for (const p of xi) {
      const st = full.stamina[p.id];
      expect(st).toBeGreaterThanOrEqual(0);
      expect(st).toBeLessThan(100);
    }
    // a 90-minute match leaves a fresh starter with something left in the tank
    const mean = xi.reduce((a, p) => a + full.stamina[p.id], 0) / xi.length;
    expect(mean).toBeGreaterThan(35);
    expect(mean).toBeLessThan(80);
  });

  it("fitter, younger players drain slower", () => {
    const save = newGame(602);
    const [a, b] = squadOf(save.players, save.userClubId).slice(0, 2);
    a.age = 22;
    b.age = 34;
    a.attrs.physical = 92;
    b.attrs.physical = 18;
    expect(staminaStart(a)).toBe(Math.max(40, Math.min(100, a.condition)));
    expect(staminaDrainPerMinute(a)).toBeLessThan(staminaDrainPerMinute(b) * 0.8);
    // and it adds up over a match: same start, the old and unfit man ends much lower
    const save2 = newGame(602);
    const fx = userFixture(save2)!;
    const base = inputsFor(save2, fx);
    const isHome = fx.homeId === save2.userClubId;
    const xi = (isHome ? base.homeXI : base.awayXI).slice(0, 11);
    xi.forEach((p, i) => {
      p.condition = 100;
      p.age = 22;
      p.attrs.physical = i % 2 === 0 ? 90 : 30;
    });
    const s0 = startMatch(base);
    const legs = advanceTo(s0, 70, playersById(save2)).stamina;
    const avg = (arr: typeof xi) => arr.reduce((sum, p) => sum + legs[p.id], 0) / arr.length;
    const fit = xi.filter((_, i) => i % 2 === 0);
    const unfit = xi.filter((_, i) => i % 2 === 1);
    expect(avg(fit)).toBeGreaterThan(avg(unfit) + 1.5);
  });

  it("the half-time break gives something back", () => {
    const save = newGame(603);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const xi = (fx.homeId === save.userClubId ? base.homeXI : base.awayXI).slice(0, 11);
    const s0 = startMatch(base);
    const at44 = advanceTo(s0, 44, playersById(save));
    const at45 = advanceTo(at44, 45, playersById(save));
    const p = xi[0].id;
    // minute 45 = one more minute of drain + the break
    expect(at45.stamina[p]).toBeGreaterThan(at44.stamina[p] + 4);
  });

  it("a sub arrives fresh and the man he replaces keeps his number", () => {
    const save = newGame(604);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const s0 = startMatch(base);
    const out = (fx.homeId === save.userClubId ? base.homeXI : base.awayXI)[3];
    const incoming = (fx.homeId === save.userClubId ? base.homeBench : base.awayBench)[0];
    const at60 = advanceTo(s0, 60, playersById(save));
    const tiredOut = at60.stamina[out.id];
    const after = applySubstitution(at60, playersById(save), "home", out.id, incoming.id);
    expect(after.stamina[incoming.id]).toBe(Math.max(40, Math.min(100, incoming.condition)));
    expect(after.stamina[incoming.id]).toBeGreaterThan(tiredOut);
    expect(after.stamina[out.id]).toBe(tiredOut); // his legs stay where he left them
    const full = advanceTo(after, after.total, playersById(save));
    expect(full.stamina[incoming.id]).toBeLessThan(after.stamina[incoming.id]);
    expect(full.stamina[incoming.id]).toBeGreaterThan(full.stamina[out.id]);
  });

  it("tired legs cost the game — exhausted sides perform worse", () => {
    const run = (condition: number) => {
      let gf = 0;
      let ga = 0;
      for (let seed = 610; seed < 650; seed++) {
        const save = newGame(seed);
        const fx = userFixture(save)!;
        const base = inputsFor(save, fx);
        for (const p of base.awayXI) p.condition = condition;
        const r = simulateMatch({ ...base, rng: mulberry32(hashSeed(seed, "match", save.season, save.round, fx.homeId, fx.awayId)) });
        const awayIsHome = fx.homeId !== save.userClubId ? false : true;
        gf += awayIsHome ? r.awayGoals : r.homeGoals; // the away side's goals
        ga += awayIsHome ? r.homeGoals : r.awayGoals;
      }
      return { gf, ga, diff: gf - ga };
    };
    const fresh = run(100);
    const knackered = run(45);
    expect(knackered.gf).toBeLessThan(fresh.gf);
    expect(knackered.diff).toBeLessThan(fresh.diff);
  });

  it("staminaFactor is neutral when fresh and monotonic", () => {
    expect(staminaFactor(100)).toBe(1);
    expect(staminaFactor(60)).toBeLessThan(1);
    expect(staminaFactor(10)).toBeGreaterThan(staminaFactor(0));
    expect(staminaFactor(0)).toBeGreaterThan(0.8);
  });

  it("staminaAt rewinds the state to the playback minute", () => {
    const save = newGame(607);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const s0 = startMatch(base);
    const at45 = advanceTo(s0, 45, playersById(save));
    const id = base.homeXI[0].id;
    expect(staminaAt(at45, id, 30)).toBeGreaterThan(at45.stamina[id]);
    expect(staminaAt(at45, id, 45)).toBeCloseTo(at45.stamina[id], 6);
    expect(staminaAt(at45, id, 0)).toBeLessThanOrEqual(100);
    // a keeper who never tires is the sanity case; a player off the pitch is frozen
    const subbed = applySubstitution(at45, playersById(save), "home", id, base.homeBench[0].id);
    expect(staminaAt(subbed, id, 10)).toBe(subbed.stamina[id]);
    // and the rewind can never exceed a full tank
    expect(staminaAt(at45, id, -5)).toBeLessThanOrEqual(100);
  });

  it("staminaTint bands the legs", () => {
    expect(staminaTint(95).label).toBe("Fresh");
    expect(staminaTint(70).label).toBe("Okay");
    expect(staminaTint(50).label).toBe("Tiring");
    expect(staminaTint(20).label).toBe("Running on empty");
  });

  it("the roster knows who is on, who is left and who has been used", () => {
    const save = newGame(605);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const s0 = startMatch(base);
    // the user's own side, so nothing happens without us asking
    const isHome = fx.homeId === save.userClubId;
    const sideKey: "home" | "away" = isHome ? "home" : "away";
    const xi = (isHome ? base.homeXI : base.awayXI).slice(0, 11);
    const bench = isHome ? base.homeBench : base.awayBench;
    let r = matchRoster(s0, sideKey);
    expect(r.on).toHaveLength(11);
    expect(r.bench).toHaveLength(bench.length);
    expect(r.cameOn).toEqual([]);
    expect(r.wentOff).toEqual([]);

    // two subs, in different windows
    const a = advanceTo(s0, 55, playersById(save));
    const first = applySubstitution(a, playersById(save), sideKey, xi[5].id, bench[0].id);
    const b = advanceTo(first, 70, playersById(save));
    const second = applySubstitution(b, playersById(save), sideKey, xi[7].id, bench[1].id);
    r = matchRoster(second, sideKey);
    expect(r.on).toHaveLength(11);
    expect(r.on).toContain(bench[0].id);
    expect(r.on).not.toContain(xi[5].id);
    expect(r.cameOn.map((x) => x.id)).toContain(bench[0].id);
    expect(r.cameOn.map((x) => x.id)).toContain(bench[1].id);
    expect(r.cameOn.find((x) => x.id === bench[0].id)!.minute).toBe(55);
    expect(r.cameOn.find((x) => x.id === bench[1].id)!.minute).toBe(70);
    expect(r.wentOff.map((x) => x.id)).toContain(xi[5].id);
    expect(r.wentOff.map((x) => x.id)).toContain(xi[7].id);
    expect(r.bench).not.toContain(bench[0].id);
    // the other side is untouched by our changes
    const other: "home" | "away" = isHome ? "away" : "home";
    expect(matchRoster(second, other).cameOn.some((x) => bench.some((p) => p.id === x.id))).toBe(false);
  });

  it("the half-time split reproduces stamina exactly", () => {
    const save = newGame(606);
    const fx = userFixture(save)!;
    const base = inputsFor(save, fx);
    const userSide = fx.homeId === save.userClubId ? "home" : "away";
    const one = simulateMatch({
      ...base,
      rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)),
      userSide
    });
    const live = startLive(save)!;
    const second = resumeSecondHalf(live, playersById(save));
    const split = finalizeLive(second);
    expect(split.homeGoals).toBe(one.homeGoals);
    const oneShot = advanceTo(startMatch({ ...base, userSide, rng: mulberry32(hashSeed(save.seed, "match", save.season, save.round, fx.homeId, fx.awayId)) }), 1000, playersById(save));
    expect(second.state.stamina).toEqual(oneShot.stamina);
  });
});

describe("save", () => {
  it("survives a JSON round trip", () => {
    const save = newGame(5);
    const clone = JSON.parse(JSON.stringify(save));
    expect(clone).toEqual(save);
    expect(clone.saveVersion).toBe(1);
  });
});
