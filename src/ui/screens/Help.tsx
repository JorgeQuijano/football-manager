import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";

const SECTIONS: { id: string; title: string; lines: string[] }[] = [
  {
    id: "basics",
    title: "The basics",
    lines: [
      "One round is one week: your match, then training, then the league moves on. Eighteen rounds make a season.",
      "Same seed, same league — every save is reproducible, so a result you didn't like was always going to happen.",
      "The Home screen is your dugout: next match, press duties, discipline, and the news ticker."
    ]
  },
  {
    id: "bodies",
    title: "Legs, conditions and sharpness",
    lines: [
      "Cond — freshness going into a match (0-100). Rises with rest, drops with minutes. Tired players get injured more.",
      "Legs — stamina inside a match. Drains minute by minute, faster past 30 or with low physical, and empty legs cost up to 16%.",
      "Sharp — match fitness. Rises 6 a full game, falls 3 a round you don't play. Rusty (under 70) costs up to 7%. A squad player who never plays is sharp nowhere.",
      "Wear — accumulated load. Builds when a tired or older player keeps starting, costs up to 5%, makes knocks longer. Rest clears it."
    ]
  },
  {
    id: "match",
    title: "Match day",
    lines: [
      "Pick a formation and roles on Tactics; the XI and bench matter. Auto-pick picks your best side.",
      "In the Changes sheet: Subs, your instructions (Mine), theirs (Theirs) and Talk. Three substitution windows, five subs, half-time is free.",
      "Team talks set a match-long Fire (attack) and Shape (defence) edge and move the dressing room for good. Shouts are instant but fade — the fourth backfires.",
      "Opposition instructions on their danger man are usually worth more than a shout.",
      "Extra time and penalties exist for knockout football."
    ]
  },
  {
    id: "squad",
    title: "Squad, development and individuals",
    lines: [
      "Training sets the team focus and intensity; heavy weeks grow players faster but risk knocks and cost recovery.",
      "Every young player has a ceiling (POT). Minutes, morale and condition decide how fast he gets there.",
      "Individual targets: set a player goals/appearances/average rating; ambitious ones lift him now and bite if he misses.",
      "Retraining teaches a second position; Move learning teaches a specific trait, faster with the matching training unit.",
      "Name a captain — he carries extra weight in the dressing room and in every talk. Discipline: fine, warn or ignore."
    ]
  },
  {
    id: "market",
    title: "The market",
    lines: [
      "Fees: you can pay up front or over instalments — sellers discount a spread fee, so add a sell-on or an add-on after N apps to close a deal.",
      "Offers are two-step: the club accepts a fee, then the player wants terms. His agent's number depends on length, bonuses and clauses.",
      "Loans: borrow a young squad man for the season (loan fee + wage share, option or obligation to buy) or send yours out.",
      "Free transfers: anyone in his final year can be pre-contracted in the winter window — and rivals will poach yours.",
      "The board has a policy each season: an age ceiling it will veto and money targets it grades at the season end."
    ]
  },
  {
    id: "world",
    title: "The world around you",
    lines: [
      "Fog of war: you only know what your scouts have seen. Send them out; ranges narrow until they're exact.",
      "The press moves fan confidence, which pays at the gate and leaks into the dressing room.",
      "Form, ratings and the History tab keep the record books. The Diary shows the season's dates, windows and international weeks.",
      "Data hub (League → Data) draws the last match's shot map and xG timeline."
    ]
  }
];

const MOTION_KEY = "fm-motion";

export function Help() {
  const setScreen = useGame((s) => s.setScreen);
  const [motion, setMotion] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MOTION_KEY) === "off";
    } catch {
      return false;
    }
  });

  const toggleMotion = () => {
    const next = !motion;
    setMotion(next);
    try {
      localStorage.setItem(MOTION_KEY, next ? "off" : "on");
    } catch {
      // storage unavailable — the toggle still works for this session
    }
  };

  return (
    <div className="space-y-3 pb-6" data-testid="help-screen">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">How to play</h1>
        <Button size="sm" variant="ghost" className="h-11" data-testid="help-back" onClick={() => setScreen("home")}>
          Back
        </Button>
      </header>

      <div className="space-y-2 rounded-xl border border-border bg-card p-3" data-testid="help-a11y">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Comfort</div>
        <button
          data-testid="reduce-motion"
          onClick={toggleMotion}
          className={`flex h-11 w-full items-center justify-between rounded-lg px-3 text-sm font-bold ${
            motion ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"
          }`}
        >
          <span>Reduce motion in matches</span>
          <span className="text-[11px]">{motion ? "On" : "Off"}</span>
        </button>
        <p className="text-[10px] text-muted-foreground">
          Turns off the flowing ball animation — the match still plays out, the picture just updates in
          steps instead of sliding.
        </p>
      </div>

      {SECTIONS.map((s) => (
        <section key={s.id} className="rounded-xl border border-border bg-card p-3" data-testid={`help-${s.id}`}>
          <h2 className="text-sm font-extrabold">{s.title}</h2>
          <ul className="mt-1.5 space-y-1.5">
            {s.lines.map((l, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
                <span className="text-primary">·</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
