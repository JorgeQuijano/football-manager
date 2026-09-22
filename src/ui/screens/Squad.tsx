import { useState } from "react";
import type { SortMode } from "@/engine";
import {
  FORM_BANDS,
  formBandFor,
  formOf,
  moodOf,
  overallFor,
  rating1,
  sortSquad,
  SORT_MODES,
  squadOf
} from "@/engine";
import { useGame } from "@/state/store";
import { posChip } from "@/ui/format";
import { PlannerView } from "@/ui/Planner";
import { CaptainCard, DisciplineCard } from "@/ui/Individual";
import { Dynamics } from "@/ui/Dynamics";
import { PlayerDetailSheet } from "@/ui/sheets";

export function Squad() {
  const game = useGame((s) => s.game)!;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState<"squad" | "planner" | "dynamics">("squad");
  const [sortMode, setSortMode] = useState<SortMode>("position");

  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const squad = sortSquad(squadOf(game.players, game.userClubId), sortMode, overallFor);

  return (
    <div>
      <h1 className="text-lg font-bold">Squad</h1>
      <p className="text-xs text-muted-foreground">
        {club.name} · {squad.length} players
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(["squad", "planner", "dynamics"] as const).map((t) => (
          <button
            key={t}
            data-testid={`squad-tab-${t}`}
            onClick={() => setTab(t)}
            className={`h-11 rounded-lg text-sm font-bold transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {t === "squad" ? "Roster" : t === "planner" ? "Planner" : "Dynamics"}
          </button>
        ))}
      </div>

      {tab === "planner" ? (
        <div className="mt-4">
          <PlannerView onOpenPlayer={setDetailId} />
        </div>
      ) : tab === "dynamics" ? (
        <div className="mt-4">
          <Dynamics onOpenPlayer={setDetailId} />
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            <CaptainCard />
            <DisciplineCard />
          </div>
          <div className="mt-3">
            <label className="sr-only" htmlFor="squad-sort">
              Sort players
            </label>
            <select
              id="squad-sort"
              data-testid="squad-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold"
            >
              {SORT_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  Sort: {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 space-y-1.5">
            {squad.map((p) => {
              const f = formOf(p);
              const band = f !== null ? FORM_BANDS[formBandFor(f)] : null;
              return (
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
                      age {p.age} · {p.goals} goal{p.goals === 1 ? "" : "s"} · {p.assists} assist
                      {p.assists === 1 ? "" : "s"}
                      {p.injuredWeeks > 0 && (
                        <span className="text-[#FFB020]"> · injured ({p.injuredWeeks})</span>
                      )}
                      {p.suspension > 0 && <span className="text-[#FF6157]"> · suspended</span>}
                      {(p.sharpness ?? 85) < 70 && (
                        <span className="text-[#FFB020]" data-testid={`rusty-${p.id}`}> · rusty</span>
                      )}
                      {(p.jaded ?? 0) > 60 && (
                        <span className="text-[#FFB020]" data-testid={`jaded-${p.id}`}> · heavy legs</span>
                      )}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        title={moodOf(p.morale ?? 60).label}
                        style={{ background: moodOf(p.morale ?? 60).tint }}
                        data-testid={`mood-${p.id}`}
                      />
                      {band && f !== null && (
                        <span
                          className="rounded px-1 py-0.5 text-[9px] font-bold tnum"
                          style={{ background: `${band.tint}22`, color: band.tint }}
                        >
                          ★{rating1(f)}
                        </span>
                      )}
                      <span className="text-sm font-extrabold tnum">{overallFor(p)}</span>
                    </span>
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${p.condition}%` }}
                      />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <PlayerDetailSheet playerId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
