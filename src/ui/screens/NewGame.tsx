import { useEffect, useState } from "react";
import { ChevronDown, Eye, Landmark, Shield, Users } from "lucide-react";
import { NATIONS, bandLabel, clubBrief, seasonRounds, type ClubBrief } from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";

/** One row of the read-out: a word, not a number (the fog). */
function BandRow({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs" data-testid={testid}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function difficultyColour(d: ClubBrief["difficulty"]) {
  return d === "Easy"
    ? "text-primary"
    : d === "Fair"
      ? "text-[#7BE495]"
      : d === "Hard"
        ? "text-[#FFB020]"
        : "text-[#FF6B6B]";
}

export function NewGame() {
  const preview = useGame((s) => s.preview);
  const prepareWorld = useGame((s) => s.prepareWorld);
  const startNewGame = useGame((s) => s.startNewGame);
  const [selected, setSelected] = useState<string | null>(null);
  const [nation, setNation] = useState("eng");

  // build the league the moment the screen opens, so the choice is made on real data
  useEffect(() => {
    if (!preview) prepareWorld(undefined, "eng");
  }, [preview, prepareWorld]);

  if (!preview) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4">
        <p className="text-sm text-muted-foreground" data-testid="world-loading">
          Building the league…
        </p>
      </div>
    );
  }

  const briefs = preview.clubs.map((c) => clubBrief(preview, c.id));
  const sel = briefs.find((b) => b.id === selected) ?? briefs[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8 pt-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Choose your club</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Public facts are public. Money and squads you read between the lines.
        </p>
      </div>

      <label className="mb-3 block">
        <span className="text-[11px] font-bold uppercase text-muted-foreground">Country</span>
        <select
          className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold"
          data-testid="country-select"
          value={nation}
          onChange={(e) => {
            const id = e.target.value;
            setNation(id);
            setSelected(null);
            // a new country is a new league: build it before he chooses a club
            prepareWorld(undefined, id);
          }}
        >
          {NATIONS.map((n) => (
            <option key={n.id} value={n.id}>
              {n.country} — {n.league}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        {briefs.map((b, i) => {
          const active = selected === b.id;
          return (
            <div
              key={b.id}
              className={`overflow-hidden rounded-xl border transition-colors ${
                active ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <button
                data-testid={`club-${i}`}
                aria-expanded={active}
                onClick={() => setSelected(b.id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left"
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
                  style={{ backgroundColor: b.color, color: "#0B1B12" }}
                >
                  {b.short}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{b.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {b.lore.city} · {b.capacity.toLocaleString()} seats · {b.squad}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-muted-foreground transition-transform ${active ? "rotate-180" : ""}`}
                />
              </button>

              {active && (
                <div className="space-y-2 border-t border-border/60 px-3 pb-3 pt-2.5" data-testid="club-brief">
                  <div className="text-[11px] text-muted-foreground">
                    Founded {b.lore.founded} ·{" "}
                    {b.titles === 0 ? "no league titles yet" : `${b.titles} league title${b.titles > 1 ? "s" : ""}`}
                  </div>
                  <p className="rounded-lg bg-secondary/40 p-2.5 text-[11px] italic text-muted-foreground">
                    {b.pitch}
                  </p>

                  <section className="rounded-lg border border-border bg-background/60 p-2.5">
                    <h3 className="mb-0.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                      <Eye size={11} /> Public record
                    </h3>
                    <BandRow label="Ground" value={b.stadium} testid="brief-stadium" />
                    <BandRow label="Capacity" value={`${b.capacity.toLocaleString()} seats`} testid="brief-capacity" />
                    <BandRow
                      label="League titles"
                      value={b.titles === 0 ? "none yet" : String(b.titles)}
                      testid="brief-titles"
                    />
                  </section>

                  <section className="rounded-lg border border-border bg-background/60 p-2.5">
                    <h3 className="mb-0.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                      <Shield size={11} /> Between the lines
                    </h3>
                    <BandRow label="Wealth" value={b.wealth} testid="brief-wealth" />
                    <BandRow label="Squad" value={b.squad} testid="brief-squad" />
                    {b.facilities.map((f) => (
                      <BandRow key={f.label} label={f.label} value={bandLabel(f.band)} testid={`brief-${f.label}`} />
                    ))}
                    <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-border pt-1.5 text-xs">
                      <span className="text-muted-foreground">Job difficulty</span>
                      <span className={`font-extrabold ${difficultyColour(b.difficulty)}`} data-testid="brief-difficulty">
                        {b.difficulty}
                      </span>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border bg-background/60 p-2.5" data-testid="brief-expectation">
                    <h3 className="mb-0.5 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                      <Landmark size={11} /> The board will want
                    </h3>
                    <p className="text-xs font-semibold">{b.expectation}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Users size={10} /> The exact figures arrive with the contract.
                    </p>
                  </section>

                  <Button
                    className="h-11 w-full font-bold"
                    data-testid="brief-take-job"
                    onClick={() => startNewGame(b.id)}
                  >
                    Take the {b.short} job
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        data-testid="start-career"
        variant="outline"
        className="mt-5 h-12 w-full text-base font-bold"
        onClick={() => startNewGame(sel.id)}
      >
        Take the {sel.short} job
      </Button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {seasonRounds(preview)}-round season · {preview.clubs.length} clubs · saves automatically on this device
      </p>
    </div>
  );
}
