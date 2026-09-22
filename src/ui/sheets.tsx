import { useRef, useState } from "react";
import type { FormationSlot, Player, Position, RoleId } from "@/engine";
import {
  autoLineup,
  builtinFormation,
  defaultRoleFor,
  isAvailable,
  laneFits,
  marketValue,
  money,
  overallFor,
  ROLE_DEFS,
  ROLE_GROUPS,
  slotScoreFor,
  squadOf,
  suitability,
  TRAITS
} from "@/engine";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { exportSaveFile, parseSaveFile } from "@/state/save";
import { useGame } from "@/state/store";
import { posChip, shortName } from "@/ui/format";

export function SettingsSheet({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const game = useGame((s) => s.game)!;
  const resetGame = useGame((s) => s.resetGame);
  const importSave = useGame((s) => s.importSave);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const club = game.clubs.find((c) => c.id === game.userClubId)!;

  const copySeed = async () => {
    try {
      await navigator.clipboard.writeText(String(game.seed));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const save = parseSaveFile(text);
    if (!save) {
      setImportError("That file doesn't look like a Touchline save.");
    } else {
      setImportError(null);
      importSave(save);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>
              {club.name} · Season {game.season} · Round {Math.min(game.round, 18)}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-8 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <div className="font-semibold">Seed</div>
                <div className="text-xs text-muted-foreground">
                  Identifies this save — same seed, same league
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={copySeed}>
                {copied ? "Copied" : String(game.seed)}
              </Button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <div className="font-semibold">App version</div>
                <div className="text-xs text-muted-foreground">
                  New deploys load automatically when the app regains focus
                </div>
              </div>
              <span className="tnum text-sm font-semibold text-muted-foreground" data-testid="app-version">
                {__APP_VERSION__}
              </span>
            </div>

            <Button
              variant="secondary"
              className="h-10 w-full"
              onClick={() => exportSaveFile(game)}
            >
              Export save (JSON)
            </Button>
            <Button
              variant="secondary"
              className="h-10 w-full"
              onClick={() => fileRef.current?.click()}
            >
              Import save…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {importError && <p className="text-xs text-destructive">{importError}</p>}

            <Button
              variant="destructive"
              className="h-10 w-full"
              onClick={() => setConfirmOpen(true)}
            >
              New game (wipe save)
            </Button>

            <div className="space-y-1.5 rounded-xl border border-border p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">How it works</p>
              <p>
                10 clubs, 18 rounds. 3 points for a win, 1 for a draw. Top of the
                table at the end of the season wins the league.
              </p>
              <p>
                Set your line-up, roles and mentality in Tactics, then hit Continue to
                play the next match. The game saves automatically on this device.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start over?</DialogTitle>
            <DialogDescription>
              Your current save will be deleted from this device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                onOpenChange(false);
                resetGame();
              }}
            >
              Delete &amp; start over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PlayerDetailSheet({
  playerId,
  onClose
}: {
  playerId: string | null;
  onClose: () => void;
}) {
  const game = useGame((s) => s.game)!;
  const p = playerId ? game.players.find((x) => x.id === playerId) : undefined;

  return (
    <Sheet open={!!p} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        {p && (
          <>
            <SheetHeader>
              <SheetTitle>{p.name}</SheetTitle>
              <SheetDescription>
                {p.pos} · age {p.age} · {p.apps} app{p.apps === 1 ? "" : "s"} · {p.goals} goal
                {p.goals === 1 ? "" : "s"} · {p.assists} assist{p.assists === 1 ? "" : "s"}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-8">
              <div className="flex items-center justify-between">
                <span className={`rounded-md px-2 py-1 text-xs font-bold ${posChip[p.pos]}`}>
                  {p.pos}
                </span>
                <span className="text-2xl font-extrabold tnum">
                  {overallFor(p)}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">OVR</span>
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                {p.injuredWeeks > 0 && (
                  <span className="rounded-md bg-[#FFB020]/15 px-2 py-1 text-[#FFB020]">
                    Injured · out ~{p.injuredWeeks} {p.injuredWeeks === 1 ? "match" : "matches"}
                  </span>
                )}
                {p.suspension > 0 && (
                  <span className="rounded-md bg-[#FF6157]/15 px-2 py-1 text-[#FF6157]">
                    Suspended
                  </span>
                )}
                {isAvailable(p) && (
                  <span className="rounded-md bg-[#2ED573]/15 px-2 py-1 text-[#2ED573]">
                    Available
                  </span>
                )}
              </div>

              <div
                className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-2 text-center"
                data-testid="player-money"
              >
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Value
                  </div>
                  <div className="text-sm font-extrabold tnum">{money(marketValue(p))}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Wages
                  </div>
                  <div className="text-sm font-extrabold tnum">{money(p.contract.wage)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Contract
                  </div>
                  <div className="text-sm font-extrabold">
                    {p.clubId === "" ? "Free" : p.contract.until <= game.season ? "Expires" : `S${p.contract.until}`}
                  </div>
                </div>
              </div>

              {(p.traits ?? []).length > 0 && (
                <div className="space-y-1.5" data-testid="player-traits">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Traits
                  </div>
                  {(p.traits ?? []).map((t) => (
                    <div
                      key={t}
                      className="rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-2"
                    >
                      <div className="text-[12px] font-bold text-primary">{TRAITS[t].label}</div>
                      <div className="text-[11px] text-muted-foreground">{TRAITS[t].blurb}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {(p.pos === "GK"
                  ? ([
                      ["Reflexes", p.attrs.reflexes],
                      ["Handling", p.attrs.handling],
                      ["Physical", p.attrs.physical]
                    ] as Array<[string, number]>)
                  : ([
                      ["Pace", p.attrs.pace],
                      ["Shooting", p.attrs.shooting],
                      ["Passing", p.attrs.passing],
                      ["Defending", p.attrs.defending],
                      ["Physical", p.attrs.physical]
                    ] as Array<[string, number]>)
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-20 text-xs text-muted-foreground">{label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${value}%` }}
                      />
                    </span>
                    <span className="w-7 text-right text-xs font-bold tnum">{value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 pt-1">
                  <span className="w-20 text-xs text-muted-foreground">Condition</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${p.condition}%` }}
                    />
                  </span>
                  <span className="w-7 text-right text-xs font-bold tnum">{p.condition}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PlayerPickerSheet({
  picker,
  onClose
}: {
  picker: { kind: "xi" | "bench"; index: number; slot: FormationSlot } | null;
  onClose: () => void;
}) {
  const game = useGame((s) => s.game)!;
  const assignPlayer = useGame((s) => s.assignPlayer);
  const clearSlot = useGame((s) => s.clearSlot);
  const setRole = useGame((s) => s.setRole);

  const squad = squadOf(game.players, game.userClubId);
  const lineup = game.lineup;
  const isXi = picker?.kind === "xi";
  const slot = picker?.slot ?? null;
  const slotPos: Position = slot?.pos ?? "MF";
  const role: RoleId = isXi && picker
    ? lineup.roles[picker.index] ?? defaultRoleFor(slotPos)
    : defaultRoleFor(slotPos);
  const currentId = picker
    ? (picker.kind === "xi" ? lineup.starters : lineup.bench)[picker.index] 
    : null;
  const current = currentId ? squad.find((p) => p.id === currentId) : undefined;

  const sorted = [...squad].sort(
    (a, b) => slotScoreFor(b, slotPos, role) - slotScoreFor(a, slotPos, role)
  );
  const topId = sorted[0]?.id;
  const sortedRoles = slot
    ? [...ROLE_GROUPS[slotPos]].sort(
        (a, b) => Number(laneFits(b, slot)) - Number(laneFits(a, slot))
      )
    : [];
  const bestRole = current
    ? ROLE_GROUPS[slotPos].reduce(
        (best, r) =>
          slotScoreFor(current, slotPos, r) > slotScoreFor(current, slotPos, best) ? r : best,
        ROLE_GROUPS[slotPos][0]
      )
    : null;
  const inLineup = new Set(
    [...lineup.starters, ...lineup.bench].filter((id): id is string => id !== null)
  );

  const fx = game.fixtures.find(
    (f) => !f.played && (f.homeId === game.userClubId || f.awayId === game.userClubId)
  );
  const oppClub = fx
    ? game.clubs.find((c) => c.id === (fx.homeId === game.userClubId ? fx.awayId : fx.homeId))
    : undefined;
  let oppLine = "";
  if (oppClub) {
    const oppSquad = squadOf(game.players, oppClub.id);
    const ol = autoLineup(oppSquad, builtinFormation(oppClub.formation));
    const oppXi = ol.starters
      .map((id) => (id ? oppSquad.find((p) => p.id === id) : undefined))
      .filter((p): p is Player => !!p);
    const avg = oppXi.length
      ? Math.round(oppXi.reduce((a, p) => a + overallFor(p), 0) / oppXi.length)
      : 0;
    oppLine = `${oppClub.short} next (avg ${avg})`;
  }

  return (
    <Sheet open={!!picker} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pick a player</SheetTitle>
          <SheetDescription>
            {slotPos} slot — best fits first{oppLine ? ` · ${oppLine}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-1.5 px-4 pb-8">
          {isXi && picker && slot && (
            <div className="mb-2 space-y-1">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {sortedRoles.map((r) => (
                  <button
                    key={r}
                    data-testid={`role-${r}`}
                    onClick={() => setRole(picker.index, r)}
                    className={`shrink-0 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${
                      role === r
                        ? "border-primary bg-primary/15 text-primary"
                        : laneFits(r, slot)
                          ? "border-border text-muted-foreground"
                          : "border-dashed border-border text-muted-foreground/70"
                    }`}
                  >
                    {ROLE_DEFS[r].short}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {ROLE_DEFS[role].label} — {ROLE_DEFS[role].desc}
                {!laneFits(role, slot) && (
                  <span className="text-[#FFB020]"> · off-lane for this slot</span>
                )}
              </p>
              {current && bestRole && bestRole !== role && (
                <p className="text-[10px] text-muted-foreground">
                  Best for {shortName(current.name)}: {ROLE_DEFS[bestRole].label}
                </p>
              )}
            </div>
          )}

          {current && (
            <button
              className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
              onClick={() => {
                clearSlot(picker!.kind, picker!.index);
                onClose();
              }}
            >
              Remove current player
            </button>
          )}

          {sorted.map((p) => {
            const available = isAvailable(p);
            const fitted = inLineup.has(p.id);
            const isCurrent = current ? p.id === current.id : false;
            const delta =
              current && !isCurrent ? overallFor(p) - overallFor(current) : null;
            const topPick = p.id === topId && !isCurrent;
            return (
              <button
                key={p.id}
                data-testid={`pick-${p.id}`}
                disabled={!available}
                onClick={() => {
                  if (picker) assignPlayer(picker.kind, picker.index, p.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${
                  isCurrent ? "border-primary/60" : "border-border"
                } ${available ? "active:bg-secondary" : "opacity-40"}`}
              >
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}>
                  {p.pos}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{p.name}</span>
                    {topPick && (
                      <span className="shrink-0 rounded bg-primary/15 px-1 py-0.5 text-[9px] font-bold text-primary">
                        Top pick
                      </span>
                    )}
                    {isCurrent && (
                      <span className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[9px] font-bold text-muted-foreground">
                        In slot
                      </span>
                    )}
                  </span>
                  {(p.traits ?? []).length > 0 && (
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {(p.traits ?? []).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold text-primary"
                        >
                          {TRAITS[t].short}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {fitted ? "In line-up · " : ""}
                    {p.injuredWeeks > 0
                      ? `Injured (${p.injuredWeeks})`
                      : p.suspension > 0
                        ? "Suspended"
                        : `Cond ${p.condition}%`}
                    {` · Fit ${Math.round(suitability(p, slotPos) * 100)}%`}
                    {delta !== null && current
                      ? ` · Δ ${delta >= 0 ? "+" : ""}${delta}`
                      : ""}
                  </span>
                </span>
                <span className="text-sm font-extrabold tnum">{overallFor(p)}</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
