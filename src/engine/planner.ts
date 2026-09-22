import type { Player, Position, RoleId, SaveGame } from "./types";
import { overallFor, slotScoreFor, squadOf } from "./ratings";
import { defaultRoleFor, ROLE_DEFS } from "./roles";
import { builtinFormation, resolveFormation } from "./formations";
import { wageBill } from "./transfers";

/** FM23-style career stages (the Experience Matrix). */
export type CareerStage = "breakthrough" | "emerging" | "peak" | "experienced" | "veteran";

export const CAREER_STAGES: Record<CareerStage, { label: string; blurb: string; tint: string }> = {
  breakthrough: { label: "Breakthrough", blurb: "Teenagers pushing for minutes", tint: "#7C5CFF" },
  emerging: { label: "Emerging", blurb: "Growing into first-team players", tint: "#2ED573" },
  peak: { label: "Peak", blurb: "In their prime", tint: "#4EA8FF" },
  experienced: { label: "Experienced", blurb: "Thirty-somethings holding the line", tint: "#FFB020" },
  veteran: { label: "Veteran", blurb: "Final seasons — retirement at 38", tint: "#FF6B6B" }
};

export const STAGE_ORDER: CareerStage[] = [
  "breakthrough",
  "emerging",
  "peak",
  "experienced",
  "veteran"
];

export function careerStage(p: Player): CareerStage {
  const room = p.peak - overallFor(p);
  if (p.age >= 34) return "veteran";
  if (p.age >= 30) return "experienced";
  if (p.age <= 20) return "breakthrough";
  if (p.age <= 23 || room >= 6) return "emerging";
  return "peak";
}

export type ContractState = "secure" | "lastyear" | "expiring" | "retiring";

export function contractState(p: Player, save: SaveGame): ContractState {
  if (p.age >= 37) return "retiring";
  if (p.contract.until <= save.season) return "expiring";
  if (p.contract.until === save.season + 1) return "lastyear";
  return "secure";
}

/** Minimum viable numbers per line (a "gap" is fewer than this). */
export const DEPTH_MIN: Record<Position, number> = { GK: 2, DF: 5, MF: 5, FW: 3 };
export type DepthLevel = "gap" | "thin" | "ok" | "deep";

export function depthLevel(pos: Position, n: number): DepthLevel {
  const min = DEPTH_MIN[pos];
  if (n < min) return "gap";
  if (n < Math.ceil(min * 1.4)) return "thin";
  if (n <= min * 2) return "ok";
  return "deep";
}

export interface PlanPlayer {
  player: Player;
  rank: number;
  score: number;
  stage: CareerStage;
  status: ContractState;
  /** true when this player will not be at the club next season */
  leaving: boolean;
}

export interface PlanGroup {
  pos: Position;
  slots: Array<{ pos: Position; role: RoleId; roleLabel: string }>;
  players: PlanPlayer[];
  depth: DepthLevel;
  kept: number;
  expiring: number;
}

export interface SquadPlan {
  groups: PlanGroup[];
  stages: Array<{ stage: CareerStage; count: number }>;
  total: number;
  kept: number;
  avgAge: number;
  expiring: number;
  wageBill: number;
  wageBillKept: number;
}

const LINE_ORDER: Position[] = ["GK", "DF", "MF", "FW"];

/**
 * Depth chart + experience matrix for the user's squad.
 * `view: "next"` projects the squad after this season's departures and birthdays.
 */
export function squadPlan(save: SaveGame, view: "now" | "next" = "now"): SquadPlan {
  const squad = squadOf(save.players, save.userClubId);
  const def =
    resolveFormation(save.lineup.formation, save.customFormations) ?? builtinFormation("4-3-3");
  const slotMeta = def.slots.map((s, i) => ({
    pos: s.pos,
    role: save.lineup.roles?.[i] ?? defaultRoleFor(s.pos)
  }));

  const ageOf = (p: Player) => (view === "next" ? Math.min(40, p.age + 1) : p.age);
  const aging = (p: Player): Player => (view === "next" ? { ...p, age: ageOf(p) } : p);

  const groups: PlanGroup[] = LINE_ORDER.map((pos) => {
    const slots = slotMeta
      .filter((s) => s.pos === pos)
      .map((s) => ({ pos: s.pos, role: s.role, roleLabel: ROLE_DEFS[s.role]?.label ?? s.role }));
    const ranked = squad
      .filter((p) => p.pos === pos)
      .map((p) => {
        const score = Math.max(...slots.map((s) => slotScoreFor(p, s.pos, s.role)), slotScoreFor(p, pos, defaultRoleFor(pos)));
        return { p, score };
      })
      .sort((a, b) => b.score - a.score || overallFor(b.p) - overallFor(a.p) || (a.p.id < b.p.id ? -1 : 1));
    const players: PlanPlayer[] = ranked.map(({ p, score }, i) => {
      const status = contractState(p, save);
      const leaving = status === "expiring" || status === "retiring";
      return {
        player: aging(p),
        rank: i + 1,
        score: Math.round(score * 10) / 10,
        stage: careerStage(aging(p)),
        status,
        leaving
      };
    });
    const kept = players.filter((x) => !x.leaving).length;
    return {
      pos,
      slots,
      players,
      depth: depthLevel(pos, view === "next" ? kept : players.length),
      kept,
      expiring: players.filter((x) => x.leaving).length
    };
  });

  const stages = STAGE_ORDER.map((stage) => ({
    stage,
    count: squad.filter((p) => careerStage(aging(p)) === stage).length
  }));

  const leavers = new Set(groups.flatMap((g) => g.players.filter((x) => x.leaving).map((x) => x.player.id)));
  const keptPlayers = squad.filter((p) => !leavers.has(p.id));
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return {
    groups,
    stages,
    total: squad.length,
    kept: keptPlayers.length,
    avgAge: squad.length ? Math.round((sum(squad.map(ageOf)) / squad.length) * 10) / 10 : 0,
    expiring: leavers.size,
    wageBill: wageBill(save, save.userClubId),
    wageBillKept: sum(keptPlayers.map((p) => p.contract.wage))
  };
}
