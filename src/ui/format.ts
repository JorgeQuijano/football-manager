import type { Player, Position } from "@/engine";
import { suitability } from "@/engine";

export const posOrder: Position[] = ["GK", "DF", "MF", "FW"];

export const posChip: Record<Position, string> = {
  GK: "bg-[#FFB020]/15 text-[#FFB020]",
  DF: "bg-[#4DABF7]/15 text-[#4DABF7]",
  MF: "bg-[#2ED573]/15 text-[#2ED573]",
  FW: "bg-[#FF8787]/15 text-[#FF8787]"
};

export function shortName(name: string): string {
  const parts = name.split(" ");
  return parts[parts.length - 1];
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

export function formColor(result: "W" | "D" | "L"): string {
  if (result === "W") return "bg-[#2ED573] text-[#06301B]";
  if (result === "L") return "bg-[#FF6157] text-[#330906]";
  return "bg-[#48545F] text-[#CBD5DC]";
}

export function resultChip(homeGoals: number, awayGoals: number) {
  return `${homeGoals}–${awayGoals}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Condition traffic light: fresh / fading / tired. */
export function condColor(condition: number): string {
  if (condition >= 80) return "#2ED573";
  if (condition >= 60) return "#FFB020";
  return "#FF6157";
}

/** How well a player fits a slot: natural, workable (amber), or poor (red). */
export function fitLevel(p: Player, slot: Position): "nat" | "ok" | "poor" {
  const s = suitability(p, slot);
  return s >= 1 ? "nat" : s >= 0.9 ? "ok" : "poor";
}
