import type { Player, Position, PlayerTarget, SaveGame, TraitId } from "./types";
import { ratingAvg } from "./stats";
import { overallFor } from "./ratings";
import { hasTrait } from "./traits";
import { pushNews } from "./training";

// --- individual targets ------------------------------------------------------------------

export interface TargetOption {
  kind: PlayerTarget["kind"];
  value: number;
  label: string;
  ambitious: boolean;
}

/** What you can reasonably ask of him this season — three levels, the top one ambitious. */
export function targetOptions(p: Player): TargetOption[] {
  const ovr = overallFor(p);
  const base =
    p.pos === "FW" ? 5 + ovr / 14 : p.pos === "MF" ? 2 + ovr / 22 : p.pos === "DF" ? ovr / 30 : 0;
  const goals = [Math.max(0, Math.round(base * 0.6)), Math.round(base), Math.round(base * 1.4)];
  const apps = [10, 13, 16];
  const rating = [6.4, 6.7, 7.0];
  const out: TargetOption[] = [];
  if (p.pos !== "GK" && goals[2] > 0) {
    out.push({ kind: "goals", value: goals[0], label: `Score ${goals[0]} league goals`, ambitious: false });
    out.push({ kind: "goals", value: goals[1], label: `Score ${goals[1]} league goals`, ambitious: false });
    out.push({ kind: "goals", value: goals[2], label: `Score ${goals[2]} league goals`, ambitious: true });
  }
  out.push({ kind: "apps", value: apps[0], label: `Make ${apps[0]} appearances`, ambitious: false });
  out.push({ kind: "apps", value: apps[1], label: `Make ${apps[1]} appearances`, ambitious: false });
  out.push({ kind: "apps", value: apps[2], label: `Make ${apps[2]} appearances`, ambitious: true });
  out.push({ kind: "rating", value: rating[1], label: `Average a ${rating[1].toFixed(1)} rating`, ambitious: false });
  out.push({ kind: "rating", value: rating[2], label: `Average a ${rating[2].toFixed(1)} rating`, ambitious: true });
  return out;
}

export function setTarget(
  input: SaveGame,
  playerId: string,
  kind: PlayerTarget["kind"],
  value: number
): { save: SaveGame; resp: { ok: boolean; message: string } } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) return { save: input, resp: { ok: false, message: "He's not your player." } };
  const option = targetOptions(p).find((o) => o.kind === kind && o.value === value);
  if (!option) return { save: input, resp: { ok: false, message: "That isn't a target you can set." } };
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  pp.target = { kind, value, season: save.season, ambitious: option.ambitious };
  // how he takes it: a big ask is faith, a small one is a shrug
  pp.morale = Math.max(0, Math.min(100, (pp.morale ?? 60) + (option.ambitious ? 3 : 1)));
  pushNews(save, `${pp.name}'s target: ${option.label.toLowerCase()}.`);
  return {
    save,
    resp: {
      ok: true,
      message: option.ambitious
        ? `${pp.name} takes the challenge — he wants to prove you right.`
        : `${pp.name} nods: ${option.label.toLowerCase()}.`
    }
  };
}

export function clearTarget(input: SaveGame, playerId: string): SaveGame {
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId);
  if (pp) {
    pp.target = undefined;
    pp.morale = Math.max(0, (pp.morale ?? 60) - 1);
  }
  return save;
}

export function targetSoFar(p: Player): { current: number; value: number; pct: number } | null {
  if (!p.target) return null;
  const t = p.target;
  const current = t.kind === "goals" ? p.goals : t.kind === "apps" ? p.apps : Math.round((ratingAvg(p) ?? 0) * 100) / 100;
  const pct = t.value > 0 ? Math.max(0, Math.min(1, current / t.value)) : 0;
  return { current, value: t.value, pct };
}

export function targetLine(p: Player): string | null {
  const s = targetSoFar(p);
  if (!s || !p.target) return null;
  const t = p.target;
  const what = t.kind === "goals" ? "goals" : t.kind === "apps" ? "apps" : "avg rating";
  return `${t.kind === "rating" ? s.current.toFixed(2) : s.current}/${t.value} ${what}`;
}

