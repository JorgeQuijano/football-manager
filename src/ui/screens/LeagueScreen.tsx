import { useState } from "react";
import { computeTable } from "@/engine";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/state/store";

export function LeagueScreen() {
  const game = useGame((s) => s.game)!;
  const [tab, setTab] = useState("table");
  const table = computeTable(game.fixtures, game.clubs);
  const rounds = [...new Set(game.fixtures.map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div>
      <h1 className="text-lg font-bold">League One</h1>
      <p className="text-xs text-muted-foreground">
        Season {game.season} · {game.round > 18 ? "Complete" : `Round ${game.round} next`}
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mt-3">
        <TabsList className="h-11! w-full">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <Card>
            <CardContent className="p-3">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Club</th>
                    <th>P</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GD</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row) => {
                    const c = game.clubs.find((x) => x.id === row.clubId)!;
                    const me = row.clubId === game.userClubId;
                    return (
                      <tr key={row.clubId} className={me ? "me" : ""}>
                        <td className="text-muted-foreground">{row.position}</td>
                        <td className="name">{c.name}</td>
                        <td>{row.p}</td>
                        <td>{row.w}</td>
                        <td>{row.d}</td>
                        <td>{row.l}</td>
                        <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                        <td className="font-bold">{row.pts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fixtures">
          <div className="space-y-3">
            {rounds.map((r) => (
              <Card key={r}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">Round {r}</span>
                    {r === game.round && (
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                        Next
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    {game.fixtures
                      .filter((f) => f.round === r)
                      .map((f) => {
                        const home = game.clubs.find((c) => c.id === f.homeId)!;
                        const away = game.clubs.find((c) => c.id === f.awayId)!;
                        const mine = f.homeId === game.userClubId || f.awayId === game.userClubId;
                        return (
                          <div
                            key={`${f.round}-${f.homeId}-${f.awayId}`}
                            className={`flex items-center gap-2 text-xs ${
                              mine ? "font-bold" : "text-muted-foreground"
                            }`}
                          >
                            <span className="flex-1 truncate text-right">{home.short}</span>
                            <span className="w-12 text-center tnum">
                              {f.played ? `${f.homeGoals}–${f.awayGoals}` : "–"}
                            </span>
                            <span className="flex-1 truncate">{away.short}</span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
