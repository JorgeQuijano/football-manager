import { CalendarClock, ChevronRight, FastForward, Moon, Sun, Trophy } from "lucide-react";
import {
  ACTIVITIES,
  CONGESTED_PLAN,
  CUP_DAY,
  DAY_NAMES,
  MATCH_DAY,
  type Activity,
  matchDays,
  planGrowthFactor,
  trainingDays,
  userCupTie,
  weekView
} from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";

const PLAN_ORDER: Activity[] = [
  "rest",
  "recovery",
  "off",
  "physical",
  "technical",
  "tactical",
  "setpieces",
  "prep",
  "travel"
];

/** The week: the days of decisions between matches (engine/week.ts). */
export function WeekCard() {
  const game = useGame((s) => s.game);
  const setPlanDay = useGame((s) => s.setPlanDay);
  const setWeekOverride = useGame((s) => s.setWeekOverride);
  const lastDay = useGame((s) => s.lastDay);
  if (!game) return null;

  const days = weekView(game);
  const today = Math.min(MATCH_DAY, game.day ?? MATCH_DAY);
  const plan = days.map((d) => d.activity);
  const growth = Math.round((planGrowthFactor(plan) - 1) * 100);
  const tie = userCupTie(game);
  const cupDay = tie ? CUP_DAY : -1;
  const twoMatches = matchDays(game).length > 1;
  const lightened = !!game.weekOverride && game.weekOverride.forRound === game.round;

  return (
    <section className="rounded-2xl border border-border bg-card p-3" data-testid="week-card">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          <CalendarClock size={14} /> The week
        </h2>
        <span className="text-[10px] font-semibold text-muted-foreground" data-testid="week-load">
          {trainingDays(plan)} training days · {growth >= 0 ? "+" : ""}
          {growth}% growth
        </span>
      </div>

      <ul className="mt-2 space-y-1">
        {days.map((d) => (
          <li
            key={d.day}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
              d.isToday ? "bg-primary/10 ring-1 ring-primary/40" : ""
            }`}
            data-testid={`week-${d.index}`}
          >
            <span className="w-8 shrink-0 text-[11px] font-bold text-muted-foreground">{d.day}</span>
            {d.isMatch ? (
              <span
                className="flex flex-1 items-center gap-1 text-[12px] font-bold text-primary"
                data-testid={d.index === cupDay ? "week-cup" : "week-match"}
              >
                {d.index === cupDay ? (
                  <>
                    <Trophy size={12} /> Cup tie
                  </>
                ) : (
                  "Match day"
                )}
              </span>
            ) : (
              <select
                aria-label={`${d.day} activity`}
                data-testid={`plan-${d.index}`}
                value={d.activity}
                onChange={(e) => setPlanDay(d.index, e.target.value as Activity)}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-[12px] font-semibold"
              >
                {PLAN_ORDER.map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITIES[a].label}
                  </option>
                ))}
              </select>
            )}
            {d.isToday && (
              <span className="shrink-0 text-[10px] font-extrabold uppercase text-primary" data-testid="week-today">
                today
              </span>
            )}
          </li>
        ))}
      </ul>

      {twoMatches && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[#FFB020]/50 bg-[#FFB020]/10 px-2 py-1.5" data-testid="cup-week-note">
          <span className="text-[11px] font-semibold text-[#FFB020]">
            Two matches this week — heavy legs are a rotation problem.
          </span>
          <Button
            size="sm"
            variant={lightened ? "default" : "outline"}
            className="h-8 shrink-0 px-2 text-[11px] font-bold"
            data-testid="use-congested-plan"
            onClick={() => setWeekOverride(lightened ? null : CONGESTED_PLAN)}
          >
            {lightened ? "Lighter week on" : "Lighten it"}
          </Button>
        </div>
      )}

      {lastDay && (lastDay.knocks.length > 0 || lastDay.lines.length > 0) && (
        <p className="mt-2 text-[11px] font-semibold text-[#FFB020]" data-testid="day-report">
          {lastDay.day} · {ACTIVITIES[lastDay.activity].label}: {[...lastDay.knocks, ...lastDay.lines].join(" ")}
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Load is a lever: heavy weeks buy development and cost freshness. The plan carries over — set it once.
      </p>
    </section>
  );
}

/** The Continue bar: the heartbeat of the week. */
export function WeekBar() {
  const game = useGame((s) => s.game);
  const advanceDay = useGame((s) => s.advanceDay);
  const advance = useGame((s) => s.advance);
  const setScreen = useGame((s) => s.setScreen);
  if (!game) return null;

  const today = Math.min(MATCH_DAY, game.day ?? MATCH_DAY);
  const onMatchDay = matchDays(game).includes(today);
  const cupToday = today === CUP_DAY && !!userCupTie(game);
  const days = weekView(game);
  const next = days[Math.min(MATCH_DAY, today + 1)];
  const cupNext = days[CUP_DAY]?.isMatch && today < CUP_DAY;
  const inMatch = game.round >= 0;
  const preSeason = game.round < 0;

  const label = cupToday ? "Play the cup tie" : preSeason ? "Play the friendly" : inMatch ? "Play the match" : "Play";

  return (
    <div className="fixed inset-x-0 bottom-[62px] z-30 border-t border-border bg-background/95 px-3 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-2">
        {onMatchDay ? (
          <Button
            className="h-12 flex-1 text-base font-bold"
            data-testid="continue-match"
            onClick={() => {
              setScreen("home");
              advance();
            }}
          >
            {label}
            <ChevronRight size={16} />
          </Button>
        ) : (
          <Button
            className="h-12 flex-1 text-base font-bold"
            data-testid="continue-day"
            onClick={advanceDay}
          >
            Continue → {next?.day} · {next?.label}
            <ChevronRight size={16} />
          </Button>
        )}
        {!onMatchDay && (
          <Button
            variant="outline"
            className="h-12 shrink-0 px-3"
            data-testid="skip-to-match"
            title={cupNext ? "Run every day up to the cup tie" : "Run every day up to match day"}
            onClick={() => {
              // the days still happen — skipping just means "use the plan as it stands"
              let guard = 0;
              while (
                !matchDays(useGame.getState().game ?? game).includes(
                  useGame.getState().game?.day ?? MATCH_DAY
                ) &&
                guard++ < 8
              ) {
                useGame.getState().advanceDay();
              }
            }}
          >
            <FastForward size={15} />
          </Button>
        )}
        <span className="hidden shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground sm:flex">
          {onMatchDay ? <Sun size={12} /> : <Moon size={12} />} {DAY_NAMES[today]}
        </span>
      </div>
    </div>
  );
}
