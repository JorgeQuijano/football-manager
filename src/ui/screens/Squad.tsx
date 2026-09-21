import { useState } from "react";
import { overallFor, squadOf } from "@/engine";
import { useGame } from "@/state/store";
import { posChip, posOrder } from "@/ui/format";
import { PlayerDetailSheet } from "@/ui/sheets";

export function Squad() {
  const game = useGame((s) => s.game)!;
  const [detailId, setDetailId] = useState<string | null>(null);

  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const squad = [...squadOf(game.players, game.userClubId)].sort(
    (a, b) =>
      posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos) || overallFor(b) - overallFor(a)
  );

  return (
    <div>
      <h1 className="text-lg font-bold">Squad</h1>
      <p className="text-xs text-muted-foreground">
        {club.name} · {squad.length} players
      </p>

      <div className="mt-3 space-y-1.5">
        {squad.map((p) => (
          <button
            key={p.id}
            data-testid={`squad-${p.id}`}
            onClick={() => setDetailId(p.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left"
          >
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}>
              {p.pos}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.name}</span>
              <span className="text-[11px] text-muted-foreground tnum">
                age {p.age} · {p.goals} goals
                {p.injuredWeeks > 0 && (
                  <span className="text-[#FFB020]"> · injured ({p.injuredWeeks})</span>
                )}
                {p.suspension > 0 && <span className="text-[#FF6157]"> · suspended</span>}
              </span>
            </span>
            <span className="flex w-16 shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-extrabold tnum">{overallFor(p)}</span>
              <span className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${p.condition}%` }}
                />
              </span>
            </span>
          </button>
        ))}
      </div>

      <PlayerDetailSheet playerId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