/** Season end: did he deliver? Mood swings either way. */
export function settleTargets(save: SaveGame): void {
  for (const p of save.players) {
    if (!p.target || p.target.season !== save.season - 1) continue;
    const t = p.target;
    const met =
      t.kind === "goals"
        ? p.goals >= t.value
        : t.kind === "apps"
          ? p.apps >= t.value
          : (ratingAvg(p) ?? 0) >= t.value;
    const swing = met ? 8 : t.ambitious ? -8 : -4;
    p.morale = Math.max(0, Math.min(100, (p.morale ?? 60) + swing));
    if (p.clubId === save.userClubId) {
      pushNews(
        save,
        met
          ? `${p.name} met his target (${t.kind === "goals" ? `${p.goals} goals` : t.kind === "apps" ? `${p.apps} apps` : `a ${(ratingAvg(p) ?? 0).toFixed(2)} rating`}) — delighted.`
          : `${p.name} fell short of his target — he's not happy about it.`
      );
    }
    p.target = undefined;
  }
}

// --- positional retraining ----------------------------------------------------------------

export const altPositions = (p: Player): Position[] => p.altPos ?? [];

export function retrainOptions(p: Player): Position[] {
  if (p.pos === "GK" || p.age > 32) return [];
  const known = [p.pos, ...altPositions(p)];
  const near: Position[] = p.pos === "DF" ? ["MF"] : p.pos === "MF" ? ["DF", "FW"] : ["MF"];
  return near.filter((x) => !known.includes(x));
}

export const canRetrain = (p: Player): boolean =>
  !p.retrain && p.pos !== "GK" && p.age <= 32 && altPositions(p).length < 2;

export function startRetrain(
  input: SaveGame,
  playerId: string,
  pos: Position
): { save: SaveGame; resp: { ok: boolean; message: string } } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) return { save: input, resp: { ok: false, message: "He's not your player." } };
  if (!canRetrain(p)) return { save: input, resp: { ok: false, message: "He can't take on a new position right now." } };
  if (!retrainOptions(p).includes(pos)) return { save: input, resp: { ok: false, message: "Not a position he can learn from here." } };
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  pp.retrain = { pos, progress: 0 };
  pushNews(save, `${pp.name} starts learning to play ${pos}.`);
  return { save, resp: { ok: true, message: `${pp.name} starts training as a ${pos}.` } };
}

export function cancelRetrain(input: SaveGame, playerId: string): SaveGame {
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId);
  if (pp) pp.retrain = undefined;
  return save;
}

/** Progress: minutes on the pitch teach the position; youth learns fastest. */
export function retrainTick(save: SaveGame, minutesById: Record<string, number>): void {
  for (const p of save.players) {
    if (!p.retrain) continue;
    const mins = minutesById[p.id] ?? 0;
    const ageF = p.age <= 21 ? 1.5 : p.age <= 24 ? 1.2 : p.age <= 27 ? 1 : p.age <= 31 ? 0.7 : 0.4;
    const gain = (3 + mins / 12) * ageF * (p.condition >= 70 ? 1 : 0.6);
    const progress = Math.min(100, p.retrain.progress + gain);
    if (progress >= 100) {
      const pos = p.retrain.pos;
      p.altPos = [...(p.altPos ?? []), pos];
      p.retrain = undefined;
      if (p.clubId === save.userClubId) pushNews(save, `${p.name} is now comfortable at ${pos}.`);
    } else {
      p.retrain = { ...p.retrain, progress };
    }
  }
}

// --- learning a move (PPM) ------------------------------------------------------------------

/** What he could learn: traits he lacks, with the attribute bar the coach insists on. */
export function moveOptions(p: Player): TraitId[] {
  if (p.age > 31 || p.traits.length >= 2) return [];
  const all: MoveReq[] = [
    { trait: "shoots_on_sight", attr: "shooting", min: 62, groups: ["MF", "FW"] },
    { trait: "killer_balls", attr: "passing", min: 62, groups: ["DF", "MF"] },
    { trait: "presses_hard", attr: "physical", min: 58, groups: ["MF", "FW"] },
    { trait: "marks_tightly", attr: "defending", min: 60, groups: ["DF", "MF"] },
    { trait: "dives_in", attr: "defending", min: 58, groups: ["DF", "MF"] },
    { trait: "stays_back", attr: "defending", min: 55, groups: ["DF", "MF"] },
    { trait: "arrives_in_box", attr: "shooting", min: 58, groups: ["MF", "FW"] },
    { trait: "runs_with_ball", attr: "pace", min: 62, groups: ["MF", "FW"] },
    { trait: "dead_ball", attr: "passing", min: 60, groups: ["DF", "MF", "FW"] },
    { trait: "leader", attr: "physical", min: 60, groups: ["GK", "DF", "MF", "FW"] }
  ];
  return all
    .filter((e) => !hasTrait(p, e.trait) && p.attrs[e.attr] >= e.min && e.groups.includes(p.pos))
    .map((e) => e.trait);
}

