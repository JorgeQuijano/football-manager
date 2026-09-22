import { useEffect } from "react";
import { useGame } from "@/state/store";
import { BottomNav } from "@/ui/BottomNav";
import { Builder } from "@/ui/screens/Builder";
import { Home } from "@/ui/screens/Home";
import { LeagueScreen } from "@/ui/screens/LeagueScreen";
import { MatchScreen } from "@/ui/screens/MatchScreen";
import { NewGame } from "@/ui/screens/NewGame";
import { SeasonEnd } from "@/ui/screens/SeasonEnd";
import { Squad } from "@/ui/screens/Squad";
import { Tactics } from "@/ui/screens/Tactics";
import { Transfers } from "@/ui/screens/Transfers";

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
  if (screen === "match") return <MatchScreen />;
  if (screen === "seasonEnd") return <SeasonEnd />;
  if (screen === "builder") return <Builder />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <main className="flex-1 px-4 pb-28 pt-5">
        {screen === "home" && <Home />}
        {screen === "squad" && <Squad />}
        {screen === "tactics" && <Tactics />}
        {screen === "transfers" && <Transfers />}
        {screen === "league" && <LeagueScreen />}
      </main>
      <BottomNav />
    </div>
  );
}
