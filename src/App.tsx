import { Suspense, lazy, useEffect } from "react";
import { useGame } from "@/state/store";
import { BottomNav } from "@/ui/BottomNav";
import { Builder } from "@/ui/screens/Builder";
import { CareerOver } from "@/ui/screens/CareerOver";
import { Club } from "@/ui/screens/Club";
import { Home } from "@/ui/screens/Home";
import { Help } from "@/ui/screens/Help";
import { Inbox } from "@/ui/screens/Inbox";
import { LeagueScreen } from "@/ui/screens/LeagueScreen";
import { NewGame } from "@/ui/screens/NewGame";
import { Welcome } from "@/ui/screens/Welcome";
import { WeekBar } from "@/ui/Week";
import { SeasonEnd } from "@/ui/screens/SeasonEnd";
import { SetPieces } from "@/ui/screens/SetPieces";
import { Squad } from "@/ui/screens/Squad";
import { Tactics } from "@/ui/screens/Tactics";
import { Training } from "@/ui/screens/Training";
import { Transfers } from "@/ui/screens/Transfers";

// the match view (pitch, levers, talks) is the heaviest screen and is only
// needed once a match is open: keep it out of the initial bundle (v0.46)
const MatchScreen = lazy(() =>
  import("@/ui/screens/MatchScreen").then((m) => ({ default: m.MatchScreen }))
);

const ScreenFallback = () => (
  <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
    Loading…
  </div>
);

export default function App() {
  const loaded = useGame((s) => s.loaded);
  const game = useGame((s) => s.game);
  const screen = useGame((s) => s.screen);
  const init = useGame((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (!loaded) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
        Touchline
      </div>
    );
  }

  if (!game || screen === "new") return <NewGame />;
  // the run can end mid-season: the board's decision outranks whatever screen was open (v0.44)
  if (game.career?.dismissed) return <CareerOver />;
  if (screen === "welcome") return <Welcome />;
  if (screen === "match")
    return (
      <Suspense fallback={<ScreenFallback />}>
        <MatchScreen />
      </Suspense>
    );
  if (screen === "seasonEnd") return <SeasonEnd />;
  if (screen === "builder") return <Builder />;
  if (screen === "inbox") return <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4"><Inbox /></main>;
  if (screen === "help") return <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4"><Help /></main>;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-5">
        {screen === "home" && <Home />}
        {screen === "squad" && <Squad />}
        {screen === "tactics" && <Tactics />}
        {screen === "transfers" && <Transfers />}
        {screen === "training" && <Training />}
        {screen === "setpieces" && <SetPieces />}
        {screen === "league" && <LeagueScreen />}
        {screen === "club" && <Club />}
      </main>
      <WeekBar />
        <BottomNav />
    </div>
  );
}
