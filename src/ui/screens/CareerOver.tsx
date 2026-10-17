import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { reputationLabel } from "@/engine";
import { useGame } from "@/state/store";

const closingLine = (reputation: number): string => {
  if (reputation >= 70) return "A record like yours will find another job — the phone will ring.";
  if (reputation >= 55) return "You leave with your name intact. Someone will take a chance on it.";
  if (reputation >= 40) return "A respectable run, cut short. The next board will want to see more.";
  if (reputation >= 25) return "It may be a while before the phone rings again.";
  return "The game is unforgiving. It will take a rebuild to be trusted again.";
};

/** The end of a run: dismissed, with the record card read one last time (v0.44). */
export function CareerOver() {
  const game = useGame((s) => s.game)!;
  const resetGame = useGame((s) => s.resetGame);
  const c = game.career;
  if (!c || !c.dismissed) return null;
  const dis = c.dismissed;
  const club = game.clubs.find((x) => x.id === dis.clubId);
  const h = game.history;
  const career = h.seasons.reduce(
    (acc, s) => ({ w: acc.w + s.user.w, d: acc.d + s.user.d, l: acc.l + s.user.l }),
    { w: 0, d: 0, l: 0 }
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 pt-10" data-testid="career-over">
      <div className="eyebrow text-center text-[var(--danger)]">The board have seen enough</div>
      <h1 className="mt-2 text-center text-2xl font-extrabold">Sacked</h1>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {club?.name ?? "The club"} dismissed you in round {dis.round} of season {dis.season}.
      </p>

      <Card className="mt-5">
        <CardContent className="p-4">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">Your reputation</span>
            <span className="text-sm font-extrabold tnum" data-testid="career-reputation">
              {c.reputation}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold">{reputationLabel(c.reputation)}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">{closingLine(c.reputation)}</p>
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardContent className="p-4">
          <div className="eyebrow">The record</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-extrabold tnum">{h.seasons.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Seasons</div>
            </div>
            <div>
              <div className="text-lg font-extrabold tnum">{h.titles}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Titles</div>
            </div>
            <div>
              <div className="text-lg font-extrabold tnum">
                {career.w}–{career.d}–{career.l}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">W–D–L</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-3">
        <CardContent className="p-4">
          <div className="eyebrow">Clubs managed</div>
          <div className="mt-2 space-y-1.5">
            {c.stints.map((s, i) => {
              const sc = game.clubs.find((x) => x.id === s.clubId);
              const span =
                s.until === undefined || s.until === s.from
                  ? `Season ${s.from}`
                  : `Seasons ${s.from}–${s.until}`;
              return (
                <div key={`${s.clubId}-${i}`} className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{sc?.name ?? s.clubId}</span>
                  <span className="text-muted-foreground">{span}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button className="mt-6 h-12 w-full text-base font-bold" data-testid="new-career" onClick={resetGame}>
        Start a new career
      </Button>
    </div>
  );
}
