import { useState } from "react";
import { Pencil, RotateCcw, Shield } from "lucide-react";
import {
  CLUB_LIMITS,
  cleanCapacity,
  cleanCity,
  cleanFounded,
  cleanGround,
  cleanName,
  cleanShort,
  defaultClub,
  groundCapacity,
  isEdited,
  loreFor
} from "@/engine";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useGame } from "@/state/store";

const field =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary";

/** One club's editable public details. */
function EditSheet({ clubId, onClose }: { clubId: string; onClose: () => void }) {
  const game = useGame((s) => s.game)!;
  const editClub = useGame((s) => s.editClub);
  const resetClub = useGame((s) => s.resetClub);
  const club = game.clubs.find((c) => c.id === clubId)!;
  const def = defaultClub(game, clubId);
  const lore = loreFor(club, clubId);
  const [name, setName] = useState(club.name);
  const [short, setShort] = useState(club.short);
  const [color, setColor] = useState(club.color);
  const [city, setCity] = useState(lore.city);
  const [ground, setGround] = useState(lore.stadium);
  const [founded, setFounded] = useState(String(lore.founded));
  const [capacity, setCapacity] = useState(String(groundCapacity(game, clubId)));

  const save = () => {
    editClub(clubId, {
      name: cleanName(name),
      short: cleanShort(short),
      color,
      city: cleanCity(city),
      ground: cleanGround(ground),
      founded: cleanFounded(Number(founded)),
      capacity: cleanCapacity(Number(capacity))
    });
    onClose();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto pb-[max(env(safe-area-inset-bottom),1rem)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-[#0E1318]"
              style={{ backgroundColor: color }}
            >
              {cleanShort(short) || "—"}
            </span>
            <span className="truncate">{name || club.name}</span>
          </SheetTitle>
          <SheetDescription>
            Public details. Blank a field to hand it back to the club — nothing here touches strength, formation or
            facilities.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Name</span>
            <input
              className={field}
              data-testid="club-edit-name"
              maxLength={CLUB_LIMITS.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Code</span>
              <input
                className={`${field} uppercase`}
                data-testid="club-edit-short"
                maxLength={CLUB_LIMITS.short}
                value={short}
                onChange={(e) => setShort(cleanShort(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase text-muted-foreground">Colour</span>
              <input
                type="color"
                className="h-11 w-full rounded-lg border border-border bg-background px-2"
                data-testid="club-edit-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">City</span>
            <input
              className={field}
              data-testid="club-edit-city"
              maxLength={CLUB_LIMITS.city}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Ground</span>
            <input
              className={field}
              data-testid="club-edit-ground"
              maxLength={CLUB_LIMITS.ground}
              value={ground}
              onChange={(e) => setGround(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Capacity (seats)</span>
            <input
              className={field}
              data-testid="club-edit-capacity"
              type="number"
              inputMode="numeric"
              min={CLUB_LIMITS.capacity[0]}
              max={CLUB_LIMITS.capacity[1]}
              step={100}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              {groundCapacity(game, clubId).toLocaleString()} today, including what the stadium facility has built.
            </span>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Founded</span>
            <input
              className={field}
              data-testid="club-edit-founded"
              type="number"
              inputMode="numeric"
              min={CLUB_LIMITS.founded[0]}
              max={CLUB_LIMITS.founded[1]}
              value={founded}
              onChange={(e) => setFounded(e.target.value)}
            />
          </label>

          <div className="flex gap-2 pt-1">
            <Button className="h-11 flex-1 font-bold" data-testid="club-edit-save" onClick={save}>
              Save
            </Button>
            <Button variant="outline" className="h-11 shrink-0 px-3" onClick={onClose}>
              Cancel
            </Button>
          </div>
          {def && isEdited(club, game) && (
            <Button
              variant="ghost"
              className="h-10 w-full text-[12px] font-semibold text-muted-foreground"
              data-testid="club-edit-reset"
              onClick={() => {
                resetClub(clubId);
                onClose();
              }}
            >
              <RotateCcw size={13} /> Reset to {def.name}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The league's twenty clubs, with a way into each one (v0.37). */
export function ClubsCard() {
  const game = useGame((s) => s.game)!;
  const [editing, setEditing] = useState<string | null>(null);
  const me = game.userClubId;

  return (
    <section className="rounded-2xl border border-border bg-card p-3" data-testid="clubs-card">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          <Shield size={14} /> The league
        </h2>
        <span className="text-[10px] font-semibold text-muted-foreground">{game.clubs.length} clubs · tap to edit</span>
      </div>

      <ul className="mt-2 space-y-1">
        {game.clubs.map((c) => {
          const lore = loreFor(c, c.id);
          return (
            <li key={c.id}>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left active:bg-muted/60"
                data-testid={`club-row-${c.id}`}
                onClick={() => setEditing(c.id)}
              >
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-full text-[9px] font-extrabold text-[#0E1318]"
                  style={{ backgroundColor: c.color }}
                >
                  {c.short}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold">
                    {c.name}
                    {c.id === me && <span className="ml-1 text-[10px] font-extrabold uppercase text-primary">you</span>}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {lore.city} · {lore.stadium} · {groundCapacity(game, c.id).toLocaleString()} seats
                  </span>
                </span>
                <Pencil size={12} className="shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>

      {editing && <EditSheet clubId={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}
