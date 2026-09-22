import { describe, expect, it } from "vitest";
import { newGame, startLive } from "../engine";
import { emptyHistory } from "../engine/history";
import { normalizeSave } from "./save";

describe("normalizeSave", () => {
  it("backfills missing roles for old saves", () => {
    const save = newGame(11);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    delete (old.lineup as { roles?: unknown }).roles;
    const fixed = normalizeSave(old);
    expect(fixed.lineup.roles).toHaveLength(11);
  });

  it("replaces roles that are invalid for their slot", () => {
    const save = newGame(11);
    const bad = JSON.parse(JSON.stringify(save)) as typeof save;
    bad.lineup.roles[0] = "poacher"; // invalid for a GK slot
    const fixed = normalizeSave(bad);
    expect(fixed.lineup.roles[0]).toBe("keeper");
    expect(fixed.lineup.roles).toHaveLength(11);
  });

  it("backfills customFormations, drops invalid ones, and repairs a vanished formation", () => {
    const save = newGame(21);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    delete (old as { customFormations?: unknown }).customFormations;
    const fixed = normalizeSave(old);
    expect(fixed.customFormations).toHaveLength(0);

    const withBad = JSON.parse(JSON.stringify(save)) as typeof save;
    withBad.customFormations = [{ id: "cf-x", name: "X", slots: [] }];
    const fixed2 = normalizeSave(withBad);
    expect(fixed2.customFormations).toHaveLength(0);

    const missing = JSON.parse(JSON.stringify(save)) as typeof save;
    missing.lineup.formation = "cf-gone";
    const fixed3 = normalizeSave(missing);
    expect(fixed3.lineup.formation).toBe("4-3-3");
    expect(fixed3.lineup.starters.filter(Boolean)).toHaveLength(11);
    expect(fixed3.lineup.roles).toHaveLength(11);
  });

  it("backfills assists for players from older saves", () => {
    const save = newGame(31);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    for (const p of old.players) delete (p as { assists?: unknown }).assists;
    const fixed = normalizeSave(old);
    expect(fixed.players.every((p) => p.assists === 0)).toBe(true);
  });

  it("backfills match stats for players from older saves", () => {
    const save = newGame(51);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    for (const p of old.players) {
      for (const k of ["mins", "yellows", "reds", "ratingSum", "ratingCount", "form", "history"]) {
        delete (p as unknown as Record<string, unknown>)[k];
      }
    }
    const fixed = normalizeSave(old);
    expect(
      fixed.players.every(
        (p) => p.mins === 0 && p.yellows === 0 && p.ratingCount === 0 && p.form.length === 0 && p.history.length === 0
      )
    ).toBe(true);
  });

  it("clamps the live-match playhead and drops a stale live match", () => {
    const save = newGame(41);
    const live = startLive(save)!;
    live.playhead = 999;
    save.live = live;
    const fixed = normalizeSave(save);
    expect(fixed.live).toBeDefined();
    expect(fixed.live?.playhead).toBe(live.state.total);

    const save2 = newGame(42);
    save2.live = startLive(save2)!;
    save2.round += 1;
    const fixed2 = normalizeSave(save2);
    expect(fixed2.live).toBeUndefined();
  });

  it("backfills morale state for old saves", () => {
    const save = newGame(56);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    for (const p of old.players) {
      delete (p as { morale?: unknown }).morale;
      delete (p as { recentMin?: unknown }).recentMin;
    }
    (old as unknown as Record<string, unknown>).recentResults = "junk";
    const fixed = normalizeSave(old);
    expect(fixed.players.every((p) => p.morale === 60)).toBe(true);
    expect(fixed.players.every((p) => Array.isArray(p.recentMin) && p.recentMin.length === 0)).toBe(true);
    expect(fixed.recentResults).toEqual([]);

    // junk mood state is repaired and clamped
    const s2 = newGame(57);
    s2.players[0].morale = 999;
    s2.players[1].morale = Number.NaN;
    s2.players[2].recentMin = ["x", 90, null] as never;
    s2.players[3].transferRequest = false as never;
    s2.players[4].talkKind = "shout" as never;
    const fixed2 = normalizeSave(s2);
    expect(fixed2.players[0].morale).toBe(100);
    expect(fixed2.players[1].morale).toBe(60);
    expect(fixed2.players[2].recentMin).toEqual([90]);
    expect(fixed2.players[3].transferRequest).toBeUndefined();
    expect(fixed2.players[4].talkKind).toBeUndefined();
  });

  it("backfills history & awards and repairs broken entries", () => {
    const save = newGame(54);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    delete (old as { history?: unknown }).history;
    delete (old as { awards?: unknown }).awards;
    const fixed = normalizeSave(old);
    expect(fixed.history.seasons).toEqual([]);
    expect(fixed.history.titles).toBe(0);
    expect(fixed.history.allTime.topScorer).toBeNull();
    expect(fixed.awards.rounds).toEqual([]);

    // partially-written / broken states are repaired, junk is dropped
    const s2 = newGame(55);
    (s2 as unknown as Record<string, unknown>).history = { seasons: "nope", titles: "x", allTime: 5 };
    s2.awards = { rounds: [{ bad: true }, { season: 1, round: 2, playerId: "p", name: "N", clubId: "c1", pos: "FW", rating: 7.1 }] as never, bestWin: undefined as never };
    const p = s2.players[0];
    (p as { totals?: unknown }).totals = "garbage";
    (p as { titles?: unknown }).titles = "two";
    const fixed2 = normalizeSave(s2);
    expect(fixed2.history.seasons).toEqual([]);
    expect(fixed2.history.titles).toBe(0);
    expect(fixed2.history.allTime).toEqual(emptyHistory().allTime);
    expect(fixed2.awards.rounds).toHaveLength(1);
    expect(fixed2.awards.bestWin).toBeNull();
    expect(fixed2.players[0].totals).toBeUndefined();
    expect(fixed2.players[0].titles).toBeUndefined();
  });

  it("backfills the scouting department and drops dead assignments", () => {
    const save = newGame(52);
    const old = JSON.parse(JSON.stringify(save)) as typeof save;
    delete (old as { scouting?: unknown }).scouting;
    const fixed = normalizeSave(old);
    expect(fixed.scouting.scouts.length).toBeGreaterThan(0);
    expect(fixed.scouting.budget).toBeGreaterThan(0);

    // a request pointing at a scout or player that no longer exists is dropped
    const s2 = newGame(53);
    const rival = s2.players.find((p) => p.clubId !== s2.userClubId)!;
    s2.scouting.requests.push({ id: "rx1", kind: "player", playerId: rival.id, scoutId: s2.scouting.scouts[0].id });
    s2.scouting.requests.push({ id: "rx2", kind: "player", playerId: rival.id, scoutId: "ghost" });
    s2.scouting.requests.push({ id: "rx3", kind: "player", playerId: "ghost", scoutId: s2.scouting.scouts[0].id });
    s2.scouting.reports.push("ghost");
    s2.scouting.shortlist.push("ghost", rival.id);
    s2.scouting.knowledge["ghost"] = { level: 90, seen: 1 };
    const fixed2 = normalizeSave(s2);
    expect(fixed2.scouting.requests.map((r) => r.id)).toEqual(["rx1"]);
    expect(fixed2.scouting.reports).not.toContain("ghost");
    expect(fixed2.scouting.shortlist).toEqual([rival.id]);
    expect(fixed2.scouting.knowledge["ghost"]).toBeUndefined();
  });
});
