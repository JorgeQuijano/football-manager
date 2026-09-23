import { useMemo, useRef, useState } from "react";
import type { FormationSlot, Position, RoleId } from "@/engine";
import { clampToZone, ROLE_DEFS, ROLE_GROUPS, scratchSlots, SLOT_ZONES, validateFormation, laneFits } from "@/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useGame } from "@/state/store";
import { posChip } from "@/ui/format";

const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];
const POS_LABEL: Record<Position, string> = {
  GK: "Goalkeeper",
  DF: "Defender",
  MF: "Midfielder",
  FW: "Forward"
};
const ZONE_HINTS: Record<Position, string> = {
  GK: "Stays in the box — goalkeepers never leave it.",
  DF: "Defensive band: your box up to the halfway line.",
  MF: "Middle third only.",
  FW: "Attacking third only."
};

interface DragState {
  idx: number;
  sx: number;
  sy: number;
  active: boolean;
}

export function Builder() {
  const game = useGame((s) => s.game)!;
  const builderFor = useGame((s) => s.builderFor);
  const setBuilderFor = useGame((s) => s.setBuilderFor);
  const saveCustomFormation = useGame((s) => s.saveCustomFormation);
  const setScreen = useGame((s) => s.setScreen);

  const editing = builderFor ? game.customFormations.find((f) => f.id === builderFor) : undefined;
  const [id] = useState(() => editing?.id ?? `cf-${Date.now().toString(36)}`);
  const [name, setName] = useState(() => editing?.name ?? "");
  const [slots, setSlots] = useState<FormationSlot[]>(() =>
    editing ? editing.slots.map((s) => ({ ...s })) : scratchSlots()
  );
  const [posSheet, setPosSheet] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const c: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
    for (const s of slots) c[s.pos]++;
    return c;
  }, [slots]);

  const errors = validateFormation({ id, name, slots });

  const sheetSlot = posSheet !== null ? slots[posSheet] : null;
  const sheetRoles = useMemo(() => {
    if (!sheetSlot) return [];
    return [...ROLE_GROUPS[sheetSlot.pos]].sort(
      (a, b) => Number(laneFits(b, sheetSlot)) - Number(laneFits(a, sheetSlot))
    );
  }, [sheetSlot]);

  const onDown = (e: React.PointerEvent<HTMLButtonElement>, idx: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { idx, sx: e.clientX, sy: e.clientY, active: false };
    setDragIdx(idx);
  };

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || !pitchRef.current) return;
    const moved = Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy);
    if (!d.active && moved > 10) d.active = true;
    if (!d.active) return;
    const r = pitchRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - r.left) / r.width) * 100;
    const rawY = ((e.clientY - r.top) / r.height) * 100;
    setSlots((prev) =>
      prev.map((s, j) => (j === d.idx ? { ...s, ...clampToZone(s.pos, rawX, rawY) } : s))
    );
  };

  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragIdx(null);
    if (d && !d.active) setPosSheet(d.idx);
  };

  const setSlotPos = (pos: Position) => {
    if (posSheet === null) return;
    setSlots((prev) =>
      prev.map((s, j) => {
        if (j !== posSheet) return s;
        const role = s.role && ROLE_GROUPS[pos].includes(s.role) ? s.role : undefined;
        return { ...s, pos, ...clampToZone(pos, s.x, s.y), role };
      })
    );
  };

  const setSlotRole = (role: RoleId | null) => {
    if (posSheet === null) return;
    setSlots((prev) =>
      prev.map((s, j) => (j === posSheet ? { ...s, role: role ?? undefined } : s))
    );
  };

  const save = () => {
    if (errors.length) return;
    const fallbackName = `Custom ${game.customFormations.length + 1}`;
    saveCustomFormation({
      id,
      name: name.trim() || fallbackName,
      slots: slots.map((s) => ({ ...s }))
    });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <button
          className="text-sm font-semibold text-muted-foreground"
          data-testid="bf-back"
          onClick={() => {
            setBuilderFor(null);
            setScreen("tactics");
          }}
        >
          ‹ Tactics
        </button>
        <h1 className="text-base font-bold">{editing ? "Edit formation" : "New formation"}</h1>
        <span className="w-14" />
      </div>

      <input
        value={name}
        data-testid="bf-name"
        maxLength={18}
        placeholder="Formation name (optional)"
        onChange={(e) => setName(e.target.value)}
        className="mb-3 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
      />

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="tnum font-semibold" data-testid="bf-count">
              GK {counts.GK} · DF {counts.DF} · MF {counts.MF} · FW {counts.FW}
            </span>
            <button
              className="font-semibold text-muted-foreground"
              data-testid="bf-reset"
              onClick={() => setSlots(scratchSlots())}
            >
              Reset
            </button>
          </div>

          <div
            ref={pitchRef}
            className="relative w-full touch-none select-none overflow-hidden rounded-2xl border border-border bg-[#0C1B14]"
            style={{ aspectRatio: "0.82" }}
          >
            <div className="pointer-events-none absolute inset-0 opacity-[0.18]">
              <div className="absolute left-0 right-0 top-1/2 h-px bg-primary" />
              <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary" />
              <div className="absolute left-1/2 top-0 h-9 w-36 -translate-x-1/2 border-x border-b border-primary" />
              <div className="absolute bottom-0 left-1/2 h-9 w-36 -translate-x-1/2 border-x border-t border-primary" />
            </div>

            {dragIdx !== null &&
              (() => {
                const z = SLOT_ZONES[slots[dragIdx].pos];
                return (
                  <div
                    data-testid="bf-zone"
                    className="pointer-events-none absolute left-0 right-0 border-y border-dashed border-primary/50 bg-primary/10"
                    style={{ top: `${z.yMin}%`, height: `${z.yMax - z.yMin}%` }}
                  />
                );
              })()}

            {slots.map((slot, i) => (
              <button
                key={i}
                data-testid={`bf-slot-${i}`}
                onPointerDown={(e) => onDown(e, i)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: "clamp(48px, 16vw, 64px)",
                  touchAction: "none"
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card/95 px-0.5 pb-1 pt-1.5 text-center ${
                  dragIdx === i ? "z-10 scale-110 ring-2 ring-primary" : ""
                } ${posSheet === i ? "ring-2 ring-primary" : ""}`}
              >
                <span
                  className={`block rounded px-1 py-0.5 text-[10px] font-bold ${posChip[slot.pos]}`}
                >
                  {slot.pos}
                </span>
                <span className="mt-0.5 block text-[9px] leading-tight text-muted-foreground tnum">
                  {slot.role ? ROLE_DEFS[slot.role].short : i + 1}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Slots stay in their position's zone · drag to move within it · tap for position &amp; role
          </p>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <p
          className="mt-3 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-soft)] px-3 py-2 text-xs text-[var(--warn)]"
          data-testid="bf-error"
        >
          {errors[0]}
        </p>
      )}

      <Button
        className="mt-3 h-11 w-full"
        data-testid="bf-save"
        disabled={errors.length > 0}
        onClick={save}
      >
        Save formation
      </Button>

      <Sheet open={posSheet !== null} onOpenChange={(o) => !o && setPosSheet(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Slot {posSheet !== null ? posSheet + 1 : ""}</SheetTitle>
            <SheetDescription>Exactly one goalkeeper is required.</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-1.5 px-4 pt-1">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                data-testid={`bf-pos-${pos}`}
                onClick={() => setSlotPos(pos)}
                className={`rounded-lg border px-1 py-3 text-[11px] font-bold ${
                  sheetSlot?.pos === pos
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {POS_LABEL[pos]}
              </button>
            ))}
          </div>
          {sheetSlot && (
            <p className="px-4 pt-1.5 text-[10px] text-muted-foreground" data-testid="bf-zone-hint">
              {ZONE_HINTS[sheetSlot.pos]}
            </p>
          )}

          {sheetSlot && (
            <div className="px-4 pb-6 pt-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Default role
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  data-testid="bf-role-auto"
                  onClick={() => setSlotRole(null)}
                  className={`shrink-0 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${
                    !sheetSlot.role
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  Auto
                </button>
                {sheetRoles.map((r) => (
                  <button
                    key={r}
                    data-testid={`bf-role-${r}`}
                    onClick={() => setSlotRole(r)}
                    className={`shrink-0 rounded-lg border px-2.5 py-2 text-[11px] font-bold ${
                      sheetSlot.role === r
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {ROLE_DEFS[r].short}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                {sheetSlot.role
                  ? `${ROLE_DEFS[sheetSlot.role].label} — ${ROLE_DEFS[sheetSlot.role].desc}`
                  : "Auto picks the best-fit role for where this slot sits."}
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
