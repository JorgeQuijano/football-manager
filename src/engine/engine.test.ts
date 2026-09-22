import { describe, expect, it } from "vitest";
import { mulberry32, hashSeed } from "./rng";
import { newGame } from "./generate";
import { nextSeason, playRound, resolveSide, seasonRounds } from "./advance";
import { simulateMatch } from "./match";
import { addLiveChange, finalizeLive, playersById, resumeSecondHalf, startLive, userFixture } from "./live";
import { computeTable } from "./league";
import {
  attackScore,
  autoLineup,
  defenseScore,
  remapLineup,
  slotScoreFor,
  squadOf,
  validateLineup
} from "./ratings";
import { builtinFormation, clampToZone, resolveFormation, roleTemplate, scratchSlots, SLOT_ZONES, validateFormation, validateTemplate } from "./formations";
import { defaultRoleFor, laneFits, roleFinish, ROLE_DEFS, ROLE_GROUPS } from "./roles";
import { motionFor, ROLE_MOTION } from "./motion";
import { FORMATION_COORDS, FORMATION_IDS, FORMATIONS, T, weeklyRecovery } from "./tuning";
import type { Player, Position, SaveGame } from "./types";

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
    ...over
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
      ...over
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

describe("save", () => {
  it("survives a JSON round trip", () => {
    const save = newGame(5);
    const clone = JSON.parse(JSON.stringify(save));
    expect(clone).toEqual(save);
    expect(clone.saveVersion).toBe(1);
  });
});
