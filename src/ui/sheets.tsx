import { useRef, useState } from "react";
import type { Position } from "@/engine";
import { isAvailable, overallFor, squadOf, suitability } from "@/engine";
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
import { posChip } from "@/ui/format";

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
                Set your line-up and mentality in Tactics, then hit Continue to
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
                {p.pos} · age {p.age} · {p.apps} apps · {p.goals} goals
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
  picker: { kind: "xi" | "bench"; index: number; slotPos: Position } | null;
  onClose: () => void;
}) {
  const game = useGame((s) => s.game)!;
  const assignPlayer = useGame((s) => s.assignPlayer);
  const clearSlot = useGame((s) => s.clearSlot);

  const squad = squadOf(game.players, game.userClubId);
  const lineup = game.lineup;
  const current = picker
    ? (picker.kind === "xi" ? lineup.starters : lineup.bench)[picker.index]
    : null;
  const slotPos: Position = picker?.slotPos ?? "MF";
  const sorted = [...squad].sort(
    (a, b) =>
      overallFor(b) * suitability(b, slotPos) - overallFor(a) * suitability(a, slotPos)
  );
  const inLineup = new Set(
    [...lineup.starters, ...lineup.bench].filter((id): id is string => id !== null)
  );

  return (
    <Sheet open={!!picker} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pick a player</SheetTitle>
          <SheetDescription>{slotPos} slot — best fits first</SheetDescription>
        </SheetHeader>
        <div className="space-y-1.5 px-4 pb-8">
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
            return (
              <button
                key={p.id}
                data-testid={`pick-${p.id}`}
                disabled={!available}
                onClick={() => {
                  if (picker) assignPlayer(picker.kind, picker.index, p.id);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left ${
                  available ? "active:bg-secondary" : "opacity-40"
                }`}
              >
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}>
                  {p.pos}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {fitted ? "In line-up · " : ""}
                    {p.injuredWeeks > 0
                      ? `Injured (${p.injuredWeeks})`
                      : p.suspension > 0
                        ? "Suspended"
                        : `Cond ${p.condition}%`}
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
