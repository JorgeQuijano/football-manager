import { useMemo, useState } from "react";
import type { Player, Position } from "@/engine";
import { estimateFor, knowledgeOf, marketValue, money, overallFor, squadOf } from "@/engine";
import { useGame } from "@/state/store";
import { posChip, shortName } from "@/ui/format";

const input = "h-11 w-full rounded-lg border border-border bg-card px-3 text-sm font-semibold";
const POSITIONS: Array<Position | "any"> = ["any", "GK", "DF", "MF", "FW"];

const knownOvr = (game: ReturnType<typeof useGame.getState>["game"] & object, p: Player): number => {
  const est = estimateFor(game, p);
  if (est.exactOvr !== null) return est.exactOvr;
  if (est.ovrRange) return Math.round((est.ovrRange[0] + est.ovrRange[1]) / 2);
  return 0;
};

/** Global player search and the side-by-side compare tray. */
export function PlayerSearch({ onOpenPlayer }: { onOpenPlayer: (id: string) => void }) {
  const game = useGame((s) => s.game)!;
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<Position | "any">("any");
  const [ageMin, setAgeMin] = useState(16);
  const [ageMax, setAgeMax] = useState(40);
  const [ovrMin, setOvrMin] = useState(0);
  const [clubId, setClubId] = useState<string>("any");
  const [listed, setListed] = useState(false);
  const [expiring, setExpiring] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);

  const clubs = [{ id: "any", name: "Any club" }, ...game.clubs.map((c) => ({ id: c.id, name: c.name }))];

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return game.players
      .filter((p) => {
        if (needle && !p.name.toLowerCase().includes(needle)) return false;
        if (pos !== "any" && p.pos !== pos) return false;
        if (p.age < ageMin || p.age > ageMax) return false;
        if (ovrMin > 0 && knownOvr(game, p) < ovrMin) return false;
        if (clubId !== "any" && p.clubId !== clubId) return false;
        if (listed && !p.transferListed) return false;
        if (expiring && p.contract.until > game.season) return false;
        return true;
      })
      .sort((a, b) => knownOvr(game, b) - knownOvr(game, a) || b.age - a.age || (a.id < b.id ? -1 : 1))
      .slice(0, 40);
  }, [game, q, pos, ageMin, ageMax, ovrMin, clubId, listed, expiring]);

  const toggleCompare = (id: string) =>
    setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev.slice(-1), id]));

  const pair = compare.map((id) => game.players.find((p) => p.id === id)).filter((p): p is Player => !!p);

  return (
    <div className="space-y-3" data-testid="search-view">
      <input
        data-testid="search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search every player by name…"
        className={input}
      />

      <div className="grid grid-cols-2 gap-2">
        <select data-testid="search-pos" value={pos} onChange={(e) => setPos(e.target.value as Position | "any")} className={input}>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p === "any" ? "Any position" : p}
            </option>
          ))}
        </select>
        <select data-testid="search-club" value={clubId} onChange={(e) => setClubId(e.target.value)} className={input}>
          <option value="any">Any club</option>
          {clubs.slice(1).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">Age from</span>
          <input
            data-testid="search-age-min"
            type="number"
            value={ageMin}
            onChange={(e) => setAgeMin(Number(e.target.value) || 0)}
            className={input}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">to</span>
          <input
            data-testid="search-age-max"
            type="number"
            value={ageMax}
            onChange={(e) => setAgeMax(Number(e.target.value) || 99)}
            className={input}
          />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground">
            Minimum rating (by your scouts' read — 0 means anyone)
          </span>
          <input
            data-testid="search-ovr"
            type="number"
            value={ovrMin}
            onChange={(e) => setOvrMin(Number(e.target.value) || 0)}
            className={input}
          />
        </label>
      </div>

      <div className="flex gap-1.5">
        <button
          data-testid="search-listed"
          onClick={() => setListed((v) => !v)}
          className={`h-11 flex-1 rounded-lg text-[11px] font-bold ${listed ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
        >
          Listed only
        </button>
        <button
          data-testid="search-expiring"
          onClick={() => setExpiring((v) => !v)}
          className={`h-11 flex-1 rounded-lg text-[11px] font-bold ${expiring ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground"}`}
        >
          Final year only
        </button>
      </div>

      {pair.length > 0 && (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-card p-3" data-testid="compare-panel">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Compare {pair.length === 1 ? "(pick one more)" : ""}
            </span>
            <button
              data-testid="compare-clear"
              onClick={() => setCompare([])}
              className="text-[10px] font-bold text-muted-foreground underline"
            >
              Clear
            </button>
          </div>
          <CompareRows pair={pair} />
        </div>
      )}

      <p className="text-[10px] font-semibold text-muted-foreground" data-testid="search-count">
        {results.length} player{results.length === 1 ? "" : "s"} match
      </p>

      <div className="space-y-1.5">
        {results.map((p) => {
          const est = estimateFor(game, p);
          const myPlayer = p.clubId === game.userClubId;
          return (
            <div key={p.id} className="flex items-stretch gap-1.5" data-testid={`search-row-${p.id}`}>
              <button
                onClick={() => onOpenPlayer(p.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}>{p.pos}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{shortName(p.name)}</span>
                    <span className="block text-[11px] text-muted-foreground tnum">
                      age {p.age} · {game.clubs.find((c) => c.id === p.clubId)?.short ?? "free agent"} ·{" "}
                      {est.exactOvr !== null
                        ? `OVR ${est.exactOvr}`
                        : est.ovrRange
                          ? `OVR ~${est.ovrRange[0]}–${est.ovrRange[1]}`
                          : "no report"}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-extrabold tnum">
                    {myPlayer
                      ? money(marketValue(p))
                      : est.valueRange
                        ? `${money(est.valueRange[0])}${est.valueRange[0] === est.valueRange[1] ? "" : `–${money(est.valueRange[1])}`}`
                        : "—"}
                  </span>
                  <span className="block text-[9px] font-bold text-muted-foreground tnum">{knowledgeOf(game, p.id)}% known</span>
                </span>
              </button>
              <button
                data-testid={`compare-${p.id}`}
                onClick={() => toggleCompare(p.id)}
                className={`grid w-11 shrink-0 place-items-center rounded-lg border text-[10px] font-bold ${
                  compare.includes(p.id) ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"
                }`}
                aria-label={`Compare ${p.name}`}
              >
                ⇄
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SEASON_STATS: { key: "apps" | "goals" | "assists" | "mins" | "yellows" | "reds"; label: string }[] = [
  { key: "apps", label: "Apps" },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "mins", label: "Minutes" },
  { key: "yellows", label: "Yellows" },
  { key: "reds", label: "Reds" }
];

const ATTR_LABELS: { key: keyof Player["attrs"]; label: string }[] = [
  { key: "pace", label: "Pace" },
  { key: "shooting", label: "Shooting" },
  { key: "passing", label: "Passing" },
  { key: "defending", label: "Defending" },
  { key: "physical", label: "Physical" },
  { key: "reflexes", label: "Reflexes" },
  { key: "handling", label: "Handling" }
];

function CompareRows({ pair }: { pair: Player[] }) {
  const game = useGame((s) => s.game)!;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {pair.map((p) => {
          const est = estimateFor(game, p);
          return (
            <div key={p.id} className="min-w-0 rounded-lg border border-border p-2">
              <div className="truncate text-[12px] font-bold">{shortName(p.name)}</div>
              <div className="text-[10px] text-muted-foreground tnum">
                {p.pos} · age {p.age} · {game.clubs.find((c) => c.id === p.clubId)?.short ?? "free"}
              </div>
              <div className="text-[10px] text-muted-foreground tnum">
                {est.exactOvr !== null ? `OVR ${est.exactOvr}` : est.ovrRange ? `OVR ~${est.ovrRange[0]}–${est.ovrRange[1]}` : "no report"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1">
        {ATTR_LABELS.map(({ key, label }) => {
          const known = pair.map((p) => estimateFor(game, p).attrs?.[key]);
          if (known.every((v) => v === undefined)) return null;
          return (
            <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] font-semibold">
              <span className="tnum text-right">{known[0] ?? "—"}</span>
              <span className="w-20 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
              <span className="tnum">{known[1] ?? (known.length > 1 ? "—" : "")}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-1 border-t border-border pt-2">
        {SEASON_STATS.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] font-semibold">
            <span className="tnum text-right">{pair[0][key] ?? 0}</span>
            <span className="w-20 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="tnum">{pair[1] ? (pair[1][key] ?? 0) : ""}</span>
          </div>
        ))}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] font-semibold">
          <span className="tnum text-right">{money(pair[0].contract.wage)}</span>
          <span className="w-20 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Wage</span>
          <span className="tnum">{pair[1] ? money(pair[1].contract.wage) : ""}</span>
        </div>
      </div>
    </div>
  );
}

/** Everyone at your club, for a quick same-squad scan. */
export const mySquad = (game: NonNullable<ReturnType<typeof useGame.getState>["game"]>): Player[] =>
  squadOf(game.players, game.userClubId).sort((a, b) => overallFor(b) - overallFor(a));
