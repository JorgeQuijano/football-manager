import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";
import { initials } from "@/ui/format";
import type { MatchEvent } from "@/engine";

const eventClass: Record<string, string> = {
  goal: "text-primary font-bold",
  red: "text-destructive font-semibold",
  yellow: "text-[#FFB020] font-semibold",
  injury: "text-[#FFB020]",
  sub: "text-muted-foreground",
  save: "text-muted-foreground",
  miss: "text-muted-foreground",
  block: "text-muted-foreground",
  half: "font-bold",
  full: "font-bold",
  kickoff: "text-muted-foreground"
};

export function MatchScreen() {
  const reveal = useGame((s) => s.reveal);
  const game = useGame((s) => s.game)!;
  const finishMatch = useGame((s) => s.finishMatch);
  const [minute, setMinute] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const total = useMemo(
    () => Math.max(90, ...((reveal?.events ?? []).map((e) => e.minute))),
    [reveal]
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setMinute((m) => (m >= total ? m : Math.min(total, m + 4)));
    }, 240);
    return () => clearInterval(iv);
  }, [total]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [minute]);

  if (!reveal) return null;

  const home = game.clubs.find((c) => c.id === reveal.homeId)!;
  const away = game.clubs.find((c) => c.id === reveal.awayId)!;
  const goalsShown = (clubId: string) =>
    reveal.events.filter((e) => e.type === "goal" && e.clubId === clubId && e.minute <= minute)
      .length;
  const shownEvents = reveal.events.filter((e) => e.minute <= minute);
  const done = minute >= total;

  const userPlayers = new Set(
    game.players.filter((p) => p.clubId === game.userClubId).map((p) => p.id)
  );
  const performers = done
    ? Object.entries(reveal.ratings)
        .filter(([id]) => userPlayers.has(id))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6 pt-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <TeamBadge name={home.name} short={home.short} color={home.color} />
          <div className="text-center">
            <div className="text-3xl font-extrabold tracking-tight tnum">
              {goalsShown(home.id)}–{goalsShown(away.id)}
            </div>
            <div className="text-[11px] font-semibold text-muted-foreground tnum">
              {Math.min(minute, 90)}'
            </div>
          </div>
          <TeamBadge name={away.name} short={away.short} color={away.color} right />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-[width] duration-200"
            style={{ width: `${Math.min(100, (minute / total) * 100)}%` }}
          />
        </div>
      </div>

      <div
        ref={feedRef}
        data-testid="commentary"
        className="mt-4 max-h-[46vh] flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-card p-4"
      >
        {shownEvents.map((e: MatchEvent, i) => (
          <div key={i} className={`flex gap-2 text-[13px] leading-snug ${eventClass[e.type] ?? ""}`}>
            <span className="w-8 shrink-0 text-right text-[11px] text-muted-foreground tnum">
              {e.minute > 90 ? `90+` : e.minute}'
            </span>
            <span>{e.text}</span>
          </div>
        ))}
      </div>

      {!done ? (
        <Button
          data-testid="skip"
          variant="secondary"
          className="mt-4 h-12 w-full font-bold"
          onClick={() => setMinute(total)}
        >
          Skip to full time
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          {performers.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="eyebrow">Top performers</div>
              <ul className="mt-2 space-y-1">
                {performers.map(([id, rating]) => {
                  const p = game.players.find((x) => x.id === id)!;
                  return (
                    <li key={id} className="flex items-center justify-between text-sm">
                      <span>{p.name}</span>
                      <span className="font-bold text-primary tnum">{rating.toFixed(1)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <Button
            data-testid="match-done"
            className="h-12 w-full text-base font-bold"
            onClick={finishMatch}
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
}

function TeamBadge({
  name,
  short,
  color,
  right
}: {
  name: string;
  short: string;
  color: string;
  right?: boolean;
}) {
  return (
    <div className={`flex w-[35%] items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold"
        style={{ backgroundColor: color, color: "#0B1B12" }}
      >
        {short}
      </span>
      <span className={`truncate text-xs font-semibold ${right ? "text-right" : ""}`}>
        {name}
      </span>
    </div>
  );
}
