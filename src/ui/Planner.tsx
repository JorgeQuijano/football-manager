import { useMemo, useState } from "react";
import {
  CAREER_STAGES,
  overallFor,
  to20ovr,
  squadPlan,
  STAGE_ORDER,
  type ContractState,
  type DepthLevel
} from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";
import { posChip } from "@/ui/format";

const DEPTH_BADGE: Record<DepthLevel, { label: string; cls: string }> = {
  gap: { label: "GAP", cls: "bg-[var(--danger-soft)] text-[var(--danger)]" },
  thin: { label: "THIN", cls: "bg-[var(--warn-soft)] text-[var(--warn)]" },
  ok: { label: "OK", cls: "bg-muted text-muted-foreground" },
  deep: { label: "DEEP", cls: "bg-primary/15 text-primary" }
};

const STATUS_CHIP: Partial<Record<ContractState, { label: string; cls: string }>> = {
  expiring: { label: "Expiring", cls: "bg-[var(--danger-soft)] text-[var(--danger)]" },
  lastyear: { label: "Last year", cls: "bg-[var(--warn-soft)] text-[var(--warn)]" },
  retiring: { label: "Retires", cls: "bg-[#7C5CFF]/15 text-[#7C5CFF]" }
};

const moneyK = (n: number) => `£${Math.round(n / 1000)}k`;

export function PlannerView({ onOpenPlayer }: { onOpenPlayer: (id: string) => void }) {
  const game = useGame((s) => s.game)!;
  const setScreen = useGame((s) => s.setScreen);
  const [view, setView] = useState<"now" | "next">("now");
  const plan = useMemo(() => squadPlan(game, view), [game, view]);
  const maxStage = Math.max(1, ...plan.stages.map((s) => s.count));

  return (
    <div className="space-y-4" data-testid="planner-view">
      <div className="grid grid-cols-2 gap-1.5">
        {(["now", "next"] as const).map((v) => (
          <button
            key={v}
            data-testid={`planner-toggle-${v}`}
            onClick={() => setView(v)}
            className={`h-11 rounded-lg text-sm font-bold transition-colors ${
              view === v
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {v === "now" ? "This season" : "Next season"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-card p-3 text-center">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {view === "next" ? "Kept" : "Players"}
          </div>
          <div className="text-lg font-extrabold tnum" data-testid="plan-stat-players">
            {view === "next" ? plan.kept : plan.total}
            <span className="text-[11px] font-semibold text-muted-foreground">/{plan.total}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Avg age
          </div>
          <div className="text-lg font-extrabold tnum">{plan.avgAge}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Wages /wk
          </div>
          <div className="text-lg font-extrabold tnum" data-testid="plan-stat-wage">
            {moneyK(view === "next" ? plan.wageBillKept : plan.wageBill)}
          </div>
        </div>
      </div>

      {plan.expiring > 0 && (
        <p className="text-[11px] font-semibold text-[var(--danger)]" data-testid="plan-expiring-note">
          {plan.expiring} player{plan.expiring === 1 ? "" : "s"} out of contract — renew in the
          Transfers tab or they leave at season end.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Experience matrix
        </h2>
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          {STAGE_ORDER.map((stage) => {
            const row = plan.stages.find((s) => s.stage === stage);
            const n = row?.count ?? 0;
            const def = CAREER_STAGES[stage];
            return (
              <div key={stage} className="flex items-center gap-2" data-testid={`stage-${stage}`}>
                <span className="w-[86px] shrink-0 text-[11px] font-bold" style={{ color: def.tint }}>
                  {def.label}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(n / maxStage) * 100}%`, background: def.tint }}
                  />
                </span>
                <span className="w-5 shrink-0 text-right text-[11px] font-extrabold tnum">{n}</span>
              </div>
            );
          })}
          <p className="pt-1 text-[10px] text-muted-foreground">
            Age brackets, tilted by room to grow — a 22-year-old has a career ahead of him, a 28-year-old
            at his ceiling is in his prime.
          </p>
        </div>
      </section>

      {plan.groups.map((g) => {
        const badge = DEPTH_BADGE[g.depth];
        const short = g.depth === "gap" || g.depth === "thin";
        return (
          <section key={g.pos} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${posChip[g.pos]}`}>
                  {g.pos}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {g.slots.length} slot{g.slots.length === 1 ? "" : "s"} ·{" "}
                  {[...new Set(g.slots.map((s) => s.roleLabel))].join(" / ")}
                </span>
              </div>
              <span
                data-testid={`depth-${g.pos}`}
                className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${badge.cls}`}
              >
                {badge.label}
                {view === "next" && ` · ${g.kept}`}
              </span>
            </div>
            <div className="space-y-1">
              {g.players.map((row) => {
                const p = row.player;
                const stage = CAREER_STAGES[row.stage];
                const st = STATUS_CHIP[row.status];
                return (
                  <button
                    key={p.id}
                    data-testid={`plan-row-${p.id}`}
                    onClick={() => onOpenPlayer(p.id)}
                    className="flex min-h-11 w-full items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left"
                  >
                    <span className="w-4 shrink-0 pt-0.5 text-center text-[10px] font-extrabold text-muted-foreground tnum">
                      {row.rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`min-w-0 truncate text-[13px] font-semibold ${
                            row.leaving && view === "next"
                              ? "text-muted-foreground line-through"
                              : ""
                          }`}
                        >
                          {p.name}{" "}
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {p.age}y
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] font-bold tnum">
                          {to20ovr(overallFor(p))}
                          <span className="font-semibold text-muted-foreground">/{to20ovr(p.peak)}</span>
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {st && (
                          <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${st.cls}`}>
                            {st.label}
                          </span>
                        )}
                        <span
                          className="rounded px-1 py-0.5 text-[9px] font-bold"
                          style={{ background: `${stage.tint}22`, color: stage.tint }}
                        >
                          {stage.label}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {short && (
              <Button
                variant="outline"
                size="sm"
                className="h-11 w-full text-[11px]"
                data-testid={`scout-${g.pos}`}
                onClick={() => setScreen("transfers")}
              >
                {g.depth === "gap" ? "No cover" : "Light on numbers"} — scout a {g.pos} in the market
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}