export interface MoveReq {
  trait: TraitId;
  attr: keyof Player["attrs"];
  min: number;
  groups: Position[];
}

const MOVE_REQS: MoveReq[] = [
  { trait: "shoots_on_sight", attr: "shooting", min: 62, groups: ["MF", "FW"] },
  { trait: "killer_balls", attr: "passing", min: 62, groups: ["DF", "MF"] },
  { trait: "presses_hard", attr: "physical", min: 58, groups: ["MF", "FW"] },
  { trait: "marks_tightly", attr: "defending", min: 60, groups: ["DF", "MF"] },
  { trait: "dives_in", attr: "defending", min: 58, groups: ["DF", "MF"] },
  { trait: "stays_back", attr: "defending", min: 55, groups: ["DF", "MF"] },
  { trait: "arrives_in_box", attr: "shooting", min: 58, groups: ["MF", "FW"] },
  { trait: "runs_with_ball", attr: "pace", min: 62, groups: ["MF", "FW"] },
  { trait: "dead_ball", attr: "passing", min: 60, groups: ["DF", "MF", "FW"] },
  { trait: "leader", attr: "physical", min: 60, groups: ["GK", "DF", "MF", "FW"] }
];

export const moveReqFor = (trait: TraitId): MoveReq =>
  MOVE_REQS.find((m) => m.trait === trait) ?? { trait, attr: "passing", min: 60, groups: ["DF", "MF", "FW"] };

export function startMove(
  input: SaveGame,
  playerId: string,
  trait: TraitId
): { save: SaveGame; resp: { ok: boolean; message: string } } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) return { save: input, resp: { ok: false, message: "He's not your player." } };
  if (p.moveProgress) return { save: input, resp: { ok: false, message: "He's already working on something." } };
  if (!moveOptions(p).includes(trait)) {
    return { save: input, resp: { ok: false, message: "He can't pick that up at this stage of his career." } };
  }
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  pp.moveProgress = { trait, progress: 0 };
  return { save, resp: { ok: true, message: `${pp.name} starts working on his new trick.` } };
}

export function cancelMove(input: SaveGame, playerId: string): SaveGame {
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId);
  if (pp) pp.moveProgress = undefined;
  return save;
}

/** Minutes on the grass, plus the right training unit, teach the move. */
export function moveTick(save: SaveGame, minutesById: Record<string, number>): void {
  const unit = save.training?.unit ?? "balanced";
  const unitMatches: Record<string, TraitId[]> = {
    attacking: ["shoots_on_sight", "arrives_in_box", "runs_with_ball"],
    defending: ["marks_tightly", "dives_in", "stays_back"],
    passing: ["killer_balls"],
    setpieces: ["dead_ball"],
    physical: ["presses_hard", "leader"]
  };
  const bonus = unitMatches[unit] ?? [];
  for (const p of save.players) {
    const mv = p.moveProgress;
    if (!mv) continue;
    const mins = minutesById[p.id] ?? 0;
    const aligned = bonus.includes(mv.trait) ? 1.4 : 1;
    const ageF = p.age <= 21 ? 1.4 : p.age <= 26 ? 1.1 : 0.7;
    const gain = (2.5 + mins / 14) * aligned * ageF;
    const progress = Math.min(100, mv.progress + gain);
    if (progress >= 100) {
      p.traits = [...p.traits, mv.trait];
      p.moveProgress = undefined;
      if (p.clubId === save.userClubId) pushNews(save, `${p.name} has added a new move to his game.`);
    } else {
      p.moveProgress = { ...mv, progress };
    }
  }
}

// --- discipline & fines ---------------------------------------------------------------------

export interface DisciplinaryCase {
  playerId: string;
  name: string;
  reason: string;
  kind: "red" | "booked";
}

