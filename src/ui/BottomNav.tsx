import { Banknote, ClipboardList, Dumbbell, Home as HomeIcon, Trophy, Users } from "lucide-react";
import { useGame, type Screen } from "@/state/store";

const items: Array<{ screen: Screen; label: string; icon: typeof HomeIcon }> = [
  { screen: "home", label: "Home", icon: HomeIcon },
  { screen: "squad", label: "Squad", icon: Users },
  { screen: "tactics", label: "Tactics", icon: ClipboardList },
  { screen: "transfers", label: "Transfers", icon: Banknote },
  { screen: "training", label: "Training", icon: Dumbbell },
  { screen: "league", label: "League", icon: Trophy }
];

export function BottomNav() {
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-6">
        {items.map(({ screen: s, label, icon: Icon }) => {
          const active = screen === s;
          return (
            <button
              key={s}
              data-testid={`nav-${s}`}
              onClick={() => setScreen(s)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
