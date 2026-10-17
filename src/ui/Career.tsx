import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { boardTarget, boardVerdict, computeTable, ordinal } from "@/engine";
import { useGame } from "@/state/store";

/** The board's patience, on the Home screen — the meter the sack hangs from (v0.44). */
export function BoardCard() {
  const game = useGame((s) => s.game)!;
  const c = game.career;
  if (!c || c.dismissed) return null;
  // the board starts judging with the league, not with the friendlies
  if ((game.phase ?? "league") !== "league" || game.round < 1) return null;

  const { target, text } = boardTarget(game);
  const table = computeTable(game.fixtures, game.clubs);
  const row = table.find((r) => r.clubId === game.userClubId);
  if (!row) return null;
  const verdict = boardVerdict(c.confidence, c.warning);

  return (
    <Card className="mt-3" data-testid="board-card">
      <CardContent className="p-4">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">The board</span>
          <span className="text-[11px] font-semibold" style={{ color: verdict.tint }} data-testid="board-verdict">
            {verdict.label}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary" data-testid="board-confidence">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(c.confidence)}%`, background: verdict.tint }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Asked for {ordinal(target)} or thereabouts</span>
          <span className="font-semibold tnum">
            Now {ordinal(row.position)} · {row.pts} pts
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{text}</p>
        {c.warning === 2 && (
          <p className="mt-1 text-[11px] font-semibold text-[var(--danger)]">
            Another bad run and the board will act.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The approaches from other clubs, live through pre-season only. Taking a job
 * moves the whole club: your playbook travels, the squad is the new one's.
 */
export function JobOffers() {
  const game = useGame((s) => s.game)!;
  const takeJob = useGame((s) => s.takeJob);
  const declineJob = useGame((s) => s.declineJob);
  const c = game.career;
  if (!c || c.dismissed || game.round >= 0 || c.offers.length === 0) return null;

  return (
    <Card className="mt-3 border-primary/40" data-testid="job-offers">
      <CardContent className="space-y-3 p-4">
        <div>
          <div className="eyebrow text-primary">Job offers</div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Your record has clubs interested. They will not wait forever — offers close when the league starts.
          </p>
        </div>
        {c.offers.map((o) => {
          const club = game.clubs.find((x) => x.id === o.clubId);
          if (!club) return null;
          return (
            <div
              key={o.id}
              className="rounded-xl border border-border p-3"
              data-testid={`job-offer-${o.clubId}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full text-[9px] font-extrabold"
                  style={{ backgroundColor: club.color, color: "#0B1B12" }}
                >
                  {club.short}
                </span>
                <span className="min-w-0 truncate text-sm font-bold">{club.name}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {o.squad} · Board expects: {o.expectation}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  className="h-10 flex-1"
                  data-testid={`job-take-${o.clubId}`}
                  onClick={() => takeJob(o.id)}
                >
                  Take the job
                </Button>
                <Button
                  variant="ghost"
                  className="h-10"
                  data-testid={`job-decline-${o.clubId}`}
                  onClick={() => declineJob(o.id)}
                >
                  Turn it down
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
