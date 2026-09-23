import { useState } from "react";
import type { Player } from "@/engine";
import {
  MEETING_THEMES,
  TALK_OPTIONS,
  bigMatchFor,
  meetingAvailable,
  meetingFit,
  talkAdvice,
  talkSuggestions,
  talksCooling
} from "@/engine";
import { Button } from "@/components/ui/button";
import { shortName } from "@/ui/format";
import { useGame } from "@/state/store";

const fitTint: Record<"strong" | "even" | "risky", string> = {
  strong: "#2ED573",
  even: "#8B98A5",
  risky: "#FF6B6B"
};
const fitLabel: Record<"strong" | "even" | "risky", string> = {
  strong: "Strong fit",
  even: "Fine",
  risky: "Risky"
};

/** The stakes line for the next fixture — only when it's a big one. */
export function MatchStakes() {
  const game = useGame((s) => s.game)!;
  const fx = game.fixtures.find(
    (f) =>
      f.round === game.round &&
      !f.played &&
      (f.homeId === game.userClubId || f.awayId === game.userClubId)
  );
  if (!fx) return null;
  const big = bigMatchFor(game, fx);
  if (!big) return null;
  const oppId = fx.homeId === game.userClubId ? fx.awayId : fx.homeId;
  const opp = game.clubs.find((c) => c.id === oppId);
  return (
    <div
      className="mt-2 space-y-1 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-soft)] p-2.5"
      data-testid="big-match"
    >
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--warn)]">
        {big.label}
      </div>
      <div className="text-[11px] font-semibold" data-testid="big-match-stakes">
        {big.stakes}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Big games lift leaders and rattle the nervous — {opp?.short ?? "they"} feel it too.
      </div>
    </div>
  );
}

/** The squad meeting: one of six themes, read against the mood of the moment. */
export function MeetingCard() {
  const game = useGame((s) => s.game)!;
  const callMeeting = useGame((s) => s.teamMeeting);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ message: string; fit: "strong" | "even" | "risky"; lines: string[] } | null>(null);
  if (!meetingAvailable(game) && !result) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3" data-testid="meeting-card">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Team meeting
        </span>
        {!result && (
          <button
            data-testid="meeting-toggle"
            onClick={() => setOpen((v) => !v)}
            className="text-[10px] font-bold text-primary underline"
          >
            {open ? "Hide" : "Call one"}
          </button>
        )}
      </div>

      {!open && !result && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          One meeting every couple of rounds. Pick the right message for the moment — the wrong one
          can set you back.
        </p>
      )}

      {open && !result && (
        <div className="mt-2 space-y-1.5">
          {MEETING_THEMES.map((t) => {
            const fit = meetingFit(game, t.id);
            return (
              <button
                key={t.id}
                data-testid={`meeting-${t.id}`}
                onClick={() => {
                  const out = callMeeting(t.id);
                  if (out) setResult({ message: out.message, fit: out.fit, lines: out.lines });
                }}
                className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-bold">{t.label}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{t.blurb}</span>
                </span>
                <span className="shrink-0 text-[9px] font-bold uppercase" style={{ color: fitTint[fit.fit] }}>
                  {fitLabel[fit.fit]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {result && (
        <div className="mt-2 space-y-1">
          <p className="text-[11px] font-semibold" style={{ color: fitTint[result.fit] }} data-testid="meeting-result">
            {result.message}
          </p>
          {result.lines.map((l, i) => (
            <p key={i} className="text-[10px] text-muted-foreground">
              {l}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** The four conversations you can have with one player, in his sheet. */
export function TalkPanel({ player }: { player: Player }) {
  const game = useGame((s) => s.game)!;
  const talk = useGame((s) => s.talk);
  const pledge = useGame((s) => s.pledge);
  const [note, setNote] = useState<string | null>(null);
  const cooling = talksCooling(player, game);
  const advice = talkAdvice(game, player);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3" data-testid="player-talk">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Have a word
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground tnum">
          {Math.round(player.morale ?? 60)} mood{player.pumped ? " · fired up" : ""}
        </span>
      </div>
      {advice && (
        <p className="text-[11px] font-semibold text-primary" data-testid="talk-advice">
          {advice.why}
        </p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {TALK_OPTIONS.map((o) => (
          <button
            key={o.kind}
            data-testid={`talk-${o.kind}`}
            disabled={cooling}
            onClick={() => {
              const r = talk(player.id, o.kind);
              setNote(r?.message ?? "No game loaded.");
            }}
            className="h-11 rounded-lg border border-border bg-card px-2 text-left text-[11px] font-bold disabled:opacity-50"
          >
            {o.label}
            <span className="block text-[9px] font-semibold text-muted-foreground">{o.blurb.slice(0, 42)}</span>
          </button>
        ))}
      </div>
      {cooling && (
        <p className="text-[10px] text-muted-foreground">
          You've spoken to him recently — give it a few matches.
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-11 w-full text-[11px]"
        data-testid="pledge-minutes"
        disabled={!!player.pledge || player.injuredWeeks > 0 || player.suspension > 0}
        onClick={() => setNote(pledge(player.id))}
      >
        {player.pledge
          ? `Promised ${player.pledge.minutes} minutes next round`
          : "Promise him 30 minutes next round"}
      </Button>
      {note && (
        <p className="text-[11px] font-semibold text-primary" data-testid="talk-note">
          {note}
        </p>
      )}
    </div>
  );
}

/** Squad screen: who needs a word this week, and what to say. */
export function WordWatch() {
  const game = useGame((s) => s.game)!;
  const talk = useGame((s) => s.talk);
  const [note, setNote] = useState<string | null>(null);
  const suggestions = talkSuggestions(game, 3);
  if (!suggestions.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3" data-testid="needs-word">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Needs a word
      </div>
      <div className="mt-1.5 space-y-1.5">
        {suggestions.map(({ player, kind, why }) => (
          <div key={player.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-bold">{shortName(player.name)}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{why}</span>
            </span>
            <button
              data-testid={`word-${player.id}`}
              onClick={() => {
                const r = talk(player.id, kind);
                setNote(r?.message ?? "No game loaded.");
              }}
              className="h-11 shrink-0 rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground"
            >
              {kind === "praise" ? "Praise" : kind === "warn" ? "Warn" : kind === "challenge" ? "Challenge" : "Reassure"}
            </button>
          </div>
        ))}
      </div>
      {note && (
        <p className="mt-1.5 text-[11px] font-semibold text-primary" data-testid="word-note">
          {note}
        </p>
      )}
    </div>
  );
}
