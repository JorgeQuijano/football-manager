import type { FormationDef, FormationId, FormationSlot, Position, RoleId } from "./types";
import { FORMATIONS, FORMATION_COORDS, FORMATION_IDS } from "./tuning";
import { laneFits, ROLE_GROUPS } from "./roles";

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

/**
 * The band of the pitch each position family may occupy.
 * Keeps shapes sensible: defenders stay behind the halfway line, forwards up top.
 */
export const SLOT_ZONES: Record<
  Position,
  { xMin: number; xMax: number; yMin: number; yMax: number }
> = {
  GK: { xMin: 38, xMax: 62, yMin: 82, yMax: 94 },
  DF: { xMin: 6, xMax: 94, yMin: 48, yMax: 90 },
  MF: { xMin: 6, xMax: 94, yMin: 26, yMax: 72 },
  FW: { xMin: 6, xMax: 94, yMin: 8, yMax: 48 }
};

/** Clamp a candidate position into the zone its position family is allowed to occupy. */
export function clampToZone(pos: Position, x: number, y: number): { x: number; y: number } {
  const z = SLOT_ZONES[pos];
  return {
    x: Math.round(Math.min(z.xMax, Math.max(z.xMin, x))),
    y: Math.round(Math.min(z.yMax, Math.max(z.yMin, y)))
  };
}

/**
 * Formation-aware default roles, index-aligned with each built-in's slots.
 * Wide slots get wide-lane roles, holding bands get holders, attacking bands
 * get creators — so auto-picked lineups arrive already shaped to the formation.
 */
const TEMPLATES: Record<FormationId, RoleId[]> = {
  "4-4-2": ["keeper", "fb", "bpd", "bpd", "fb", "w", "cm", "b2b", "w", "af", "target"],
  "4-3-3": ["keeper", "fb", "bpd", "bpd", "fb", "b2b", "dlp", "mez", "inside", "af", "inside"],
  "4-2-3-1": ["keeper", "fb", "bpd", "bpd", "fb", "anc", "dlp", "w", "playmaker", "iw", "af"],
  "3-5-2": ["keeper", "bpd", "stopper", "bpd", "w", "cm", "dlp", "mez", "w", "af", "target"],
  "5-3-2": ["keeper", "wb", "bpd", "stopper", "bpd", "wb", "cm", "dlp", "b2b", "af", "target"]
};

/** Geometry-based default for custom shapes: lane decides the family, depth the nuance. */
export function defaultRoleForSlot(slot: FormationSlot): RoleId {
  const wide = slotLaneOf(slot);
  switch (slot.pos) {
    case "GK":
      return "keeper";
    case "DF":
      return wide ? "wb" : "stopper";
    case "MF":
      if (wide) return slot.y < 45 ? "iw" : "w";
      if (slot.y < 40) return "playmaker";
      if (slot.y > 58) return "dlp";
      return "cm";
    case "FW":
      return wide ? "inside" : "af";
  }
}

const slotLaneOf = (slot: FormationSlot): boolean =>
  slot.pos !== "GK" && Math.abs(slot.x - 50) >= 32;

/** Resolve the default role line-up for any formation (built-in template or geometry + slot roles). */
export function roleTemplate(def: FormationDef): RoleId[] {
  const tpl = TEMPLATES[def.id as FormationId];
  if (tpl) return [...tpl];
  return def.slots.map((s) =>
    s.role && ROLE_GROUPS[s.pos].includes(s.role) ? s.role : defaultRoleForSlot(s)
  );
}

/** Every template role must be legal for its slot's group and lane — used by tests. */
export function validateTemplate(def: FormationDef, tpl: RoleId[]): string[] {
  const errs: string[] = [];
  if (tpl.length !== def.slots.length) errs.push(`Template length ${tpl.length} ≠ ${def.slots.length}`);
  def.slots.forEach((slot, i) => {
    const r = tpl[i];
    if (r && !laneFits(r, slot)) errs.push(`Role ${r} is off-lane for slot ${i} (${slot.pos} @ ${slot.x},${slot.y})`);
  });
  return errs;
}
