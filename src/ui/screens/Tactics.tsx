import { useState } from "react";
import type { FormationId, Mentality, Position } from "@/engine";
import {
  FORMATIONS,
  FORMATION_IDS,
  overallFor,
  squadOf,
  validateLineup
} from "@/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGame } from "@/state/store";
import { shortName } from "@/ui/format";
import { PlayerPickerSheet } from "@/ui/sheets";

const MENTALITIES: Array<{ id: Mentality; label: string }> = [
  { id: "def", label: "Defensive" },
  { id: "bal", label: "Balanced" },
  { id: "att", label: "Attacking" }
];

export function Tactics() {
  const game = useGame((s) => s.game)!;
  const setFormation = useGame((s) => s.setFormation);
  const setMentality = useGame((s) => s.setMentality);
  const autoPick = useGame((s) => s.autoPick);
  const [picker, setPicker] = useState<
    { kind: "xi" | "bench"; index: number; slotPos: Position } | null
  >(null);

  const squad = squadOf(game.players, game.userClubId);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const lineup = game.lineup;
  const slots = FORMATIONS[lineup.formation];
  const problems = validateLineup(squad, lineup);
  const posRows: Position[] = ["FW", "MF", "DF", "GK"];

  const slotButton = (kind: "xi" | "bench", i: number, pos: Position) => {
    const id = (kind === "xi" ? lineup.starters : lineup.bench)[i] ?? null;
    const p = id ? byId.get(id) : undefined;
    const available = !p || (p.injuredWeeks === 0 && p.suspension === 0);
    return (
      <button
        key={`${kind}-${i}`}
        data-testid={`slot-${kind}-${i}`}
        onClick={() => setPicker({ kind, index: i, slotPos: pos })}
        className={`flex ${
          kind === "xi" ? "h-14 w-16" : "h-12 flex-1"
        } flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-center ${
          p
            ? "border-border bg-secondary/60"
            : "border-dashed border-border bg-transparent"
        } ${!available ? "opacity-50" : ""}`}
      >
        <span className="max-w-full truncate text-[11px] font-bold leading-tight">
          {p ? shortName(p.name) : pos}
        </span>
        <span className="text-[10px] text-muted-foreground tnum">
          {p ? overallFor(p) : "—"}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Tactics</h1>
        <p className="text-xs text-muted-foreground">
          Tap a slot to change players — auto-picked if you leave it
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <div>
          <label className="eyebrow" htmlFor="formation">
            Formation
          </label>
          <select
            id="formation"
            data-testid="formation"
            value={lineup.formation}
            onChange={(e) => setFormation(e.target.value as FormationId)}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none"
          >
            {FORMATION_IDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" className="h-10" onClick={autoPick} data-testid="auto-pick">
          Auto pick
        </Button>
      </div>

      <div className="grid grid-cols-3 rounded-xl border border-border p-1 text-xs font-semibold">
        {MENTALITIES.map((m) => (
          <button
            key={m.id}
            data-testid={`mentality-${m.id}`}
            onClick={() => setMentality(m.id)}
            className={`rounded-lg py-3 transition-colors ${
              lineup.mentality === m.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          {posRows.map((pos) => {
            const idxs = slots
              .map((s, i) => (s === pos ? i : -1))
              .filter((i) => i >= 0);
            if (!idxs.length) return null;
            return (
              <div key={pos} className="flex flex-wrap justify-center gap-1.5">
                {idxs.map((i) => slotButton("xi", i, pos))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div>
        <div className="eyebrow mb-1.5">Bench</div>
        <div className="grid grid-cols-7 gap-1.5">
          {lineup.bench.map((_, i) => slotButton("bench", i, "MF"))}
        </div>
      </div>

      {problems.length > 0 && (
        <p className="rounded-xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-3 py-2 text-xs text-[#FFB020]">
          {problems[0]} — it will be auto-fixed at kick-off if you press Continue.
        </p>
      )}

      <PlayerPickerSheet picker={picker} onClose={() => setPicker(null)} />
    </div>
  );
}
