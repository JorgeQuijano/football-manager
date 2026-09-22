import { describe, expect, it } from "vitest";
import { mulberry32, hashSeed } from "./rng";
import { newGame } from "./generate";
import { nextSeason, playRound, resolveSide, seasonRounds } from "./advance";
import { simulateMatch } from "./match";
import { addLiveChange, finalizeLive, matchStats, playersById, resumeSecondHalf, startLive, userFixture } from "./live";
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
  aiPlan,
  developPlayer,
  developRound,
  learnTraits
} from "./training";
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
import { FORMATION_COORDS, FORMATION_IDS, FORMATIONS, T, weeklyRecovery } from "./tuning";
import type { Intensity, Mentality, Player, Position, SaveGame, Stroke, TrainingPlan, TrainingUnit } from "./types";

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
      assists: 0
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
      awayPoss: away.poss
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
    assists: 0
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
    assists: 0
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
    assists: 0
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

describe("save", () => {
  it("survives a JSON round trip", () => {
    const save = newGame(5);
    const clone = JSON.parse(JSON.stringify(save));
    expect(clone).toEqual(save);
    expect(clone.saveVersion).toBe(1);
  });
});