/** This round's offenders: a red card is a decision, a booking is a word. */
export function disciplinaryCases(save: SaveGame): DisciplinaryCase[] {
  const r = save.lastUserMatch;
  if (!r) return [];
  const out: DisciplinaryCase[] = [];
  for (const u of r.updates) {
    const p = save.players.find((x) => x.id === u.playerId);
    if (!p || p.clubId !== save.userClubId) continue;
    if (u.red) out.push({ playerId: p.id, name: p.name, reason: "sent off", kind: "red" });
    else if (u.yellow > 0 && (p.yellows ?? 0) >= 4) {
      out.push({ playerId: p.id, name: p.name, reason: `${p.yellows} bookings this season`, kind: "booked" });
    }
  }
  return out;
}

export function applyDiscipline(
  input: SaveGame,
  playerId: string,
  kind: "fine" | "warn" | "none"
): { save: SaveGame; resp: { ok: boolean; message: string } } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) return { save: input, resp: { ok: false, message: "He's not your player." } };
  const save = structuredClone(input);
  const pp = save.players.find((x) => x.id === playerId)!;
  const shown = save.discipline ?? [];
  let message = "";
  if (kind === "fine") {
    const amount = Math.round((pp.contract.wage ?? 0) * 2);
    save.finances[save.userClubId].transfer += amount;
    pp.morale = Math.max(0, (pp.morale ?? 60) - 6);
    if (save.media) save.media.respect = Math.min(100, save.media.respect + 1);
    message = `Fined two weeks' wages (${amount >= 1000 ? `£${Math.round(amount / 1000)}k` : `£${amount}`}) — the dressing room noticed.`;
  } else if (kind === "warn") {
    pp.morale = Math.max(0, (pp.morale ?? 60) - 2);
    message = "Warned him privately. No further action.";
  } else {
    pp.morale = Math.min(100, (pp.morale ?? 60) + 1);
    if (save.media) save.media.respect = Math.max(0, save.media.respect - 1);
    message = "You let it go — the player appreciates it.";
  }
  save.discipline = [{ season: save.season, round: save.round, playerId, kind }, ...shown].slice(0, 12);
  return { save, resp: { ok: true, message } };
}

// --- the armband ------------------------------------------------------------------------------

export function setArmband(
  input: SaveGame,
  playerId: string,
  role: "captain" | "vice" | "none"
): { save: SaveGame; resp: { ok: boolean; message: string } } {
  const p = input.players.find((x) => x.id === playerId);
  if (!p || p.clubId !== input.userClubId) return { save: input, resp: { ok: false, message: "He's not your player." } };
  const save = structuredClone(input);
  if (role === "captain") {
    if (save.captain) {
      const old = save.players.find((x) => x.id === save.captain);
      if (old) old.morale = Math.max(0, (old.morale ?? 60) - 5);
    }
    save.captain = playerId;
    if (save.vice === playerId) save.vice = undefined;
  } else if (role === "vice") {
    save.vice = playerId;
    if (save.captain === playerId) save.captain = undefined;
  } else {
    if (save.captain === playerId) save.captain = undefined;
    if (save.vice === playerId) save.vice = undefined;
    const pp = save.players.find((x) => x.id === playerId)!;
    pp.morale = Math.max(0, (pp.morale ?? 60) - 4);
  }
  const label = role === "captain" ? "captain" : role === "vice" ? "vice-captain" : "stripped of the armband";
  if (role !== "none" && save.players.find((x) => x.id === playerId)) {
    const pp = save.players.find((x) => x.id === playerId)!;
    pp.morale = Math.min(100, (pp.morale ?? 60) + 4);
  }
  pushNews(save, `${p.name} is your new ${label}.`);
  return { save, resp: { ok: true, message: `${p.name} is your ${label}.` } };
}

export const captainId = (save: SaveGame): string | undefined => save.captain;
export const viceId = (save: SaveGame): string | undefined => save.vice;

/** The armband holder on the pitch, or his deputy. */
export function armbandIn(save: SaveGame, playerIds: string[]): string | undefined {
  if (save.captain && playerIds.includes(save.captain)) return save.captain;
  if (save.vice && playerIds.includes(save.vice)) return save.vice;
  return undefined;
}

