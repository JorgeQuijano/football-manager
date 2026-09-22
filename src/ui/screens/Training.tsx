import { useState } from "react";
import type { AttrKey, Player } from "@/engine";
import {
  ATTR_KEYS,
  ATTR_SHORT,
  INTENSITIES,
  UNITS,
  overallFor,
  squadOf
} from "@/engine";
import type { Intensity, TrainingUnit } from "@/engine";
import { PlayerDetailSheet } from "@/ui/sheets";
import { useGame } from "@/state/store";

const deltas = (p: Player): Array<{ attr: AttrKey; v: number }> =>
  ATTR_KEYS.map((k) => ({ attr: k, v: (p.devSeason ?? {})[k] ?? 0 })).filter((d) => d.v !== 0);

const netDelta = (p: Player): number => deltas(p).reduce((s, d) => s + d.v, 0);

function DeltaChips({ p }: { p: Player }) {
  const ds = deltas(p);
  if (!ds.length) return <span className="text-[11px] text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {ds.map((d) => (
        <span
          key={d.attr}
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tnum ${
            d.v > 0 ? "bg-primary/15 text-primary" : "bg-[#FF6B6B]/15 text-[#FF6B6B]"
          }`}
        >
          {d.v > 0 ? "+" : ""}
          {d.v} {ATTR_SHORT[d.attr]}
        </span>
      ))}
    </span>
  );
}

export function Training() {
  const game = useGame((s) => s.game)!;
  const setTraining = useGame((s) => s.setTraining);
  const [detailId, setDetailId] = useState<string | null>(null);

  const plan = game.training;
  const unit = UNITS[plan.unit];
  const squad = squadOf(game.players, game.userClubId);
  const movers = squad.slice().sort((a, b) => netDelta(b) - netDelta(a));
  const changed = movers.filter((p) => netDelta(p) !== 0);
  const roomiest = squad
    .filter((p) => p.peak > overallFor(p))
    .sort((a, b) => (b.peak - overallFor(b)) - (a.peak - overallFor(a)));

  return (
    <div className="space-y-5" data-testid="training-screen">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">Training</h1>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
          Season {game.season} · R{game.round}
        </span>
      </header>

      <section className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground" htmlFor="team-focus">
            Team focus
          </label>
          <select
            id="team-focus"
            data-testid="team-focus"
            value={plan.unit}
            onChange={(e) => setTraining({ unit: e.target.value as TrainingUnit })}
            className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold"
          >
            {(Object.keys(UNITS) as TrainingUnit[]).map((u) => (
              <option key={u} value={u}>
                {UNITS[u].label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-muted-foreground" data-testid="focus-blurb">
            {unit.blurb}
          </p>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Intensity
          </span>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {(Object.keys(INTENSITIES) as Intensity[]).map((i) => {
              const active = plan.intensity === i;
              return (
                <button
                  key={i}
                  data-testid={`intensity-${i}`}
                  onClick={() => setTraining({ intensity: i })}
                  className={`h-11 rounded-lg text-sm font-bold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground"
                  }`}
                >
                  {INTENSITIES[i].label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{INTENSITIES[plan.intensity].blurb}</p>
        </div>
      </section>

      {game.devNews.length > 0 && (
        <section className="space-y-2" data-testid="dev-news">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">News</h2>
          <ul className="space-y-1.5 rounded-xl border border-border bg-card p-3 text-[12px]">
            {game.devNews.slice(0, 6).map((n, i) => (
              <li key={i} className="text-muted-foreground">
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          This season's development
        </h2>
        {changed.length === 0 && (
          <p className="rounded-xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
            No movement yet — play rounds and your squad will grow (and age). Young players who play
            regularly develop fastest; veterans lose pace and stamina.
          </p>
        )}
        {changed.map((p) => (
          <button
            key={p.id}
            data-testid={`dev-${p.id}`}
            onClick={() => setDetailId(p.id)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">
                {p.name} <span className="text-[11px] font-semibold text-muted-foreground">{p.age}y</span>
              </span>
              <span className="block text-[11px] text-muted-foreground">
                OVR {overallFor(p)} · POT {p.peak}
                {p.focus ? ` · focus ${ATTR_SHORT[p.focus]}` : ""}
              </span>
            </span>
            <DeltaChips p={p} />
          </button>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Most room to grow
        </h2>
        {roomiest.slice(0, 5).map((p) => (
          <button
            key={p.id}
            data-testid={`room-${p.id}`}
            onClick={() => setDetailId(p.id)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">
                {p.name} <span className="text-[11px] font-semibold text-muted-foreground">{p.age}y</span>
              </span>
              <span className="block text-[11px] text-muted-foreground">
                OVR {overallFor(p)} · POT {p.peak}
              </span>
            </span>
            <span className="shrink-0 rounded bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary tnum">
              +{p.peak - overallFor(p)} room
            </span>
          </button>
        ))}
      </section>

      <PlayerDetailSheet playerId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
