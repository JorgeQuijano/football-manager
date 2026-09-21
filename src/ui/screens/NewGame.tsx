import { useState } from "react";
import { CLUB_DEFS } from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";

export function NewGame() {
  const startNewGame = useGame((s) => s.startNewGame);
  const [selected, setSelected] = useState("c1");

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8 pt-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Touchline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a club. Play a season. Win the league.
        </p>
      </div>

      <div className="space-y-2">
        {CLUB_DEFS.map((def, i) => {
          const id = `c${i + 1}`;
          const active = selected === id;
          return (
            <button
              key={id}
              data-testid={`club-${i}`}
              onClick={() => setSelected(id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                active ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
                style={{ backgroundColor: def.color, color: "#0B1B12" }}
              >
                {def.short}
              </span>
              <span className="flex-1 text-sm font-semibold">{def.name}</span>
              <span
                className={`size-2.5 rounded-full ${active ? "bg-primary" : "bg-border"}`}
              />
            </button>
          );
        })}
      </div>

      <Button
        data-testid="start-career"
        className="mt-6 h-12 w-full text-base font-bold"
        onClick={() => startNewGame(selected)}
      >
        Start career
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        10 fictional clubs · 18-round season · progress saves automatically on this device
      </p>
    </div>
  );
}
