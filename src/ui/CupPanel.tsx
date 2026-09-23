import { Trophy } from "lucide-react";
import { CUP_DAY, CUP_WEEK, cupStatus, cupView, type CupTie } from "@/engine";
import { Card, CardContent } from "@/components/ui/card";
import { useGame } from "@/state/store";

function TieLine({ t }: { t: CupTie }) {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const home = game.clubs.find((c) => c.id === t.homeId);
  const away = game.clubs.find((c) => c.id === t.awayId);
  const mine = t.homeId === game.userClubId || t.awayId === game.userClubId;
  const won = t.played && t.winnerId === game.userClubId && mine;
  return (
    <li
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] ${
        mine ? "bg-primary/10 ring-1 ring-primary/30" : ""
      }`}
      data-testid={`cup-tie-${t.id}`}
    >
      <span className={`min-w-0 flex-1 truncate font-semibold ${t.winnerId === t.homeId ? "text-foreground" : "text-muted-foreground"}`}>
        {home?.short ?? home?.name}
      </span>
      <span className="shrink-0 font-extrabold tabular-nums">
        {t.played ? `${t.homeGoals}–${t.awayGoals}` : "–"}
      </span>
      <span className={`min-w-0 flex-1 truncate text-right font-semibold ${t.winnerId === t.awayId ? "text-foreground" : "text-muted-foreground"}`}>
        {away?.short ?? away?.name}
      </span>
      <span className="w-14 shrink-0 text-right text-[10px] font-bold uppercase text-muted-foreground">
        {t.played ? (t.pens ? `pens ${t.pens.home}–${t.pens.away}` : "") : won ? "" : "to play"}
      </span>
    </li>
  );
}

/** The Challenge Cup bracket (engine/cup.ts). */
export function CupPanel() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const view = cupView(game);
  const cup = game.cup;
  if (!cup || view.length === 0) {
    return (
      <Card>
        <CardContent className="p-3 text-[12px] text-muted-foreground">No cup this season.</CardContent>
      </Card>
    );
  }
  const winner = cup.winnerId ? game.clubs.find((c) => c.id === cup.winnerId) : undefined;
  const history = game.history?.cups ?? [];

  return (
    <div className="space-y-2" data-testid="cup-panel">
      <Card>
        <CardContent className="flex items-center gap-2 p-3">
          <Trophy size={16} className="shrink-0 text-[#FFB020]" />
          <div className="min-w-0">
            <p className="text-[12px] font-bold" data-testid="cup-status">
              {cupStatus(game)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {winner
                ? `${winner.name} lift it · ${game.season}`
                : `Ties on the Wednesday of league weeks ${Object.values(CUP_WEEK).join(", ")}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {view.map((r) => (
        <Card key={r.round}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                {r.label}
              </h3>
              <span className="text-[10px] font-semibold text-muted-foreground">
                Wed · round {r.week}
              </span>
            </div>
            {r.ties.length === 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {r.week < game.round ? "Not reached." : "Waiting on the draw."}
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {r.ties.map((t) => (
                  <TieLine key={t.id} t={t} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
              Winners
            </h3>
            <ul className="mt-1.5 space-y-1">
              {history.map((h) => (
                <li key={h.season} className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">Season {h.season}</span>
                  <span className="font-semibold">{game.clubs.find((c) => c.id === h.winnerId)?.name}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 text-[11px] text-muted-foreground">
          Cup ties are played mid-week — {CUP_DAY === 2 ? "Wednesday" : "mid-week"} on the week clock. Two matches in a
          week is a rotation problem: your plan still runs on every other day.
        </CardContent>
      </Card>
    </div>
  );
}
