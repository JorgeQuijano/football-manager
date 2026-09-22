import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useGame } from "@/state/store";
import { fansTone, respectTone, type PressOutcome } from "@/engine";

const toneColor: Record<"good" | "bad" | "neutral", string> = {
  good: "#2ED573",
  bad: "#FF6B6B",
  neutral: "#8B98A5"
};

const kindLabel: Record<string, string> = {
  report: "Report",
  rumour: "Rumour",
  fan: "Terrace",
  press: "Press",
  promise: "Promise"
};

/** A compact meter (fan confidence / press respect). */
function Meter({ label, value, tone }: { label: string; value: number; tone: { label: string; tint: string } }) {
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold">{label}</span>
        <span style={{ color: tone.tint }}>{tone.label}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: tone.tint }} />
      </div>
    </div>
  );
}

/** Home-card: the pending press conference + the latest headlines. */
export function MediaCard() {
  const game = useGame((s) => s.game)!;
  const [pressOpen, setPressOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const m = game.media;
  if (!m) return null;
  const press = m.press;
  const news = m.headlines.slice(0, 3);

  return (
    <div className="mt-3 space-y-3" data-testid="media-card">
      {press && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="eyebrow text-primary">Press conference</div>
              <div className="mt-0.5 text-sm font-semibold">
                {press.questions.length - press.idx} question
                {press.questions.length - press.idx === 1 ? "" : "s"} before round {press.round}
              </div>
            </div>
            <Button size="sm" data-testid="press-open" className="min-h-11 shrink-0" onClick={() => setPressOpen(true)}>
              Face the press
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border p-4">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">In the news</span>
          <button
            data-testid="news-open"
            className="-my-2.5 px-3 py-3.5 text-[11px] font-semibold text-primary"
            onClick={() => setNewsOpen(true)}
          >
            All headlines
          </button>
        </div>
        <div className="mt-2 flex gap-4">
          <Meter label="Fans" value={m.fans} tone={fansTone(m.fans)} />
          <Meter label="Press" value={m.respect} tone={respectTone(m.respect)} />
        </div>
        {news.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No headlines yet — play a round and the papers will have opinions.
          </p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="news-list">
            {news.map((h, i) => (
              <li key={`${h.round}-${i}-${h.text.slice(0, 12)}`} className="flex gap-2 text-xs">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full"
                  style={{ background: toneColor[h.tone] }}
                  aria-hidden
                />
                <span className="min-w-0 leading-snug">{h.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PressSheet open={pressOpen} onOpenChange={setPressOpen} />
      <NewsSheet open={newsOpen} onOpenChange={setNewsOpen} />
    </div>
  );
}

/** The press conference itself: two questions, three ways to answer each. */
export function PressSheet({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const game = useGame((s) => s.game)!;
  const answer = useGame((s) => s.answerPress);
  const skip = useGame((s) => s.skipPress);
  const [outcome, setOutcome] = useState<PressOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const press = game.media?.press ?? null;
  const q = press?.questions[press.idx] ?? null;

  // a fresh conference should always start on a question
  useEffect(() => {
    if (open) {
      setOutcome(null);
      setError(null);
    }
  }, [open]);

  const pick = (i: number) => {
    const res = answer(i);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setError(null);
    setOutcome(res);
  };

  const next = () => {
    setOutcome(null);
    if (outcome?.done || !game.media?.press) onOpenChange(false);
  };

  const club = game.clubs.find((c) => c.id === game.userClubId)!;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Press conference</SheetTitle>
          <SheetDescription>
            {club.name} · Round {press?.round ?? game.round} ·{" "}
            {press ? `Question ${Math.min(press.idx + 1, press.questions.length)} of ${press.questions.length}` : "No questions waiting"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-8" data-testid="press-sheet">
          {!press && (
            <p className="text-sm text-muted-foreground">
              You have faced the press for this round. They will be back before the next one.
            </p>
          )}

          {press && q && !outcome && (
            <>
              <p className="text-[11px] text-muted-foreground">{q.hint}</p>
              <p className="text-sm font-semibold leading-snug" data-testid="press-q">
                “{q.text}”
              </p>
              <div className="space-y-2 pt-1">
                {q.answers.map((a, i) => (
                  <button
                    key={a.label}
                    data-testid={`press-answer-${i}`}
                    onClick={() => pick(i)}
                    className="min-h-12 w-full rounded-xl border border-border bg-card px-3 py-3 text-left text-[13px] leading-snug transition-colors hover:border-primary/60"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <button
                data-testid="press-skip"
                className="min-h-11 w-full py-3 text-center text-[11px] text-muted-foreground underline"
                onClick={() => {
                  skip();
                  onOpenChange(false);
                }}
              >
                Send the assistant instead
              </button>
            </>
          )}

          {outcome && (
            <>
              <p className="text-sm leading-snug">{outcome.reply}</p>
              <div
                className="rounded-xl border border-border bg-secondary/40 p-3 text-[11px]"
                data-testid="press-effects"
              >
                <div className="eyebrow">Reaction</div>
                <div className="mt-1">{outcome.effects}</div>
              </div>
              <Button data-testid="press-next" className="min-h-11 w-full" onClick={next}>
                {outcome.done ? "Finish" : "Next question"}
              </Button>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The full newspaper: every headline plus the mood meters. */
export function NewsSheet({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const game = useGame((s) => s.game)!;
  const m = game.media;
  if (!m) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>The Gazette</SheetTitle>
          <SheetDescription>
            {m.pressCount} conference{m.pressCount === 1 ? "" : "s"} faced · {m.skipped} skipped
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-8" data-testid="news-sheet">
          <div className="flex gap-4">
            <Meter label="Fans" value={m.fans} tone={fansTone(m.fans)} />
            <Meter label="Press" value={m.respect} tone={respectTone(m.respect)} />
          </div>
          {m.promises.length > 0 && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px]">
              You owe them: {m.promises.map((p) => p.text).join(" · ")}
            </p>
          )}
          <ul className="space-y-2">
            {m.headlines.map((h, i) => (
              <li
                key={`${h.season}-${h.round}-${i}-${h.text.slice(0, 12)}`}
                className="rounded-xl border border-border p-3"
                data-testid="news-item"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span
                    className="rounded px-1.5 py-0.5 font-bold"
                    style={{ background: `${toneColor[h.tone]}22`, color: toneColor[h.tone] }}
                  >
                    {kindLabel[h.kind] ?? h.kind}
                  </span>
                  <span className="text-muted-foreground">
                    S{h.season} · R{h.round}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-snug">{h.text}</p>
              </li>
            ))}
            {m.headlines.length === 0 && (
              <li className="text-xs text-muted-foreground">Nothing has happened yet.</li>
            )}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
