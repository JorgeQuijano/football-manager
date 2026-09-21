import { useState } from "react";
import type { FormationId, Mentality, Player, Position, RoleId } from "@/engine";
import {
  attackStrength,
  autoLineup,
  defenseStrength,
  defaultRoleFor,
  FORMATION_COORDS,
  FORMATIONS,
  FORMATION_IDS,
  isAvailable,
  overallFor,
  ROLE_DEFS,
  squadOf,
  T,
  validateLineup
} from "@/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useGame } from "@/state/store";
import { condColor, fitLevel, shortName } from "@/ui/format";
import { PlayerPickerSheet } from "@/ui/sheets";

const MENTALITIES: Array<{ id: Mentality; label: string }> = [
  { id: "def", label: "Defensive" },
  { id: "bal", label: "Balanced" },
  { id: "att", label: "Attacking" }
];

type Picker = { kind: "xi" | "bench"; index: number; slotPos: Position } | null;
type Sel = { kind: "xi" | "bench"; index: number } | null;

export function Tactics() {
  const game = useGame((s) => s.game)!;
  const setFormation = useGame((s) => s.setFormation);
  const setMentality = useGame((s) => s.setMentality);
  const autoPick = useGame((s) => s.autoPick);
  const applySuggestions = useGame((s) => s.applySuggestions);
  const swapSlots = useGame((s) => s.swapSlots);
  const [picker, setPicker] = useState<Picker>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [note, setNote] = useState<string | null>(null);

  const squad = squadOf(game.players, game.userClubId);
  const byId = new Map(squad.map((p) => [p.id, p] as const));
  const lineup = game.lineup;
  const slots = FORMATIONS[lineup.formation];
  const coords = FORMATION_COORDS[lineup.formation];
  const problems = validateLineup(squad, lineup);
  const club = game.clubs.find((c) => c.id === game.userClubId)!;

  const xiPlayers: Player[] = [];
  const xiRoles: RoleId[] = [];
  lineup.starters.forEach((id, i) => {
    const p = id ? byId.get(id) : undefined;
    if (p) {
      xiPlayers.push(p);
      xiRoles.push(lineup.roles[i] ?? defaultRoleFor(p.pos));
    }
  });
  const myAtt = Math.round(attackStrength(xiPlayers, xiRoles, lineup.mentality));
  const myDef = Math.round(defenseStrength(xiPlayers, xiRoles, lineup.mentality));
  const myAvg = xiPlayers.length
    ? Math.round(xiPlayers.reduce((a, p) => a + overallFor(p), 0) / xiPlayers.length)
    : 0;

  const fx = game.fixtures.find(
    (f) => !f.played && (f.homeId === game.userClubId || f.awayId === game.userClubId)
  );
  const oppClub = fx
    ? game.clubs.find((c) => c.id === (fx.homeId === game.userClubId ? fx.awayId : fx.homeId))
    : undefined;
  let opp = null as null | { short: string; att: number; def: number; avg: number; home: boolean };
  if (fx && oppClub) {
    const oppSquad = squadOf(game.players, oppClub.id);
    const ol = autoLineup(oppSquad, oppClub.formation);
    const oppXi = ol.starters
      .map((id) => (id ? oppSquad.find((p) => p.id === id) : undefined))
      .filter((p): p is Player => !!p);
    opp = {
      short: oppClub.short,
      att: Math.round(attackStrength(oppXi, ol.roles, "bal")),
      def: Math.round(defenseStrength(oppXi, ol.roles, "bal")),
      avg: oppXi.length
        ? Math.round(oppXi.reduce((a, p) => a + overallFor(p), 0) / oppXi.length)
        : 0,
      home: fx.homeId === game.userClubId
    };
  }

  const tiredIdxs = lineup.starters
    .map((id, i) => {
      const p = id ? byId.get(id) : undefined;
      return p && (!isAvailable(p) || p.condition < T.tiredThreshold) ? i : -1;
    })
    .filter((i) => i >= 0);

  const onSlotTap = (kind: "xi" | "bench", index: number, slotPos: Position) => {
    if (!swapMode) {
      setPicker({ kind, index, slotPos });
      return;
    }
    if (!sel) {
      setSel({ kind, index });
      return;
    }
    if (sel.kind === kind && sel.index === index) {
      setSel(null);
      return;
    }
    swapSlots(sel, { kind, index });
    setSel(null);
  };

  const runAuto = (mode: "best" | "freshest") => {
    const changes = autoPick(mode);
    setNote(
      `${mode === "best" ? "Best XI" : "Freshest XI"} applied · ${changes} ${
        changes === 1 ? "change" : "changes"
      }`
    );
  };

  const runRest = () => {
    const changes = applySuggestions();
    setNote(
      changes > 0
        ? `${changes} tired ${changes === 1 ? "player" : "players"} rested`
        : "No better options on the bench"
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Tactics</h1>
        <p className="text-xs text-muted-foreground">
          Tap a slot to change player or role — auto-fixed at kick-off
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <div>
          <label className="eyebrow" htmlFor="formation">
            Formation
          </label>
          <select
            id="formation"
            data-testid="formation"
            value={lineup.formation}
            onChange={(e) => setFormation(e.target.value as FormationId)}
            className="mt-1 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none"
          >
            {FORMATION_IDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="auto-pick"
            className="flex h-10 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-semibold text-secondary-foreground active:bg-secondary/80"
          >
            Auto pick
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem data-testid="auto-best" onClick={() => runAuto("best")}>
              Best XI
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="auto-fresh" onClick={() => runAuto("freshest")}>
              Freshest XI (rest tired)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {note && (
        <p className="text-xs text-muted-foreground" data-testid="note">
          {note}
        </p>
      )}

      <div className="grid grid-cols-3 rounded-xl border border-border p-1 text-xs font-semibold">
        {MENTALITIES.map((m) => (
          <button
            key={m.id}
            data-testid={`mentality-${m.id}`}
            onClick={() => setMentality(m.id)}
            className={`rounded-lg py-3 transition-colors ${
              lineup.mentality === m.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-2 p-3 text-xs">
          <div className="eyebrow">Next up</div>
          <div className="flex items-center justify-between">
            <span className="font-bold">
              {club.short} <span className="font-medium text-muted-foreground">(you)</span>
            </span>
            <span className="tnum">
              att <b>{myAtt}</b> · def <b>{myDef}</b> · avg{" "}
              <b>{myAvg}</b>
            </span>
          </div>
          {opp && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>
                {opp.short} <span className="font-medium">({opp.home ? "home" : "away"})</span>
              </span>
              <span className="tnum">
                att {opp.att} · def {opp.def} · avg {opp.avg}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Line-up · {lineup.formation}</span>
            <Button
              size="sm"
              variant={swapMode ? "default" : "secondary"}
              className="h-8 px-3 text-xs"
              data-testid="swap-mode"
              onClick={() => {
                setSwapMode(!swapMode);
                setSel(null);
              }}
            >
              {swapMode ? "Swapping…" : "Swap"}
            </Button>
          </div>

          <div
            className="relative w-full overflow-hidden rounded-2xl border border-border bg-[#0C1B14]"
            style={{ aspectRatio: "0.82" }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
              <div className="absolute left-0 right-0 top-1/2 h-px bg-primary" />
              <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary" />
              <div className="absolute left-1/2 top-0 h-9 w-36 -translate-x-1/2 border-x border-b border-primary" />
              <div className="absolute bottom-0 left-1/2 h-9 w-36 -translate-x-1/2 border-x border-t border-primary" />
            </div>

            {slots.map((pos, i) => {
              const [x, y] = coords[i];
              const id = lineup.starters[i];
              const p = id ? byId.get(id) : undefined;
              const role = lineup.roles[i] ?? defaultRoleFor(pos);
              const fit = p ? fitLevel(p, pos) : "nat";
              const isSel = sel?.kind === "xi" && sel.index === i;
              const unavailable = p && !isAvailable(p);
              return (
                <button
                  key={i}
                  data-testid={`slot-xi-${i}`}
                  onClick={() => onSlotTap("xi", i, pos)}
                  style={{ left: `${x}%`, top: `${y}%`, width: "clamp(46px, 15vw, 64px)" }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-0.5 pb-1 pt-1.5 text-center ${
                    p ? "bg-card/95" : "border-dashed bg-card/60"
                  } ${p && fit === "ok" ? "border-[#FFB020]" : ""} ${
                    p && fit === "poor" ? "border-[#FF6157]" : ""
                  } ${p && fit === "nat" ? "border-border" : ""} ${
                    isSel ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <span
                    className={`block max-w-full truncate text-[10px] font-bold leading-tight ${
                      unavailable ? "text-[#FF6157]" : ""
                    }`}
                  >
                    {p ? shortName(p.name) : pos}
                  </span>
                  {p ? (
                    <>
                      <span className="block truncate text-[9px] leading-tight text-muted-foreground">
                        {ROLE_DEFS[role].short} · {overallFor(p)}
                      </span>
                      <span className="mt-0.5 block h-[3px] w-full overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${p.condition}%`,
                            background: condColor(p.condition)
                          }}
                        />
                      </span>
                    </>
                  ) : (
                    <span className="block text-[9px] text-muted-foreground">empty</span>
                  )}
                </button>
              );
            })}
          </div>

          {swapMode && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Tap two slots to swap them — bench included
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="eyebrow mb-1.5">Bench</div>
        <div className="grid grid-cols-4 gap-1.5">
          {lineup.bench.map((id, i) => {
            const p = id ? byId.get(id) : undefined;
            const isSel = sel?.kind === "bench" && sel.index === i;
            const unavailable = p && !isAvailable(p);
            return (
              <button
                key={i}
                data-testid={`slot-bench-${i}`}
                onClick={() => onSlotTap("bench", i, p?.pos ?? "MF")}
                className={`flex h-13 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1 text-center ${
                  p ? "border-border bg-secondary/60" : "border-dashed border-border bg-transparent"
                } ${isSel ? "ring-2 ring-primary" : ""}`}
              >
                <span
                  className={`block max-w-full truncate text-[10px] font-bold leading-tight ${
                    unavailable ? "text-[#FF6157]" : ""
                  }`}
                >
                  {p ? shortName(p.name) : "—"}
                </span>
                {p ? (
                  <>
                    <span className="block text-[9px] leading-tight text-muted-foreground tnum">
                      {unavailable
                        ? p.injuredWeeks > 0
                          ? "injured"
                          : "susp."
                        : overallFor(p)}
                    </span>
                    <span className="mt-0.5 block h-[3px] w-full overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${p.condition}%`, background: condColor(p.condition) }}
                      />
                    </span>
                  </>
                ) : (
                  <span className="block text-[9px] text-muted-foreground">empty</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tiredIdxs.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-3 py-2">
          <p className="text-xs text-[#FFB020]">
            {tiredIdxs.length === 1
              ? "1 starter looks tired or unavailable"
              : `${tiredIdxs.length} starters look tired or unavailable`}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 shrink-0 px-3 text-xs"
            data-testid="rest-tired"
            onClick={runRest}
          >
            Rest them
          </Button>
        </div>
      )}

      {problems.length > 0 && (
        <p className="rounded-xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-3 py-2 text-xs text-[#FFB020]">
          {problems[0]} — it will be auto-fixed at kick-off if you press Continue.
        </p>
      )}

      <PlayerPickerSheet picker={picker} onClose={() => setPicker(null)} />
    </div>
  );
}
