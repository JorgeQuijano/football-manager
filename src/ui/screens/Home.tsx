import { useState } from "react";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  computeTable,
  conditionLine,
  conditionsFor,
  fmtShort,
  formGuide,
  roundDate,
  seasonRounds,
  userFixtureForRound,
  weatherOf,
  inboxUnread,
  friendlyDate,
  formOf,
  squadOf
} from "@/engine";
import { useGame } from "@/state/store";
import { formColor, initials, ordinal, shortName } from "@/ui/format";
import { SettingsSheet } from "@/ui/sheets";
import { MediaCard } from "@/ui/Press";

export function Home() {
  const game = useGame((s) => s.game)!;
  const advance = useGame((s) => s.advance);
  const setScreen = useGame((s) => s.setScreen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const unread = inboxUnread(game);
  const skipPreseason = useGame((s) => s.skipPreseason);
  // the three hottest and two coldest regulars — who's playing well right now
  const formWatch = (() => {
    const withForm = squadOf(game.players, game.userClubId)
      .map((p) => ({ p, f: formOf(p) ?? 0 }))
      .filter((e) => e.f > 0 && (e.p.form?.length ?? 0) >= 2);
    if (!withForm.length) return [] as { p: typeof withForm[number]["p"]; f: number; hot: boolean }[];
    const sorted = withForm.slice().sort((a, b) => b.f - a.f);
    const hot = sorted.slice(0, 3).map((e) => ({ ...e, hot: true }));
    const cold = sorted.slice(-2).filter((e) => e.f < 6.4).map((e) => ({ ...e, hot: false }));
    return [...hot, ...cold];
  })();

  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const table = computeTable(game.fixtures, game.clubs);
  const mine = table.find((r) => r.clubId === club.id)!;
  const nextFixture = userFixtureForRound(game.fixtures, game.round, club.id);
  const opponent = nextFixture
    ? game.clubs.find(
        (c) => c.id === (nextFixture.homeId === club.id ? nextFixture.awayId : nextFixture.homeId)
      )!
    : undefined;
  const isHome = nextFixture?.homeId === club.id;
  const form = formGuide(game.fixtures, club.id);
  const last = [...game.lastResults]
    .reverse()
    .find((r) => r.homeId === club.id || r.awayId === club.id);

  const miniTable = (() => {
    const top5 = table.slice(0, 5);
    if (top5.some((r) => r.clubId === club.id)) return top5;
    return [...top5, mine];
  })();

  return (
    <div>
      <header className="flex items-center gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full text-xs font-extrabold"
          style={{ backgroundColor: club.color, color: "#0B1B12" }}
        >
          {club.short}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold">{club.name}</div>
          <div className="text-xs text-muted-foreground">
            {ordinal(mine.position)} · {mine.pts} pts · Season {game.season}
          </div>
        </div>
        <button
          data-testid="inbox-link"
          onClick={() => setScreen("inbox")}
          className="relative grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground"
          aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
        >
          <Bell size={17} />
          {unread > 0 && (
            <span
              data-testid="inbox-badge"
              className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-[#FF6B6B] px-1 text-[10px] font-extrabold text-white"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
        <button
          data-testid="settings"
          onClick={() => setSettingsOpen(true)}
          className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground"
          aria-label="Settings"
        >
          <Settings size={17} />
        </button>
      </header>

      {form.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5">
          <span className="eyebrow mr-1">Form</span>
          {form.map((r, i) => (
            <span
              key={i}
              className={`grid size-5 place-items-center rounded-md text-[10px] font-extrabold ${formColor(r)}`}
            >
              {r}
            </span>
          ))}
        </div>
      )}

      {game.round < 0 && (
        <Card className="mt-4 border-primary/40">
          <CardContent className="space-y-2 p-4" data-testid="preseason-card">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Pre-season</span>
              <span className="text-[11px] font-bold text-primary tnum">
                friendly {game.round + 4} of 3
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Friendlies build match sharpness and form, and they never touch the table. The league
              starts on {fmtShort(roundDate(game.season, 1))} — this is your window for signings too.
            </p>
            <Button
              variant="secondary"
              className="h-11 w-full"
              data-testid="skip-preseason"
              onClick={skipPreseason}
            >
              Skip the rest of pre-season
            </Button>
          </CardContent>
        </Card>
      )}

      {formWatch.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-card p-3" data-testid="form-watch">
          <div className="eyebrow">In form</div>
          <div className="mt-1 space-y-1">
            {formWatch.map(({ p, f, hot }) => (
              <div key={p.id} className="flex items-center justify-between text-[11px] font-semibold">
                <span className="min-w-0 truncate">
                  {shortName(p.name)} <span className="text-muted-foreground">{p.pos}</span>
                </span>
                <span className="shrink-0 tnum" style={{ color: hot ? "#2ED573" : "#FF6B6B" }}>
                  {hot ? "▲" : "▼"} {f.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Last six ratings — hot players play above their level, cold ones below it.
          </p>
        </div>
      )}

      {nextFixture && opponent && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="eyebrow">
              {nextFixture?.friendly
                ? `Pre-season · friendly ${game.round + 4} of 3 · ${fmtShort(friendlyDate(game.season, game.round + 3))}`
                : `Next · Round ${game.round} of ${seasonRounds(game)} · ${fmtShort(roundDate(game.season, Math.min(game.round, seasonRounds(game))))}`}
            </div>
            <div className="mt-1.5 text-lg font-bold leading-tight">{opponent.name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {isHome ? "Home" : "Away"} · {isHome ? club.name : opponent.name}'s ground
            </div>
            <div className="mt-1.5 text-[11px] font-semibold" data-testid="home-conditions">
              <span style={{ color: weatherOf(conditionsFor(game, game.round).weather).tint }}>
                {conditionLine(conditionsFor(game, game.round))}
              </span>
            </div>
            <Button
              data-testid="continue"
              className="mt-4 h-12 w-full text-base font-bold"
              onClick={advance}
            >
              Continue
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Lineup set in Tactics — auto-picked if you do nothing
            </p>
          </CardContent>
        </Card>
      )}

      {last && (
        <Card className="mt-3">
          <CardContent className="p-4">
            <div className="eyebrow">FT · Round {last.round}</div>
            <div className="mt-1 text-base font-bold">
              {game.clubs.find((c) => c.id === last.homeId)!.short}{" "}
              {last.homeGoals}–{last.awayGoals}{" "}
              {game.clubs.find((c) => c.id === last.awayId)!.short}
            </div>
            {last.scorers.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {last.scorers
                  .map((s) => `${s.name} ${s.minute}'`)
                  .join(" · ")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <MediaCard />

      <Card className="mt-3">
        <CardContent className="p-4">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">League One</span>
            <button
              data-testid="mini-table-link"
              className="-my-2.5 px-3 py-3.5 text-[11px] font-semibold text-primary"
              onClick={() => setScreen("league")}
            >
              Full table
            </button>
          </div>
          <table className="tbl mt-2">
            <tbody>
              {miniTable.map((row) => {
                const c = game.clubs.find((x) => x.id === row.clubId)!;
                const me = row.clubId === club.id;
                return (
                  <tr key={row.clubId} className={me ? "me" : ""}>
                    <td className="w-6 text-muted-foreground">{row.position}</td>
                    <td className="name">{c.name}</td>
                    <td>{row.p}</td>
                    <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                    <td className="font-bold">{row.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
