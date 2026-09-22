import { useState } from "react";
import {
  calendarMonth,
  fmtLong,
  fmtShort,
  roundDate,
  seasonMonths,
  seasonRoundsOf,
  upcoming,
  type CalDay, isInternationalRound } from "@/engine";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useGame } from "@/state/store";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const resultTint: Record<string, string> = { W: "#2ED573", D: "#8B98A5", L: "#FF6B6B" };

/** A month grid of the season: match days, training days, windows. */
export function CalendarView() {
  const game = useGame((s) => s.game)!;
  const months = seasonMonths(game);
  const roundMonth = roundDate(game.season, Math.min(game.round, (game.clubs.length - 1) * 2));
  const startIdx = Math.max(
    0,
    months.findIndex((m) => m.y === roundMonth.y && m.m === roundMonth.m)
  );
  const [idx, setIdx] = useState(startIdx);
  const [picked, setPicked] = useState<CalDay | null>(null);

  const cur = months[Math.min(idx, months.length - 1)] ?? months[0];
  const cal = calendarMonth(game, cur.y, cur.m);
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;
  const matchDays = cal.days.filter((d) => d.match);
  const eventDays = cal.days.filter((d) => d.events.length);

  return (
    <div className="space-y-3" data-testid="calendar-view">
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          data-testid="cal-prev"
          className="min-h-11 min-w-11"
          disabled={idx <= 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
        >
          ‹
        </Button>
        <div className="text-center" data-testid="cal-month">
          <div className="text-sm font-bold">{cal.label}</div>
          <div className="text-[10px] text-muted-foreground">
            Season {game.season} · Round {Math.min(game.round, (game.clubs.length - 1) * 2)}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          data-testid="cal-next"
          className="min-h-11 min-w-11"
          disabled={idx >= months.length - 1}
          onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))}
        >
          ›
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {DOW.map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>

      <div className="space-y-1" data-testid="cal-grid">
        {cal.weeks.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1">
            {row.map((day, ci) => {
              if (!day) return <div key={ci} className="h-11" />;
              const m = day.match;
              const tint = m?.result ? resultTint[m.result] : undefined;
              return (
                <button
                  key={ci}
                  data-testid={`cal-day-${day.date.d}`}
                  onClick={() => setPicked(day)}
                  className={`relative flex h-11 flex-col items-center justify-center rounded-lg border text-[11px] ${
                    day.currentWeek ? "border-primary/50 bg-primary/10" : "border-border"
                  } ${!day.match && !day.training ? "opacity-60" : ""}`}
                >
                  <span className={m ? "font-bold" : ""} style={tint && m?.played ? { color: tint } : undefined}>
                    {day.date.d}
                  </span>
                  {m && (
                    <span className="text-[8px] font-bold leading-none text-primary">
                      {clubOf(m.oppId).short}
                    </span>
                  )}
                  {!m && day.training && <span className="mt-0.5 size-1 rounded-full bg-muted-foreground" />}
                  {m && isInternationalRound(m.round) && (
                    <span className="text-[7px] font-bold leading-none text-[#7EC8FF]" data-testid={`cal-int-${m.round}`}>
                      INT
                    </span>
                  )}
                  {day.events.length > 0 && (
                    <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-400" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span>Green = match day (opponent shown)</span>
        <span>· dot = training</span>
        <span>· amber = window or date to note</span>
        <span>· INT = international week</span>
      </div>

      {matchDays.length > 0 && (
        <div className="rounded-2xl border border-border p-3">
          <div className="eyebrow">Matches this month</div>
          <ul className="mt-2 space-y-1.5">
            {matchDays.map((d) => (
              <li key={d.date.d} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{fmtShort(d.date)}</span>
                <span className="min-w-0 flex-1 truncate">
                  R{d.match!.round} · {d.match!.home ? "vs" : "at"} {clubOf(d.match!.oppId).name}
                </span>
                <span className="font-semibold" style={d.match!.result ? { color: resultTint[d.match!.result] } : undefined}>
                  {d.match!.played ? `${d.match!.gf}–${d.match!.ga}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {eventDays.length > 0 && (
        <div className="rounded-2xl border border-border p-3">
          <div className="eyebrow">Dates to note</div>
          <ul className="mt-2 space-y-1.5">
            {eventDays.map((d) => (
              <li key={d.date.d} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{fmtShort(d.date)}</span>
                <span className="min-w-0 flex-1 truncate text-right">{d.events.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {matchDays.length === 0 && (
        <p className="text-xs text-muted-foreground">No matches this month.</p>
      )}

      <DaySheet day={picked} onClose={() => setPicked(null)} />
    </div>
  );
}

/** The detail sheet for one calendar day. */
export function DaySheet({ day, onClose }: { day: CalDay | null; onClose: () => void }) {
  const game = useGame((s) => s.game)!;
  const setScreen = useGame((s) => s.setScreen);
  if (!day) return null;
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id)!;
  const m = day.match;
  const next = upcoming(game, 1)[0];

  return (
    <Sheet open={!!day} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{fmtLong(day.date)}</SheetTitle>
          <SheetDescription>
            Season {game.season} · Round {Math.min(game.round, seasonRoundsOf(game))}
            {day.currentWeek ? " · this week" : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-8 text-sm" data-testid="day-sheet">
          {m && (
            <div className="rounded-xl border border-border p-3">
              <div className="eyebrow">Match day · Round {m.round}</div>
              <div className="mt-1 font-semibold">
                {m.home ? `${clubOf(game.userClubId).name} vs ${clubOf(m.oppId).name}` : `${clubOf(m.oppId).name} vs ${clubOf(game.userClubId).name}`}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {m.home ? "Home" : "Away"}
                {m.played
                  ? ` · Full time ${m.gf}–${m.ga} (${m.result})`
                  : " · yet to be played"}
              </div>
            </div>
          )}
          {day.training && (
            <div className="rounded-xl border border-border p-3">
              <div className="eyebrow">Training</div>
              <div className="mt-1 font-semibold">{day.training.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                The week's focus — change it on the Training screen.
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2 min-h-11"
                onClick={() => {
                  onClose();
                  setScreen("training");
                }}
              >
                Open training
              </Button>
            </div>
          )}
          {day.events.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              {day.events.join(" · ")}
            </div>
          )}
          {!m && !day.training && day.events.length === 0 && (
            <p className="text-xs text-muted-foreground">
              A rest day — nothing scheduled.
            </p>
          )}
          {next && (
            <p className="text-[11px] text-muted-foreground">
              Next match: {fmtShort(next.date)} {next.home ? "vs" : "at"} {clubOf(next.oppId).name}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
