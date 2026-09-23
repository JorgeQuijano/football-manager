import { useState } from "react";
import type {
  Advice,
  MatchSideState,
  OppInstruction,
  Player,
  PlayerInstruction,
  ShoutKind,
  TalkDef,
  TalkKind,
  TalkStage
} from "@/engine";
import { PRE_TALKS, SHOUTS, oiLabel, piLabel } from "@/engine";
import { posChip, shortName } from "@/ui/format";

/** Segmented control for the match panel sections. */
export function LeverTabs({
  value,
  onChange,
  badge
}: {
  value: "subs" | "instructions" | "opposition" | "talk";
  onChange: (v: "subs" | "instructions" | "opposition" | "talk") => void;
  badge?: number;
}) {
  const tabs: { id: "subs" | "instructions" | "opposition" | "talk"; label: string }[] = [
    { id: "subs", label: "Subs" },
    { id: "instructions", label: "Mine" },
    { id: "opposition", label: "Theirs" },
    { id: "talk", label: "Talk" }
  ];
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl border border-border p-1" data-testid="lever-tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          data-testid={`lever-tab-${t.id}`}
          onClick={() => onChange(t.id)}
          className={`relative min-h-11 rounded-lg px-1 py-1.5 text-[11px] font-bold ${
            value === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground"
          }`}
        >
          {t.label}
          {t.id === "subs" && !!badge && badge > 0 && (
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-[var(--warn)]" />
          )}
        </button>
      ))}
    </div>
  );
}

/** The assistant's niggles. */
export function Nudges({ advice }: { advice: Advice[] }) {
  if (!advice.length) return null;
  return (
    <ul className="space-y-1.5" data-testid="nudges">
      {advice.map((a, i) => (
        <li
          key={`${a.kind}-${a.playerId ?? i}`}
          className="flex items-start gap-2 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-soft)] px-3 py-2 text-[11px] leading-snug"
        >
          <span className="mt-0.5 text-[var(--warn)]">◆</span>
          <span>{a.text}</span>
        </li>
      ))}
    </ul>
  );
}

const selectCls =
  "min-h-11 w-full rounded-lg border border-border bg-card px-1 py-1 text-[10px] font-semibold text-foreground";

