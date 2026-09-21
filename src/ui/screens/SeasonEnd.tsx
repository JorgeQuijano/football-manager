import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { computeTable, seasonRounds } from "@/engine";
import { useGame } from "@/state/store";

export function SeasonEnd() {
  const game = useGame((s) => s.game)!;
  const startNextSeason = useGame((s) => s.startNextSeason);
  const table = computeTable(game.fixtures, game.clubs);
  const champion = game.clubs.find((c) => c.id === table[0].clubId)!;
  const userClub = game.clubs.find((c) => c.id === game.userClubId)!;
  const userWon = champion.id === game.userClubId;
  const userRow = table.find((r) => r.clubId === game.userClubId)!;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8 pt-8">
      <div className="eyebrow text-center">Season {game.season} complete</div>
      <Card className="mt-3">
        <CardContent className="p-5 text-center">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Champions
          </div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-full text-xs font-extrabold"
              style={{ backgroundColor: champion.color, color: "#0B1B12" }}
            >
              {champion.short}
            </span>
            <span className="text-xl font-bold">{champion.name}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {userWon
              ? "You won the league. Bottle it? Never heard of her."
              : `${userClub.name} finished ${userRow.position}${ordinalSuffix(userRow.position)} with ${userRow.pts} pts.`}
          </p>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="eyebrow">Final table</div>
          <table className="tbl mt-2">
            <tbody>
              {table.map((row) => {
                const c = game.clubs.find((x) => x.id === row.clubId)!;
                const me = row.clubId === game.userClubId;
                return (
                  <tr key={row.clubId} className={me ? "me" : ""}>
                    <td className="w-6 text-muted-foreground">{row.position}</td>
                    <td className="name">{c.name}</td>
                    <td>{row.w}</td>
                    <td>{row.d}</td>
                    <td>{row.l}</td>
                    <td>
                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                    </td>
                    <td className="font-bold">{row.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Button
        data-testid="next-season"
        className="mt-5 h-12 w-full text-base font-bold"
        onClick={startNextSeason}
      >
        Start season {game.season + 1}
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {seasonRounds(game)} rounds per season · players age one year between seasons
      </p>
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
