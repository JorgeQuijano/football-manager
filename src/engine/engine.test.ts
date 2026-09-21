import { describe, expect, it } from "vitest";
import { mulberry32, hashSeed } from "./rng";
import { newGame } from "./generate";
import { nextSeason, playRound, seasonRounds } from "./advance";
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
import { defaultRoleFor, ROLE_GROUPS } from "./roles";
import { FORMATION_COORDS, FORMATION_IDS, FORMATIONS, T, weeklyRecovery } from "./tuning";
import type { Player, SaveGame } from "./types";

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
    const lineup = autoLineup(squadOf(s2.players, s2.userClubId), s2.lineup.formation);
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
});

describe("lineup ops", () => {
  const save = newGame(4242);
  const squad = squadOf(save.players, save.userClubId);

  it("autoLineup assigns a valid role to every slot", () => {
    const l = autoLineup(squad, "4-3-3");
    expect(l.roles).toHaveLength(11);
    l.roles.forEach((r, i) => expect(ROLE_GROUPS[FORMATIONS["4-3-3"][i]]).toContain(r));
  });

  it("changing formation keeps your players", () => {
    const before = autoLineup(squad, "4-3-3");
    const gkId = before.starters[0];
    const after = remapLineup(squad, before, "4-4-2");
    expect(after.formation).toBe("4-4-2");
    expect(after.starters[0]).toBe(gkId);
    expect(validateLineup(squad, after)).toEqual([]);
    const kept = before.starters.filter((id) => id && after.starters.includes(id));
    expect(kept.length).toBeGreaterThanOrEqual(9);
    const after2 = remapLineup(squad, after, "3-5-2");
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
      goals: 0
    });
    const kid = mk(19, 78);
    const vet = mk(34, 52);
    expect(weeklyRecovery(kid)).toBeGreaterThan(weeklyRecovery(vet));
    expect(weeklyRecovery(vet)).toBeLessThan(T.conditionLossStarter); // veterans need rotation
    expect(weeklyRecovery(kid)).toBeGreaterThanOrEqual(T.conditionLossStarter);
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