/** Per-player instructions for your own XI. */
export function InstructionsPanel({
  side,
  byId,
  onChange,
  values
}: {
  side: MatchSideState;
  byId: (id: string) => Player | undefined;
  values: Record<string, PlayerInstruction>;
  onChange: (playerId: string, pi: PlayerInstruction) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-1" data-testid="instructions-panel">
      <p className="text-[10px] leading-snug text-muted-foreground">
        Instructions change what a player does with the ball — they take effect immediately.
      </p>
      {side.slots.map((id, i) => {
        if (!id) return null;
        const p = byId(id);
        if (!p) return null;
        const pi = values[id] ?? {};
        const isOpen = open === i;
        return (
          <div key={id} className="rounded-lg border border-border">
            <button
              data-testid={`pi-row-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex min-h-11 w-full items-center gap-2 px-2 py-2 text-left text-[12px]"
            >
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${posChip[side.poss[i]]}`}>
                {side.poss[i]}
              </span>
              <span className="flex-1 truncate font-semibold">{p.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {oiLabel(undefined) === "" && piLabel(pi) ? piLabel(pi) : "Default"}
              </span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-3 gap-1.5 px-2 pb-2">
                <label className="text-[9px] font-bold uppercase text-muted-foreground">
                  Shooting
                  <select
                    data-testid={`pi-shooting-${i}`}
                    className={selectCls}
                    value={pi.shooting ?? "normal"}
                    onChange={(e) =>
                      onChange(id, {
                        ...pi,
                        shooting: e.target.value === "normal" ? undefined : (e.target.value as "often" | "rarely")
                      })
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="often">Shoot on sight</option>
                    <option value="rarely">Be selective</option>
                  </select>
                </label>
                <label className="text-[9px] font-bold uppercase text-muted-foreground">
                  Passing
                  <select
                    data-testid={`pi-passing-${i}`}
                    className={selectCls}
                    value={pi.passing ?? "normal"}
                    onChange={(e) =>
                      onChange(id, {
                        ...pi,
                        passing: e.target.value === "normal" ? undefined : (e.target.value as "direct" | "safe")
                      })
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="direct">Play direct</option>
                    <option value="safe">Keep it simple</option>
                  </select>
                </label>
                <label className="text-[9px] font-bold uppercase text-muted-foreground">
                  Freedom
                  <select
                    data-testid={`pi-freedom-${i}`}
                    className={selectCls}
                    value={pi.freedom ?? "normal"}
                    onChange={(e) =>
                      onChange(id, {
                        ...pi,
                        freedom: e.target.value === "normal" ? undefined : (e.target.value as "roam" | "hold")
                      })
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="roam">Roam</option>
                    <option value="hold">Hold position</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Instructions aimed at the opposition. */
export function OppositionPanel({
  theirSlots,
  theirPoss,
  byId,
  values,
  onChange,
  suggestionId
}: {
  theirSlots: (string | null)[];
  theirPoss: MatchSideState["poss"];
  byId: (id: string) => Player | undefined;
  values: Record<string, OppInstruction>;
  onChange: (playerId: string, oi: OppInstruction) => void;
  suggestionId?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-1" data-testid="opposition-panel">
      <p className="text-[10px] leading-snug text-muted-foreground">
        Marking and pressing their danger men costs them chances — and fills your book.
      </p>
      {theirSlots.map((id, i) => {
        if (!id) return null;
        const p = byId(id);
        if (!p) return null;
        const oi = values[id] ?? {};
        const isOpen = open === i;
        const labelled = oiLabel(oi);
        return (
          <div key={id} className="rounded-lg border border-border">
            <button
              data-testid={`oi-row-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex min-h-11 w-full items-center gap-2 px-2 py-2 text-left text-[12px]"
            >
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${posChip[theirPoss[i]]}`}>
                {theirPoss[i]}
              </span>
              <span className="flex-1 truncate font-semibold">
                {shortName(p.name)}
                {suggestionId === id && !labelled && (
                  <span className="ml-1.5 rounded bg-[var(--warn-soft)] px-1 text-[8px] font-bold text-[var(--warn)]">
                    danger man
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{labelled || "None"}</span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-1.5 px-2 pb-2">
                <label className="text-[9px] font-bold uppercase text-muted-foreground">
                  Marking
                  <select
                    data-testid={`oi-mark-${i}`}
                    className={selectCls}
                    value={oi.mark ?? ""}
                    onChange={(e) =>
                      onChange(id, { ...oi, mark: e.target.value === "" ? undefined : (e.target.value as "tight" | "loose") })
                    }
                  >
                    <option value="">None</option>
                    <option value="tight">Tight</option>
                    <option value="loose">Loose</option>
                  </select>
                </label>
                <label className="text-[9px] font-bold uppercase text-muted-foreground">
                  Pressing
                  <select
                    data-testid={`oi-press-${i}`}
                    className={selectCls}
                    value={oi.press ?? ""}
                    onChange={(e) =>
                      onChange(id, { ...oi, press: e.target.value === "" ? undefined : (e.target.value as "often" | "never") })
                    }
                  >
                    <option value="">Normal</option>
                    <option value="often">Press often</option>
                    <option value="never">Stand off</option>
                  </select>
                </label>
                <label className="text-[9px] font-bold uppercase text-muted-foreground">
                  Tackling
                  <select
                    data-testid={`oi-tackle-${i}`}
                    className={selectCls}
                    value={oi.tackle ?? ""}
                    onChange={(e) =>
                      onChange(id, { ...oi, tackle: e.target.value === "" ? undefined : (e.target.value as "hard" | "easy") })
                    }
                  >
                    <option value="">Normal</option>
                    <option value="hard">Get stuck in</option>
                    <option value="easy">Stay on feet</option>
                  </select>
                </label>
                <label className="text-[9px] font-bold uppercase text-muted-foreground">
                  Show
                  <select
                    data-testid={`oi-show-${i}`}
                    className={selectCls}
                    value={oi.show ?? ""}
                    onChange={(e) =>
                      onChange(id, { ...oi, show: e.target.value === "" ? undefined : (e.target.value as "inside" | "outside") })
                    }
                  >
                    <option value="">Neither</option>
                    <option value="inside">Inside</option>
                    <option value="outside">Outside</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Talks and touchline shouts. */
export function TalkPanel({
  stage,
  options,
  onTalk,
  shout,
  shoutsUsed,
  fire,
  shape,
  done
}: {
  /** what is available right now */
  stage: TalkStage | null;
  options: TalkDef[];
  onTalk: (stage: TalkStage, kind: TalkKind) => void;
  shout: (kind: ShoutKind) => void;
  shoutsUsed: number;
  fire: number;
  shape: number;
  done: Record<TalkStage, TalkKind | undefined>;
}) {
  const pct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
  return (
    <div className="space-y-3" data-testid="talk-panel">
      <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-[11px]">
        <span>
          <span className="font-bold uppercase text-muted-foreground">Fire</span>{" "}
          <span className={fire > 0 ? "font-bold text-primary" : "font-semibold text-muted-foreground"}>{pct(fire)}</span>
        </span>
        <span>
          <span className="font-bold uppercase text-muted-foreground">Shape</span>{" "}
          <span className={shape > 0 ? "font-bold text-primary" : "font-semibold text-muted-foreground"}>{pct(shape)}</span>
        </span>
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Team talk
          {stage === "pre" && " · before kick-off"}
          {stage === "ht" && " · half time"}
          {stage === "ft" && " · full time"}
        </div>
        {stage ? (
          <div className="space-y-1.5">
            {options.map((o) => (
              <button
                key={o.kind}
                data-testid={`talk-${o.kind}`}
                onClick={() => onTalk(stage, o.kind)}
                className="min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-[12px] leading-snug"
              >
                <span className="font-semibold">{o.label}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{o.blurb}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {done.ft
              ? "Full time — nothing more to say."
              : done.ht
                ? "You have had your say at half time."
                : "You have had your say for this match."}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Touchline shouts · {shoutsUsed} used
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {SHOUTS.map((s) => (
            <button
              key={s.kind}
              data-testid={`shout-${s.kind}`}
              onClick={() => shout(s.kind)}
              className="min-h-11 rounded-xl border border-border bg-card px-2 py-2 text-[11px] font-semibold"
            >
              {s.label}
            </button>
          ))}
        </div>
        {shoutsUsed >= 2 && (
          <p className="mt-1 text-[10px] text-[var(--warn)]">The players have heard it all before — shouts are losing their bite.</p>
        )}
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground">
        Pre-match: {PRE_TALKS.length - 1} ways to send them out. Talks move morale for good, shouts only move this match.
      </p>
    </div>
  );
}
