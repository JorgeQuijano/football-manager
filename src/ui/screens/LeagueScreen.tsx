import { useState } from "react";
import type { SeasonRecord } from "@/engine";
import { seasonRounds, computeTable, conditionLine, conditionsFor, money, ordinal, rating1, ratingAvg, topScorers, weatherOf } from "@/engine";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataHub } from "@/ui/DataHub";
import { CupPanel } from "@/ui/CupPanel";
import { useGame } from "@/state/store";
import { posChip, shortName } from "@/ui/format";
import { CalendarView } from "@/ui/Calendar";

export function LeagueScreen() {
  const game = useGame((s) => s.game)!;
  const [tab, setTab] = useState("table");
  const [openSeason, setOpenSeason] = useState<number | null>(null);
  const table = computeTable(game.fixtures, game.clubs);
  const rounds = [...new Set(game.fixtures.map((f) => f.round))].sort((a, b) => a - b);
  const clubOf = (id: string) => game.clubs.find((c) => c.id === id);
  const cShort = (id: string) => clubOf(id)?.short ?? "—";
  const cName = (id: string) => clubOf(id)?.name ?? "—";
  const h = game.history;
  const scorers = topScorers(game, 15);

  const career = h.seasons.reduce(
    (acc, s) => ({ w: acc.w + s.user.w, d: acc.d + s.user.d, l: acc.l + s.user.l, prize: acc.prize + s.user.prize }),
    { w: 0, d: 0, l: 0, prize: 0 }
  );

  return (
    <div>
      <h1 className="text-lg font-bold">League One</h1>
      <p className="text-xs text-muted-foreground">
        Season {game.season} · {game.round > seasonRounds(game) ? "Complete" : `Round ${game.round} of ${seasonRounds(game)}`}
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mt-3">
        <TabsList className="h-11! w-full">
          <TabsTrigger className="h-11! px-1.5! text-[11px]!" value="table">Table</TabsTrigger>
          <TabsTrigger className="h-11! px-1.5! text-[11px]!" value="diary">Diary</TabsTrigger>
          <TabsTrigger className="h-11! px-1.5! text-[11px]!" value="fixtures">Fixtures</TabsTrigger>
          <TabsTrigger className="h-11! px-1.5! text-[11px]!" value="cup">Cup</TabsTrigger>
          <TabsTrigger className="h-11! px-1.5! text-[11px]!" value="scorers">Scorers</TabsTrigger>
          <TabsTrigger className="h-11! px-1.5! text-[11px]!" value="history">History</TabsTrigger>
          <TabsTrigger className="h-11! px-1.5! text-[11px]!" value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="cup">
          <CupPanel />
        </TabsContent>

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

        <TabsContent value="diary">
          <CalendarView />
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
                  {r === game.round && (
                    <div className="mt-0.5 text-[10px] font-semibold" data-testid={`round-conditions-${r}`}>
                      <span style={{ color: weatherOf(conditionsFor(game, r).weather).tint }}>
                        {conditionLine(conditionsFor(game, r))}
                      </span>
                    </div>
                  )}
                  {(() => {
                    const award = game.awards.rounds.find((a) => a.season === game.season && a.round === r);
                    return award ? (
                      <div className="mt-1 text-[10px] font-semibold text-primary/90" data-testid={`potr-${r}`}>
                        ★ Player of the Round: {award.name} ({cShort(award.clubId)}) · {award.rating.toFixed(1)}
                      </div>
                    ) : null;
                  })()}
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
        <TabsContent value="scorers">
          <Card>
            <CardContent className="p-3" data-testid="scorers-tab">
              {scorers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No goals yet this season.</p>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>G</th>
                      <th>A</th>
                      <th>Apps</th>
                      <th>Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorers.map((p, i) => (
                      <tr key={p.id} className={p.clubId === game.userClubId ? "me" : ""}>
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td className="name">
                          <span className="flex items-center gap-1">
                            <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${posChip[p.pos]}`}>
                              {p.pos}
                            </span>
                            <span className="truncate">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground">{cShort(p.clubId)}</span>
                          </span>
                        </td>
                        <td className="font-bold">{p.goals}</td>
                        <td>{p.assists}</td>
                        <td>{p.apps}</td>
                        <td className="tnum">{rating1(ratingAvg(p))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <DataHub />
        </TabsContent>
        <TabsContent value="history">
          <div className="space-y-3" data-testid="history-tab">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="eyebrow">Your record</div>
                    <div className="text-lg font-extrabold tnum" data-testid="hist-titles">
                      {h.titles} {h.titles === 1 ? "league title" : "league titles"}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground tnum">
                    <div>
                      {h.seasons.length} {h.seasons.length === 1 ? "season" : "seasons"} ·{" "}
                      {career.w}W {career.d}D {career.l}L
                    </div>
                    <div>Prize money {money(career.prize)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="eyebrow">Seasons</div>
                {h.seasons.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No completed seasons yet — the first one gets written into the record books at the
                    pre-season.
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {[...h.seasons].reverse().map((s) => (
                      <button
                        key={s.season}
                        data-testid={`hist-season-${s.season}`}
                        onClick={() => setOpenSeason(openSeason === s.season ? null : s.season)}
                        className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">Season {s.season}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              s.champion.clubId === game.userClubId
                                ? "bg-primary/15 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {s.champion.clubId === game.userClubId ? "CHAMPIONS" : `Champions: ${cShort(s.champion.clubId)}`}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground tnum">
                          You: {ordinal(s.user.pos)} · {s.user.pts} pts ({s.user.w}W {s.user.d}D {s.user.l}L) ·{" "}
                          {money(s.user.prize)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          Top scorer {s.topScorer ? `${s.topScorer.name} (${s.topScorer.goals})` : "—"}
                          {s.playerOfSeason ? ` · POTY ${s.playerOfSeason.name} (${s.playerOfSeason.rating.toFixed(1)})` : ""}
                        </div>
                        {openSeason === s.season && (
                          <div className="mt-2 space-y-1 border-t border-border pt-2 text-[11px]" data-testid={`hist-detail-${s.season}`}>
                            <div className="text-muted-foreground">
                              Runner-up: {cName(s.runnerUp.clubId)} ({s.runnerUp.points} pts) · Champion goals{" "}
                              {s.champion.gf}:{s.champion.ga}
                            </div>
                            {s.biggestWin && (
                              <div className="text-muted-foreground">
                                Biggest win: {cShort(s.biggestWin.homeId)} {s.biggestWin.hs}–{s.biggestWin.as}{" "}
                                {cShort(s.biggestWin.awayId)} (R{s.biggestWin.round})
                              </div>
                            )}
                            {s.teamOfSeason.length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                  Team of the Season
                                </div>
                                {s.teamOfSeason.map((t) => (
                                  <div key={t.playerId} className="flex items-center justify-between">
                                    <span className="truncate">
                                      <span className={`mr-1 rounded px-1 py-0.5 text-[9px] font-bold ${posChip[t.pos]}`}>
                                        {t.pos}
                                      </span>
                                      {t.name}
                                    </span>
                                    <span className="text-muted-foreground">{cShort(t.clubId)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3" data-testid="hist-records">
                <div className="eyebrow">Records</div>
                <div className="mt-1.5 space-y-1.5 text-[11px]">
                  {(
                    [
                      ["Most career goals", h.allTime.topScorer, "goals"],
                      ["Most appearances", h.allTime.mostApps, "apps"],
                      ["Most goals in a season", h.allTime.bestSeasonGoals, "goals"],
                      ["Best season rating", h.allTime.bestSeasonRating, ""]
                    ] as const
                  ).map(([label, e, unit]) =>
                    e ? (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="truncate font-semibold">
                          {e.name} <span className="text-muted-foreground">{cShort(e.clubId)}</span>{" "}
                          <span className="tnum text-primary">
                            {unit === "" ? e.value.toFixed(2) : e.value}
                          </span>{" "}
                          <span className="text-muted-foreground">S{e.season}</span>
                        </span>
                      </div>
                    ) : (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-muted-foreground">—</span>
                      </div>
                    )
                  )}
                  {h.allTime.biggestWin && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Biggest win</span>
                      <span className="font-semibold">
                        {cShort(h.allTime.biggestWin.homeId)} {h.allTime.biggestWin.hs}–
                        {h.allTime.biggestWin.as} {cShort(h.allTime.biggestWin.awayId)}{" "}
                        <span className="text-muted-foreground">
                          S{h.allTime.biggestWin.season} R{h.allTime.biggestWin.round}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3" data-testid="hist-awards">
                <div className="eyebrow">This season — Player of the Round</div>
                {game.awards.rounds.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">No rounds played yet.</p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    {game.awards.rounds.slice(0, 6).map((a) => (
                      <div key={`${a.season}-${a.round}`} className="flex items-center justify-between text-[11px]">
                        <span className="truncate">
                          <span className="text-muted-foreground">R{a.round}</span> {a.name}{" "}
                          <span className="text-muted-foreground">({cShort(a.clubId)})</span>
                        </span>
                        <span className="tnum font-bold text-primary">{a.rating.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
