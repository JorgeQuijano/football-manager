import { describe, expect, it } from "vitest";
import { newGame } from "../engine";
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
});
