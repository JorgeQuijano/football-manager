import { useState } from "react";
import type { Player } from "@/engine";
import {
  MORALE_START,
  atmosphere,
  leaders,
  moodOf,
  moraleFactors,
  recentForm,
  socialGroups,
  squadStatus,
  TALK_COOLDOWN
} from "@/engine";
import { Button } from "@/components/ui/button";
import { useGame } from "@/state/store";
import { posChip, shortName } from "@/ui/format";

const moodChip = (m: number) => {
  const mood = moodOf(m);
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
      style={{ background: `${mood.tint}22`, color: mood.tint }}
      data-testid="mood-chip"
    >
      {mood.label}
    </span>
  );
};

export function Dynamics({ onOpenPlayer }: { onOpenPlayer: (id: string) => void }) {
  const game = useGame((s) => s.game)!;
  const talk = useGame((s) => s.talk);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);

  const club = game.players.filter((p) => p.clubId === game.userClubId);
  const atm = atmosphere(game);
  const lead = leaders(game, game.userClubId);
  const groups = socialGroups(game);
  const form = recentForm(game).slice(0, 5);
  const sorted = [...club].sort((a, b) => (a.morale ?? MORALE_START) - (b.morale ?? MORALE_START));
  const requests = club.filter((p) => p.transferRequest);
  const now = game.season * 1000 + game.round;

  const doTalk = (p: Player, kind: "praise" | "warn") => {
    const res = talk(p.id, kind);
    setMsg({ text: res?.message ?? "No game loaded.", bad: res ? !res.ok : true });
  };

  const topReason = (p: Player): string => {
    const fs = moraleFactors(game, p);
    const worst = fs.filter((f) => f.val < 0).sort((a, b) => a.val - b.val)[0];
    if (worst) return worst.label;
    const best = fs.filter((f) => f.val > 0).sort((a, b) => b.val - a.val)[0];
    return best ? best.label : "Getting on with it";
  };

  return (
    <div className="space-y-3" data-testid="dynamics-view">
      {msg && (
        <p className={`text-[11px] font-semibold ${msg.bad ? "text-[#FF6B6B]" : "text-primary"}`} data-testid="talk-msg">
          {msg.text}
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-3" data-testid="atmos-card">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="eyebrow">Dressing room</div>
            <div className="text-lg font-extrabold" style={{ color: atm.tint }} data-testid="atmo-label">
              {atm.label}
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground tnum">
            <div>avg mood {Math.round(atm.avg)}</div>
            {form.length > 0 && (
              <div className="flex items-center justify-end gap-1 pt-0.5" data-testid="atmo-form">
                {form.map((r, i) => (
                  <span
                    key={i}
                    className="rounded px-1 text-[10px] font-bold"
                    style={{
                      background: r === "W" ? "#2ED57322" : r === "L" ? "#FF6B6B22" : "#8B98A522",
                      color: r === "W" ? "#2ED573" : r === "L" ? "#FF6B6B" : "#8B98A5"
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1" data-testid="atmo-counts">
          {atm.counts
            .filter((c) => c.n > 0)
            .map((c) => (
              <span
                key={c.label}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: `${c.tint}1A`, color: c.tint }}
              >
                {c.n} {c.label}
              </span>
            ))}
        </div>
        {requests.length > 0 && (
          <p className="mt-2 text-[11px] font-semibold text-[#FF8A5C]" data-testid="atmo-requests">
            {requests.length === 1
              ? `${requests[0].name} has handed in a transfer request.`
              : `${requests.length} players have handed in transfer requests.`}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-3" data-testid="leaders-card">
        <div className="eyebrow">Leaders — their mood sets the tone</div>
        <div className="mt-1.5 space-y-1">
          {lead.map((p) => (
            <button
              key={p.id}
              data-testid={`leader-${p.id}`}
              onClick={() => onOpenPlayer(p.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${posChip[p.pos]}`}>{p.pos}</span>
                <span className="truncate text-sm font-semibold">{p.name}</span>
              </span>
              {moodChip(p.morale ?? MORALE_START)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2" data-testid="groups-card">
        <div className="eyebrow">Social groups</div>
        {groups.map((g) => (
          <div key={g.id} className="rounded-xl border border-border bg-card p-3" data-testid={`group-${g.id}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {g.label} <span className="text-[10px] font-semibold text-muted-foreground">· {g.players.length}</span>
              </span>
              {moodChip(g.avg)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{g.blurb}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <span className="block h-full rounded-full" style={{ width: `${g.avg}%`, background: moodOf(g.avg).tint }} />
              </span>
              {g.keyMan && (
                <span className="text-[10px] text-muted-foreground">
                  key man {shortName(g.keyMan.name)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2" data-testid="happiness-list">
        <div className="eyebrow">Happiness — worst first</div>
        {sorted.map((p) => {
          const m = p.morale ?? MORALE_START;
          const last = p.lastTalk ?? -9999;
          const onCooldown = last > now - TALK_COOLDOWN;
          return (
            <div key={p.id} className="rounded-xl border border-border bg-card p-2.5" data-testid={`mood-row-${p.id}`}>
              <div className="flex items-center justify-between gap-2">
                <button
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  data-testid={`mood-open-${p.id}`}
                  onClick={() => onOpenPlayer(p.id)}
                >
                  <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${posChip[p.pos]}`}>{p.pos}</span>
                  <span className="truncate text-sm font-semibold">{shortName(p.name)}</span>
                  <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {squadStatus(game, p)}
                  </span>
                </button>
                {moodChip(m)}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] text-muted-foreground" data-testid={`mood-why-${p.id}`}>
                  {topReason(p)}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11"
                    data-testid={`talk-praise-${p.id}`}
                    disabled={onCooldown}
                    onClick={() => doTalk(p, "praise")}
                  >
                    Praise
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11"
                    data-testid={`talk-warn-${p.id}`}
                    disabled={onCooldown}
                    onClick={() => doTalk(p, "warn")}
                  >
                    Warn
                  </Button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
