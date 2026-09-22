import { useRef, useState } from "react";
import type { FormationSlot, Player, Position, RoleId } from "@/engine";
import {
  autoLineup,
  builtinFormation,
  defaultRoleFor,
  estimateFor,
  isAvailable,
  knowledgeOf,
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
import { ATTR_KEYS, ATTR_LABEL, ATTR_SHORT } from "@/engine";
import type { AttrKey } from "@/engine";
import { FORM_BANDS, formBandFor, formOf, rating1, ratingAvg } from "@/engine";
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
import { Stars } from "@/ui/Scouting";

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
  onClose,
  onScout
}: {
  playerId: string | null;
  onClose: () => void;
  onScout?: (id: string) => void;
}) {
  const game = useGame((s) => s.game)!;
  const setFocus = useGame((s) => s.setFocus);
  const toggleShortlist = useGame((s) => s.toggleShortlist);
  const p = playerId ? game.players.find((x) => x.id === playerId) : undefined;
  const est = p ? estimateFor(game, p) : null;
  const isOwn = !!p && p.clubId === game.userClubId;
  const lvl = p ? knowledgeOf(game, p.id) : 0;
  const fogged = !!est && !isOwn && est.tier !== "extensive";

  return (
    <Sheet open={!!p} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        {p && est && (
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
                <span className="flex items-center gap-2">
                  {!isOwn && <Stars value={est.stars} range={est.starsRange} />}
                  <span className="text-2xl font-extrabold tnum" data-testid="sheet-ovr">
                    {est.exactOvr !== null
                      ? est.exactOvr
                      : est.ovrRange
                        ? `~${est.ovrRange[0]}–${est.ovrRange[1]}`
                        : "?"}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">OVR</span>
                  </span>
                </span>
              </div>

              {!isOwn && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5" data-testid="sheet-scouting">
                  <span className="min-w-0 text-[11px] font-semibold text-muted-foreground">
                    {est.tier === "none"
                      ? "No report — your club knows nothing about him."
                      : `${est.tier === "brief" ? "Brief" : est.tier === "detailed" ? "Detailed" : "Extensive"} report${
                          est.scoutName ? ` · ${est.scoutName}` : ""
                        } · ${lvl}%`}
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-11"
                      data-testid="sheet-scout-btn"
                      onClick={() => onScout?.(p.id)}
                    >
                      Scout
                    </Button>
                    <Button
                      size="sm"
                      variant={game.scouting.shortlist.includes(p.id) ? "secondary" : "outline"}
                      className="h-11"
                      data-testid="sheet-star-btn"
                      onClick={() => toggleShortlist(p.id)}
                    >
                      ★
                    </Button>
                  </span>
                </div>
              )}

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
                  <div className="text-sm font-extrabold tnum" data-testid="sheet-value">
                    {est.valueRange
                      ? est.valueRange[0] === est.valueRange[1]
                        ? money(est.valueRange[0])
                        : `${money(est.valueRange[0])}–${money(est.valueRange[1])}`
                      : "?"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Wages
                  </div>
                  <div className="text-sm font-extrabold tnum" data-testid="sheet-wage">
                    {est.wageRange
                      ? est.wageRange[0] === est.wageRange[1]
                        ? money(est.wageRange[0])
                        : `~${money(est.wageRange[0])}`
                      : "?"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Contract
                  </div>
                  <div className="text-sm font-extrabold">
                    {isOwn || !fogged
                      ? p.clubId === "" ? "Free" : p.contract.until <= game.season ? "Expires" : `S${p.contract.until}`
                      : lvl >= 50
                        ? p.contract.until <= game.season
                          ? "Expiring?"
                          : "Under contract"
                        : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-card p-3" data-testid="player-stats">
                <div className="flex items-baseline justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">This season</span>
                  <span className="tnum">
                    Avg {rating1(ratingAvg(p))}
                    {formOf(p) !== null && (
                      <span
                        className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          background: `${FORM_BANDS[formBandFor(formOf(p)!)].tint}22`,
                          color: FORM_BANDS[formBandFor(formOf(p)!)].tint
                        }}
                      >
                        Form {FORM_BANDS[formBandFor(formOf(p)!)].label}
                      </span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {(
                    [
                      ["Apps", `${p.apps}`],
                      ["Minutes", `${p.mins ?? 0}`],
                      ["Goals", `${p.goals}`],
                      ["Assists", `${p.assists}`],
                      ["Cards", `${p.yellows ?? 0}Y${p.reds ? ` ${p.reds}R` : ""}`],
                      ["Rating", rating1(ratingAvg(p))]
                    ] as Array<[string, string]>
                  ).map(([label, value]) => (
                    <div key={label} className="rounded bg-background/60 py-1">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </div>
                      <div className="text-sm font-extrabold tnum">{value}</div>
                    </div>
                  ))}
                </div>
                {(p.form ?? []).length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Form
                    </span>
                    <span className="flex gap-1">
                      {(p.form ?? []).slice(0, 6).map((r, i) => {
                        const tint = FORM_BANDS[formBandFor(r)].tint;
                        return (
                          <span
                            key={i}
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold tnum"
                            style={{ background: `${tint}22`, color: tint }}
                          >
                            {r.toFixed(1)}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                )}
                {(p.history ?? []).length > 0 && (
                  <div className="space-y-1 border-t border-border pt-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Recent matches
                    </div>
                    {(p.history ?? []).slice(0, 5).map((h, i) => {
                      const tint = h.rt ? FORM_BANDS[formBandFor(h.rt)].tint : "#8B98A5";
                      return (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">
                            {h.h ? "vs" : "@"} {h.opp}
                            <span className="opacity-70"> · S{h.se} R{h.r}</span>
                          </span>
                          <span className="text-muted-foreground">
                            {h.m}&#39;
                            {h.g > 0 && <span className="text-foreground"> · {h.g}G</span>}
                            {h.a > 0 && <span className="text-foreground"> · {h.a}A</span>}
                          </span>
                          <span className="w-8 text-right font-bold tnum" style={{ color: tint }}>
                            {h.rt ? h.rt.toFixed(1) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                className="space-y-2 rounded-lg border border-border bg-card p-3"
                data-testid="player-dev"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Development</span>
                  <span className="tnum">
                    {isOwn || !fogged
                      ? `POT ${p.peak} · +${Math.max(0, p.peak - overallFor(p))} room`
                      : est.potRange
                        ? `POT ~${est.potRange[0]}–${est.potRange[1]}${est.potStars !== null ? ` (${est.potStars.toFixed(1)}★)` : ""}`
                        : est.potStars !== null
                          ? `POT ~${est.potStars.toFixed(1)}★`
                          : "POT unknown"}
                  </span>
                </div>
                {ATTR_KEYS.some((k) => ((p.devSeason ?? {})[k] ?? 0) !== 0) && (
                  <div className="flex flex-wrap gap-1">
                    {ATTR_KEYS.filter((k) => ((p.devSeason ?? {})[k] ?? 0) !== 0).map((k) => {
                      const v = (p.devSeason ?? {})[k] ?? 0;
                      return (
                        <span
                          key={k}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tnum ${
                            v > 0 ? "bg-primary/15 text-primary" : "bg-[#FF6B6B]/15 text-[#FF6B6B]"
                          }`}
                        >
                          {v > 0 ? "+" : ""}
                          {v} {ATTR_SHORT[k]}
                        </span>
                      );
                    })}
                  </div>
                )}
                {p.clubId === game.userClubId && (
                  <div>
                    <label
                      className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                      htmlFor="player-focus"
                    >
                      Individual focus
                    </label>
                    <select
                      id="player-focus"
                      data-testid="player-focus"
                      value={p.focus ?? ""}
                      onChange={(e) =>
                        setFocus(p.id, e.target.value === "" ? null : (e.target.value as AttrKey))
                      }
                      className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold"
                    >
                      <option value="">None — train the team unit</option>
                      {ATTR_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {ATTR_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {(isOwn || !fogged) && (p.traits ?? []).length > 0 && (
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
              {!isOwn && fogged && (
                <p className="text-[11px] text-muted-foreground" data-testid="traits-unknown">
                  Traits and personality stay hidden until you have an extensive report.
                </p>
              )}

              {fogged && !est.attrs ? (
                <div className="rounded-lg border border-dashed border-border bg-card p-3 text-[11px] text-muted-foreground" data-testid="attrs-unknown">
                  No attribute read on him yet. {est.tier === "brief" ? "Send a scout for the full picture." : "Scout him from the Market tab."}
                </div>
              ) : (
              <div className="space-y-2" data-testid="attrs-block">
                {(p.pos === "GK"
                  ? ([
                      ["Reflexes", "reflexes"],
                      ["Handling", "handling"],
                      ["Physical", "physical"]
                    ] as Array<[string, AttrKey]>)
                  : ([
                      ["Pace", "pace"],
                      ["Shooting", "shooting"],
                      ["Passing", "passing"],
                      ["Defending", "defending"],
                      ["Physical", "physical"]
                    ] as Array<[string, AttrKey]>)
                ).map(([label, key]) => {
                  const range = est.attrs?.[key];
                  const value = range ? range[1] : p.attrs[key];
                  const lo = range ? range[0] : value;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-20 text-xs text-muted-foreground">{label}</span>
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-primary/35"
                          style={{ width: `${value}%` }}
                        />
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-primary"
                          style={{ width: `${lo}%` }}
                        />
                      </span>
                      <span className="w-14 text-right text-xs font-bold tnum">
                        {range ? (lo === value ? value : `${lo}–${value}`) : value}
                      </span>
                    </div>
                  );
                })}
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
              )}
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
                    {formOf(p) !== null && (
                      <span
                        className="shrink-0 rounded px-1 py-0.5 text-[9px] font-bold tnum"
                        style={{
                          background: `${FORM_BANDS[formBandFor(formOf(p)!)].tint}22`,
                          color: FORM_BANDS[formBandFor(formOf(p)!)].tint
                        }}
                      >
                        ★{rating1(formOf(p))}
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
