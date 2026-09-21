import type { FormationDef, FormationId, FormationSlot } from "./types";
import { FORMATIONS, FORMATION_COORDS, FORMATION_IDS } from "./tuning";

/** The five built-ins, materialized as full FormationDefs (pos + coordinates). */
const BUILTIN: Record<FormationId, FormationDef> = Object.fromEntries(
  FORMATION_IDS.map((id) => [
    id,
    {
      id,
      name: id,
      slots: FORMATIONS[id].map((pos, i) => ({
        pos,
        x: FORMATION_COORDS[id][i][0],
        y: FORMATION_COORDS[id][i][1]
      }))
    }
  ])
) as Record<FormationId, FormationDef>;

export function builtinFormation(id: FormationId): FormationDef {
  return BUILTIN[id];
}

/** Resolve a formation id against the save's custom formations, then the built-ins. */
export function resolveFormation(id: string, customs?: FormationDef[]): FormationDef | undefined {
  return customs?.find((f) => f.id === id) ?? BUILTIN[id as FormationId];
}

/** Problems that make a formation unplayable — used by the builder and save loader. */
export function validateFormation(def: FormationDef): string[] {
  const errs: string[] = [];
  if (!Array.isArray(def.slots) || def.slots.length !== 11) {
    errs.push(`Needs exactly 11 slots (has ${def.slots?.length ?? 0})`);
  }
  const gks = def.slots.filter((s) => s.pos === "GK").length;
  if (gks !== 1) {
    errs.push(gks === 0 ? "Exactly 1 goalkeeper required" : `${gks} goalkeepers — exactly 1 required`);
  }
  if (def.slots.some((s) => s.x < 3 || s.x > 97 || s.y < 3 || s.y > 97)) {
    errs.push("Keep every slot on the pitch");
  }
  return errs;
}

/** Neutral starting shape for the builder (a plain 4-4-2 the user can reshape freely). */
export function scratchSlots(): FormationSlot[] {
  return BUILTIN["4-4-2"].slots.map((s) => ({ ...s }));
}
