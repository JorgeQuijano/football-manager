import type { CornerRoutine, FreeKickRoutine, Player } from "@/engine";
import {
  CORNER_ROUTINES,
  FK_ROUTINES,
  familiarityOf,
  hasTrait,
  overallFor,
  squadOf
} from "@/engine";
import { posChip } from "@/ui/format";
import { useGame } from "@/state/store";

function FamBar({ value }: { value: number }) {
  const tint = value >= 80 ? "#2ED573" : value >= 50 ? "#FFB020" : "#FF6B6B";
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full" style={{ width: `${value}%`, background: tint }} />
      </span>
      <span className="w-8 text-right text-[10px] font-bold tnum" style={{ color: tint }}>
        {value}%
      </span>
    </span>
  );
}

function RoutineRow({
  active,
  label,
  blurb,
  fam,
  testId,
  onClick
}: {
  active: boolean;
  label: string;
  blurb: string;
  fam: number;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <span
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
          active ? "border-primary" : "border-muted-foreground/50"
        }`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-bold ${active ? "text-primary" : ""}`}>{label}</span>
          <FamBar value={fam} />
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{blurb}</span>
      </span>
    </button>
  );
}

export function SetPieces() {
  const game = useGame((s) => s.game)!;
  const setScreen = useGame((s) => s.setScreen);
  const setRoutine = useGame((s) => s.setRoutine);
  const setTaker = useGame((s) => s.setTaker);
  const sp = game.setpieces;

  const squad = squadOf(game.players, game.userClubId);
  const takerOptions = squad
    .slice()
    .sort(
      (a, b) =>
        Number(hasTrait(b, "dead_ball")) - Number(hasTrait(a, "dead_ball")) ||
        overallFor(b) - overallFor(a)
    );
  const nameOf = (id: string | null) => {
    const p = id ? game.players.find((x) => x.id === id) : undefined;
    return p ? `${p.name} (${p.pos})${hasTrait(p, "dead_ball") ? " ★" : ""}` : "Auto — best available";
  };

  const TakerSelect = ({
    kind,
    label,
    testId
  }: {
    kind: "corner" | "freekick" | "penalty";
    label: string;
    testId: string;
  }) => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        data-testid={testId}
        value={sp.takers[kind] ?? ""}
        onChange={(e) => setTaker(kind, e.target.value === "" ? null : e.target.value)}
        className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold"
      >
        <option value="">Auto — best available</option>
        {takerOptions.map((p: Player) => (
          <option key={p.id} value={p.id}>
            {nameOf(p.id)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-5" data-testid="setpieces-screen">
      <header className="flex items-center justify-between gap-2">
        <button
          data-testid="sp-back"
          onClick={() => setScreen("tactics")}
          className="text-sm font-bold text-muted-foreground"
        >
          ‹ Tactics
        </button>
        <h1 className="text-lg font-extrabold">Set pieces</h1>
        <span className="w-14" />
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Attacking corners
        </h2>
        {(Object.keys(CORNER_ROUTINES) as CornerRoutine[]).map((r) => (
          <RoutineRow
            key={r}
            active={sp.corner === r}
            label={CORNER_ROUTINES[r].label}
            blurb={CORNER_ROUTINES[r].blurb}
            fam={familiarityOf(sp, "corner", r)}
            testId={`sp-corner-${r}`}
            onClick={() => setRoutine("corner", r)}
          />
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Attacking free kicks
        </h2>
        {(Object.keys(FK_ROUTINES) as FreeKickRoutine[]).map((r) => (
          <RoutineRow
            key={r}
            active={sp.freekick === r}
            label={FK_ROUTINES[r].label}
            blurb={FK_ROUTINES[r].blurb}
            fam={familiarityOf(sp, "freekick", r)}
            testId={`sp-fk-${r}`}
            onClick={() => setRoutine("freekick", r)}
          />
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Takers
        </h2>
        <TakerSelect kind="corner" label="Corner taker" testId="sp-taker-corner" />
        <TakerSelect kind="freekick" label="Free-kick taker" testId="sp-taker-freekick" />
        <TakerSelect kind="penalty" label="Penalty taker" testId="sp-taker-penalty" />
        <p className="text-[10px] leading-snug text-muted-foreground">
          A nominated taker only takes the kick when he is on the pitch — otherwise the best available
          player steps up. ★ = Dead-Ball Specialist trait.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <p className="text-[11px] leading-snug text-muted-foreground">
          <span className="font-bold text-foreground">Familiarity</span> grows every match you play —
          faster if you train <span className="font-bold text-foreground">Set pieces</span>. A new
          routine starts rusty; switch back to a grooved one and it still works.
        </p>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {takerOptions.slice(0, 3).map((p) => (
          <span
            key={p.id}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${posChip[p.pos]}`}
          >
            {p.name}
            {hasTrait(p, "dead_ball") ? " ★" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
