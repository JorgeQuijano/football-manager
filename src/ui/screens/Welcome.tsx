import { useState } from "react";
import { ArrowRight, Banknote, CalendarDays, Landmark, Star, Users } from "lucide-react";
import { jobBrief, money, sponsorHint, wagePressure } from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";

/**
 * The first day: what the board expects, what's in the accounts, who the best
 * player is and when the first match is — then get out of the way (v0.32.0).
 */
export function Welcome() {
  const game = useGame((s) => s.game);
  const dismissWelcome = useGame((s) => s.dismissWelcome);
  const setScreen = useGame((s) => s.setScreen);
  const [step, setStep] = useState(0);
  if (!game) return null;

  const brief = jobBrief(game);
  const club = game.clubs.find((c) => c.id === game.userClubId);

  const pages: Array<{ title: string; body: React.ReactNode }> = [
    {
      title: `Welcome to ${club?.name}`,
      body: (
        <div className="space-y-3" data-testid="welcome-expectations">
          <p className="text-sm text-muted-foreground">
            The chairman shakes your hand. The press want a word. The board have written your brief in ink:
          </p>
          <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm font-bold" data-testid="welcome-brief">
            {brief.expectation}
          </p>
          <ul className="space-y-1.5 text-xs">
            <li className="flex items-center gap-2">
              <Users size={13} className="text-muted-foreground" /> {brief.squadSize} players on the books
            </li>
            <li className="flex items-center gap-2" data-testid="welcome-best">
              <Star size={13} className="text-muted-foreground" /> Best player: {brief.bestPlayer.name} ({brief.bestPlayer.pos},{" "}
              {brief.bestPlayer.age})
            </li>
            <li className="flex items-center gap-2" data-testid="welcome-fixture">
              <CalendarDays size={13} className="text-muted-foreground" /> First league match:{" "}
              {brief.firstFixture ?? "to be confirmed"}
            </li>
          </ul>
          <p className="text-[11px] text-muted-foreground">{sponsorHint(game, game.userClubId)}</p>
        </div>
      )
    },
    {
      title: "The accounts",
      body: (
        <div className="space-y-3" data-testid="welcome-accounts">
          <div className="grid grid-cols-1 gap-2">
            {(
              [
                ["Transfer budget", money(brief.transfer), "transfer"],
                ["Wage ceiling", `${money(brief.wageBudget)}/wk`, "wage"],
                ["Club account", money(brief.balance), "balance"]
              ] as Array<[string, string, string]>
            ).map(([label, value, id]) => (
              <div key={id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Banknote size={13} /> {label}
                </span>
                <span className="text-sm font-extrabold tnum" data-testid={`welcome-${id}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{brief.kittyNote}</p>
          <p className="text-[11px] text-muted-foreground">{wagePressure(game, game.userClubId)}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Landmark size={11} /> The Club tab shows the account, the shirt and the campus.
          </p>
        </div>
      )
    }
  ];

  const last = step >= pages.length - 1;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8 pt-10" data-testid="welcome-screen">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="grid size-11 place-items-center rounded-full text-[11px] font-extrabold"
          style={{ backgroundColor: club?.color ?? "#2ED573", color: "#0B1B12" }}
        >
          {club?.short ?? "—"}
        </span>
        <div>
          <div className="text-lg font-extrabold leading-tight">{pages[step].title}</div>
          <div className="text-[11px] text-muted-foreground">Day one · pre-season</div>
        </div>
      </div>

      <div className="flex-1">{pages[step].body}</div>

      <div className="mt-4 flex items-center gap-2">
        <span className="flex gap-1">
          {pages.map((_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i === step ? "bg-primary" : "bg-border"}`} />
          ))}
        </span>
        <span className="flex-1" />
        {step > 0 && (
          <Button variant="ghost" className="h-11" data-testid="welcome-back" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        <Button
          className="h-11 font-bold"
          data-testid={last ? "welcome-start" : "welcome-next"}
          onClick={() => (last ? dismissWelcome() : setStep((s) => s + 1))}
        >
          {last ? "Let's go" : "Next"}
          <ArrowRight size={15} />
        </Button>
      </div>

      <button
        className="mt-3 text-center text-[11px] text-muted-foreground underline-offset-2 active:underline"
        data-testid="welcome-skip"
        onClick={dismissWelcome}
      >
        Skip the briefing
      </button>

      {last && (
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Nothing here is hidden forever — it's all in the Club tab and the inbox.
        </p>
      )}
    </div>
  );
}
