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
});
